export function toRad(deg) {
  return deg * Math.PI / 180;
}

export function haversine(lat1, lng1, lat2, lng2) {
  const R = 6_371_000; // Earth radius in metres
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function rollingStdDev(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// Minimum distance from a point to any segment of a polyline
export function distToPolyline(lat, lng, polyline) {
  let minDist = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const d = _distToSegment(lat, lng, polyline[i], polyline[i + 1]);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

function _distToSegment(lat, lng, a, b) {
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  if (dx === 0 && dy === 0) return haversine(lat, lng, a.lat, a.lng);
  const t = Math.max(0, Math.min(1,
    ((lng - a.lng) * dx + (lat - a.lat) * dy) / (dx * dx + dy * dy)
  ));
  return haversine(lat, lng, a.lat + t * dy, a.lng + t * dx);
}
