// Demo data: the prototype's built-in accounts, 3 starter cases, ~1 year of history for the charts.
const env = require('../src/config/env');
const { assertDemoSeedAllowed } = require('../src/config/security');
assertDemoSeedAllowed(env.nodeEnv);

const bcrypt = require('bcryptjs');
const db = require('../src/db/database');
const { RADII, POINTS } = require('../src/utils/constants');

const users = [
  ['user1', 'user123', 'Priya S.', 'user', null, 1], ['user2', 'user456', 'Arjun M.', 'user', null, 1], ['guest', 'guest', 'Guest User', 'user', null, 1],
  ['vet1', 'vet123', 'Dr. Meena (Vet)', 'responder', 'vet', 1], ['ngo1', 'ngo123', 'Blue Cross NGO', 'responder', 'ngo', 1],
  ['ngo2', 'ngo456', 'CARE Rescue Team', 'responder', 'ngo', 1], ['vol1', 'vol123', 'Volunteer Raju', 'responder', 'volunteer', 1],
  [env.admin.username, env.admin.password, env.admin.name, 'admin', null, 0], ['systemop', 'OpSecure#99', 'Operations Admin', 'admin', null, 1]
];
const ins = db.prepare('INSERT OR IGNORE INTO users (username,password_hash,name,role,responder_type,points,is_demo) VALUES (?,?,?,?,?,?,?)');
users.forEach(([u, p, n, r, t, isDemo]) => ins.run(u, bcrypt.hashSync(p, 10), n, r, t || null, u === 'user1' ? 120 : 0, isDemo));
const id = u => db.prepare('SELECT id FROM users WHERE username=?').get(u).id;

if (db.prepare('SELECT COUNT(*) n FROM reports').get().n === 0) {
  let seed = 42; const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const pick = a => a[Math.floor(rnd() * a.length)];
  const animals = ['Dog', 'Dog', 'Dog', 'Cat', 'Cat', 'Bird', 'Cow', 'Horse', 'Other'];
  const places = ['T. Nagar, Chennai', 'Adyar Signal', 'Anna Nagar West', 'Velachery Main Rd', 'Mylapore Tank', 'Besant Nagar Beach'];
  const resp = [['vet1', 'vet'], ['ngo1', 'ngo'], ['ngo2', 'ngo'], ['vol1', 'volunteer']];
  const insR = db.prepare(`INSERT INTO reports (reporter_id,animal_type,severity,description,location,lat,lng,status,radius_level,radius_km,assigned_to,responder_id,responder_type,pts_value,points_awarded,accepted_at,rescued_at,created_at,updated_at,is_demo)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?,1)`);
  const reporters = [id('user1'), id('user2'), id('guest')];
  const monthly = [[38, 8, 30], [52, 12, 41], [61, 14, 48], [44, 9, 35], [70, 16, 55], [83, 19, 66], [67, 15, 52], [91, 21, 74], [78, 18, 61], [105, 24, 88], [89, 20, 71], [118, 28, 95]];
  const now = new Date();
  db.transaction(() => {
    monthly.forEach(([total, crit, resc], i) => {
      const m = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (11 - i), 1));
      const days = i === 11 ? Math.max(1, now.getUTCDate()) : 28;
      for (let k = 0; k < total; k++) {
        const sev = k < crit ? 'critical' : k % 3 ? 'moderate' : 'mild';
        const done = k >= total - resc ? 1 : 0;
        const created = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth(), 1 + Math.floor(rnd() * days), Math.floor(rnd() * 20), Math.floor(rnd() * 60)));
        if (created > now) created.setTime(now.getTime() - 3600e3);
        const [ru, rt] = pick(resp);
        const acc = new Date(created.getTime() + (8 + rnd() * 40) * 60000);
        const resTs = new Date(acc.getTime() + 3600e3);
        const lvl = sev === 'critical' ? Math.floor(rnd() * 3) : Math.floor(rnd() * 2);
        const status = done ? (rnd() > 0.3 ? 'completed' : 'rescued') : pick(['reported', 'accepted', 'onway']);
        const assigned = status === 'reported' ? null : { vet: 'Veterinarian', ngo: 'NGO Team', volunteer: 'Volunteer' }[rt];
        insR.run(pick(reporters), pick(animals), sev, 'Demo history record for analytics.', pick(places), 13.0 + rnd() * 0.15, 80.2 + rnd() * 0.1,
          status, status === 'reported' ? lvl : 0, RADII[sev][status === 'reported' ? lvl : 0], assigned, assigned ? id(ru) : null, assigned ? rt : null, POINTS[sev],
          assigned ? acc.toISOString() : null, done ? resTs.toISOString() : null, created.toISOString(), created.toISOString());
      }
    });
    const iso = new Date().toISOString();
    [['Dog', 'critical', 'Hit by vehicle near the signal, bleeding from hind leg. Cannot walk.', 'Adyar Signal, Chennai'],
     ['Cat', 'moderate', 'Kitten with injured eye, hiding under parked car.', 'T. Nagar Bus Stand'],
     ['Cow', 'mild', 'Stray cow wandering on the highway shoulder, looks healthy.', 'ECR Main Road']].forEach(([t, s, d, l]) => {
      const r = db.prepare(`INSERT INTO reports (reporter_id,animal_type,severity,description,location,lat,lng,radius_km,pts_value,created_at,updated_at,is_demo) VALUES (?,?,?,?,?,?,?,?,?,?,?,1)`)
        .run(id('user1'), t, s, d, l, 13.0827, 80.2707, RADII[s][0], POINTS[s], iso, iso);
      db.prepare("INSERT INTO report_events (report_id,title,note,created_at) VALUES (?,?,?,?)").run(r.lastInsertRowid, 'Reported', 'Report submitted by Priya S.', iso);
    });
  })();
}
if (db.prepare('SELECT COUNT(*) n FROM donations').get().n === 0)
  db.prepare('INSERT INTO donations (user_id,ngo,amount,donor_name) VALUES (?,?,?,?)').run(id('user1'), 'Blue Cross of India', 500, 'Ramesh K.');
console.log('Seed complete.');
