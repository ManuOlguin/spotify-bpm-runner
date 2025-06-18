import { useEffect, useState, useCallback } from "react";
import { generateCodeVerifier, generateCodeChallenge } from "./utils/pkce.ts";
import axios from "axios";
import './index.css'; // This line imports your Tailwind CSS

const CLIENT_ID = "17856528d9a9425cb280cd98ae2cf73e";
const REDIRECT_URI = "https://spotify-bpm-runner.vercel.app/";
const SCOPES =
  "user-read-playback-state user-modify-playback-state playlist-read-private streaming";

const API_BASE = "https://back-running-production-cd22.up.railway.app/api";

function App() {
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  // ... todos tus demás estados

  // Función para refrescar token (la que ya tenés)
  const refreshAccessToken = useCallback(async () => {
    if (!refreshToken) return null;
    try {
      const res = await axios.post(
        "https://accounts.spotify.com/api/token",
        new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          client_id: CLIENT_ID,
        }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );
      setToken(res.data.access_token);
      localStorage.setItem("spotify_access_token", res.data.access_token);
      return res.data.access_token;
    } catch (e) {
      console.error("Error refrescando token", e);
      setToken(null);
      setRefreshToken(null);
      localStorage.removeItem("spotify_access_token");
      localStorage.removeItem("spotify_refresh_token");
      return null;
    }
  }, [refreshToken]);

  // Scheduler para refrescar antes de que expire (lo que ya tenés)
  const scheduleTokenRefresh = useCallback(() => {
    setTimeout(() => {
      refreshAccessToken();
    }, 55 * 60 * 1000);
  }, [refreshAccessToken]);

  // Interceptor de axios para reintentar petición con token nuevo si da 401
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        if (
          error.response?.status === 401 &&
          !originalRequest._retry &&
          refreshToken
        ) {
          originalRequest._retry = true;
          const newAccessToken = await refreshAccessToken();
          if (newAccessToken) {
            originalRequest.headers["Authorization"] = `Bearer ${newAccessToken}`;
            return axios(originalRequest);
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [refreshAccessToken, refreshToken]);

  const [playlists, setPlaylists] = useState<{ id: string; name: string }[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>("");
  const [tracks, setTracks] = useState<
    {
      trackId: string;
      name: string;
      artist: string;
      bpm: number | null;
      uri?: string;
    }[]
  >([]);
  const [newBpm, setNewBpm] = useState<number | "">("");
  const [selectedTrackId, setSelectedTrackId] = useState<string>("");
  const [targetBpm, setTargetBpm] = useState<number>(120);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);


  useEffect(() => {
    const savedAccess = localStorage.getItem("spotify_access_token");
    const savedRefresh = localStorage.getItem("spotify_refresh_token");
    if (savedAccess) setToken(savedAccess);
    if (savedRefresh) setRefreshToken(savedRefresh);
    if (savedAccess && savedRefresh) scheduleTokenRefresh();
  }, [scheduleTokenRefresh]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    if (code) {
      const verifier = localStorage.getItem("code_verifier");
      if (!verifier) return;
      axios
        .post(
          "https://accounts.spotify.com/api/token",
          new URLSearchParams({
            client_id: CLIENT_ID,
            grant_type: "authorization_code",
            code,
            redirect_uri: REDIRECT_URI,
            code_verifier: verifier,
          }),
          { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        )
        .then((res) => {
          setToken(res.data.access_token);
          setRefreshToken(res.data.refresh_token);
          localStorage.setItem("spotify_access_token", res.data.access_token);
          localStorage.setItem("spotify_refresh_token", res.data.refresh_token);
          window.history.replaceState({}, document.title, "/");
          scheduleTokenRefresh();
        })
        .catch(console.error);
    }
  }, [scheduleTokenRefresh]);

  useEffect(() => {
    if (!token) return;
    axios
      .get(`${API_BASE}/playlists`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setPlaylists(res.data))
      .catch(console.error);
  }, [token]);

  useEffect(() => {
    if (!token || !selectedPlaylistId) return;
    axios
      .get(`${API_BASE}/playlist/${selectedPlaylistId}/tracks`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        const tracksWithUri = res.data.map((t: any) => ({
          ...t,
          uri: `spotify:track:${t.trackId}`,
        }));
        setTracks(tracksWithUri);
        setSelectedTrackId("");
        setNewBpm("");
      })
      .catch(console.error);
  }, [selectedPlaylistId, token]);

  const handleSaveBpm = async () => {
    if (!selectedTrackId || !newBpm || newBpm < 30 || newBpm > 300) {
      alert("Seleccioná una canción y un BPM válido (30-300).");
      return;
    }
    try {
      await axios.post(
        `${API_BASE}/bpm`,
        { trackId: selectedTrackId, bpm: Number(newBpm) },
        { headers: { "Content-Type": "application/json" } }
      );
      setTracks((tracks) =>
        tracks.map((t) =>
          t.trackId === selectedTrackId ? { ...t, bpm: Number(newBpm) } : t
        )
      );
      setNewBpm("");
      alert("BPM guardado correctamente");
    } catch (e) {
      alert("Error guardando BPM");
      console.error(e);
    }
  };

  const handlePlayBpmRange = async () => {
    if (!token) {
      alert("No estás logueado");
      return;
    }
    const bpmRange = 5;
    const validTracks = tracks.filter(
      (t) => t.bpm !== null && t.uri
    );
    const filteredTracks = validTracks.filter(
      (t) => {
        const bpm = t.bpm!;
        return (
          Math.abs(bpm - targetBpm) <= bpmRange ||
          Math.abs(bpm * 2 - targetBpm) <= bpmRange ||
          Math.abs(bpm / 2 - targetBpm) <= bpmRange
        );
      }
    );
    if (filteredTracks.length === 0) {
      alert("No hay canciones en ese rango de BPM.");
      return;
    }
    const shuffled = [...filteredTracks].sort(() => Math.random() - 0.5);
    try {
      await axios.put(
        "https://api.spotify.com/v1/me/player/play",
        { uris: shuffled.map((t) => t.uri) },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      setIsPlaying(true);
    } catch (e) {
      alert("Error al iniciar la reproducción");
      console.error(e);
    }
  };

  const handleLogin = async () => {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    localStorage.setItem("code_verifier", verifier);
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: "code",
      redirect_uri: REDIRECT_URI,
      scope: SCOPES,
      code_challenge_method: "S256",
      code_challenge: challenge,
    });
    window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
  };

  const getColor = (bpm: number | null): string => {
    if (bpm === null) return "text-gray-500";
    if (bpm < 90) return "text-blue-500";
    if (bpm < 130) return "text-green-500";
    if (bpm < 170) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <div className="container">
  {!token ? (
    <button onClick={handleLogin} className="btn-login">
      Iniciar sesión con Spotify
    </button>
  ) : (
    <>
          {!isPlaying && (
        <>
          <select
            className="select-playlist"
            onChange={(e) => setSelectedPlaylistId(e.target.value)}
            value={selectedPlaylistId}
          >
            
            <option value="" disabled>
              -- Elegí una playlist --
            </option>
            {playlists.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select></>)}

    <div className="target-bpm-container">
        <label className="target-bpm-label">
          BPM objetivo: <span className="target-bpm-value">{targetBpm}</span>
        </label>
        <input
          type="range"
          min={30}
          max={300}
          value={targetBpm}
          onChange={(e) => setTargetBpm(Number(e.target.value))}
          className="range-bpm"
        />
      </div>

      <button
        onClick={handlePlayBpmRange}
        className={`btn-play `}
      >
        {isPlaying ? (
          <span className="playing-indicator">
            <svg
              className="spinner"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="spinner-bg"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="spinner-fg"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8z"
              ></path>
            </svg>
            Reproduciendo...
          </span>
        ) : (
          "Play"
        )}
      </button>
      {!isPlaying && (
        <>

          
<div className="bpm-inputs">
            <input
              type="number"
              min={30}
              max={300}
              value={newBpm}
              onChange={(e) =>
                setNewBpm(e.target.value === "" ? "" : Number(e.target.value))
              }
              placeholder="Nuevo BPM"
              className="input-bpm"
            />
            <button onClick={handleSaveBpm} className="btn-save-bpm">
              Guardar BPM
            </button>
          </div>
          <ul className="track-list">
            {[...tracks]
              .sort((a, b) => (a.bpm ?? 0) - (b.bpm ?? 0))
              .map(({ trackId, name, artist, bpm }) => (
                <li
                  key={trackId}
                  className={`track-item ${getColor(bpm)} ${
                    selectedTrackId === trackId ? "selected" : ""
                  }`}
                  onClick={() => setSelectedTrackId(trackId)}
                >
                  <div className="track-info">
                    <strong className="track-name">{name}</strong>
                    <span className="track-artist"> - {artist}</span>
                  </div>
                  <span className="track-bpm">{bpm ?? "-"}</span>
                </li>
              ))}
          </ul>

          
        </>
      )}

      
    </>
  )}
</div>

  );
}

export default App;
