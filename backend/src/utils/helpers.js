class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const code = id => 'SC-' + id;

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371, toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const nowIso = () => new Date().toISOString();

function csvCell(v) {
  const s = v === null || v === undefined ? '' : String(v);
  // Neutralise spreadsheet formula injection as well as quoting.
  const safe = /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
  return '"' + safe.replace(/"/g, '""') + '"';
}
const toCsv = (header, rows) => [header, ...rows].map(r => r.map(csvCell).join(',')).join('\n');

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

module.exports = { HttpError, wrap, code, haversineKm, nowIso, toCsv, csvCell, escapeHtml };
