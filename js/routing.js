import { TMAP_API_KEY } from './config.js';

const TMAP_URL = 'https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json';

export async function fetchPedestrianRoute(start, end) {
  if (!TMAP_API_KEY || TMAP_API_KEY === 'YOUR_TMAP_KEY') {
    return null; // fall back to straight line
  }

  const res = await fetch(TMAP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      appKey: TMAP_API_KEY,
    },
    body: JSON.stringify({
      startX:       String(start.lng),
      startY:       String(start.lat),
      endX:         String(end.lng),
      endY:         String(end.lat),
      reqCoordType: 'WGS84GEO',
      resCoordType: 'WGS84GEO',
      startName:    '출발지',
      endName:      '도착지',
      searchOption: '0', // 0 = recommended pedestrian
    }),
  });

  if (!res.ok) throw new Error(`Tmap ${res.status}`);

  const data = await res.json();

  // Flatten all LineString coordinates into {lat, lng} points
  const points = [];
  for (const feature of data.features ?? []) {
    if (feature.geometry?.type === 'LineString') {
      for (const [lng, lat] of feature.geometry.coordinates) {
        points.push({ lat, lng });
      }
    }
  }

  return points.length > 1 ? points : null;
}
