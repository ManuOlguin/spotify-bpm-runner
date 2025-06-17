// src/utils/bpm.ts

export async function getBpmForTrack(trackName: string, artistName: string): Promise<number | null> {
  const cacheKey = `bpm_${trackName}_${artistName}`.toLowerCase().replace(/\s+/g, '_');
  const cached = localStorage.getItem(cacheKey);
  if (cached) return Number(cached);

  // Llamada real a la API de getsongbpm aquí
  // Ejemplo de llamada:
  // const response = await fetch(`https://api.getsongbpm.com/search/?api_key=TU_API_KEY&type=search&query=${encodeURIComponent(trackName + ' ' + artistName)}`);
  // const data = await response.json();
  // const bpm = data?.search?.[0]?.tempo || null;

  // Por ahora simulamos:
  const bpm = Math.floor(Math.random() * 100) + 80;

  localStorage.setItem(cacheKey, bpm.toString());
  return bpm;
}
