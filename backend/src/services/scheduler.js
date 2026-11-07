// Server-side radius expansion. Replaces the prototype's per-tab setTimeout, so it
// survives page reloads and runs for every open report.
const db = require('../db/database');
const env = require('../config/env');
const { RADII } = require('../utils/constants');
const { addEvent } = require('./reportService');
const { nowIso } = require('../utils/helpers');

function tick() {
  const open = db.prepare("SELECT id, severity, radius_level, last_expanded_at, created_at FROM reports WHERE status = 'reported'").all();
  const now = Date.now();
  for (const r of open) {
    const radii = RADII[r.severity];
    if (r.radius_level >= radii.length - 1) continue;
    const since = new Date(r.last_expanded_at || r.created_at).getTime();
    if (now - since < env.expansionSeconds[r.severity] * 1000) continue;
    const level = r.radius_level + 1;
    const ts = nowIso();
    db.transaction(() => {
      db.prepare('UPDATE reports SET radius_level = ?, radius_km = ?, last_expanded_at = ?, updated_at = ? WHERE id = ? AND status = ?')
        .run(level, radii[level], ts, ts, r.id, 'reported');
      addEvent(r.id, `Radius expanded to ${radii[level]}km`, 'No response — expanding search area', ts);
    })();
  }
}

let timer = null;
function start() { if (!timer) { timer = setInterval(() => { try { tick(); } catch (e) { console.error('scheduler', e); } }, 1000); timer.unref?.(); } }
function stop() { clearInterval(timer); timer = null; }

module.exports = { start, stop, tick };
