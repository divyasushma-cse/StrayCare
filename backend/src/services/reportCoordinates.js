const { HttpError } = require('../utils/helpers');

function parseCoordinates(latValue, lngValue) {
  const hasLat = latValue !== undefined && String(latValue).trim() !== '';
  const hasLng = lngValue !== undefined && String(lngValue).trim() !== '';
  if (!hasLat && !hasLng) return { lat: null, lng: null };
  if (!hasLat || !hasLng) throw new HttpError(400, 'GPS coordinates must include both latitude and longitude');

  const lat = Number(latValue), lng = Number(lngValue);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new HttpError(400, 'GPS coordinates are invalid');
  }
  return { lat, lng };
}

function hasCoordinates(report) {
  return report.lat !== null && report.lat !== undefined
    && report.lng !== null && report.lng !== undefined
    && Number.isFinite(Number(report.lat)) && Number.isFinite(Number(report.lng));
}

function filterNearby(rows, lat, lng, haversineKm) {
  return rows
    .filter(hasCoordinates)
    .map(row => ({ ...row, distance_km: Math.round(haversineKm(lat, lng, row.lat, row.lng) * 10) / 10 }))
    .filter(row => row.distance_km <= row.radius_km)
    .sort((a, b) => a.distance_km - b.distance_km);
}

module.exports = { parseCoordinates, hasCoordinates, filterNearby };
