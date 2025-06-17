import { useEffect, useState } from 'react';
import { generateCodeVerifier, generateCodeChallenge } from './utils/pkce';
import axios from 'axios';
import { getBpmForTrack } from './utils/bpm';

const CLIENT_ID = '17856528d9a9425cb280cd98ae2cf73e';
const REDIRECT_URI = 'http://127.0.0.1:5173/';
const SCOPES = 'user-read-playback-state user-modify-playback-state playlist-read-private';


function App() {
  const [token, setToken] = useState<string | null>(null);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [tracks, setTracks] = useState<any[]>([]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
      const verifier = localStorage.getItem('code_verifier');
      if (!verifier) return;

      axios.post('https://accounts.spotify.com/api/token', new URLSearchParams({
        client_id: CLIENT_ID,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier,
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }).then(res => {
        setToken(res.data.access_token);
        window.history.replaceState({}, document.title, "/");
      }).catch(console.error);
    }
  }, []);

  // Aquí van los useEffect fuera de cualquier función, en el nivel superior del componente

  useEffect(() => {
    if (!token) return;

    axios.get("https://api.spotify.com/v1/me/playlists", {
      headers: { Authorization: `Bearer ${token}` },
      params: { limit: 50 },
    }).then(res => {
      setPlaylists(res.data.items);
    }).catch(console.error);
  }, [token]);

 useEffect(() => {
  if (!selectedPlaylistId || !token) return;

  axios.get(`https://api.spotify.com/v1/playlists/${selectedPlaylistId}/tracks`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { limit: 100 },
  }).then(async (res) => {
    // Obtener BPM para cada canción
    const tracksWithBpm = await Promise.all(res.data.items.map(async (item: any) => {
      const track = item.track;
      const bpm = await getBpmForTrack(track.name, track.artists[0].name);
      return { ...item, bpm };
    }));
    setTracks(tracksWithBpm);
  }).catch(console.error);
}, [selectedPlaylistId, token]);

  const handleLogin = async () => {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    localStorage.setItem('code_verifier', verifier);

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      scope: SCOPES,
      code_challenge_method: 'S256',
      code_challenge: challenge,
    });

    window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
  };

  return (
    <div>
      {!token && (
        <button onClick={handleLogin}>Login con Spotify</button>
      )}

      {token && (
        <>
          <h2>Seleccioná una playlist</h2>
          <select onChange={e => setSelectedPlaylistId(e.target.value)} defaultValue="">
            <option value="" disabled>-- Elegí una playlist --</option>
            {playlists.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <ul>
            {tracks.map(({ track }) => (
              <li key={track.id}>{track.name} - {track.artists[0].name}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default App;
