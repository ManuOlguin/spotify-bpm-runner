export async function getBpmForTrack(trackName: string, artistName: string, trackId: string): Promise<number | null> {
  const cacheKey = `bpm_${trackName}_${artistName}`.toLowerCase().replace(/\s+/g, '_');
  const cached = localStorage.getItem(cacheKey);
  if (cached) return Number(cached);

const response = await fetch(`http://localhost:3001/bpm?trackName=${encodeURIComponent(trackName)}&artistName=${encodeURIComponent(artistName)}&trackId=${encodeURIComponent(trackId)}`);
  const data = await response.json();

  const bpm = data.tempo ?? null;

  if (bpm) {
    localStorage.setItem(cacheKey, bpm.toString());
  }

  return bpm;
}
