// API smoke test. Run through `npm test` for a disposable database, or set BASE to a dedicated test server.
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:5000';
const ADMIN = { username: process.env.ADMIN_USERNAME || 'superadmin', password: process.env.ADMIN_PASSWORD || 'StrayCareAdmin$2026' };
let pass = 0, fail = 0;

async function call(method, path, { token, body, form, raw } = {}) {
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  if (raw) return res;
  let data = null; try { data = await res.json(); } catch { /* not json */ }
  return { status: res.status, data };
}
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name, extra !== undefined ? JSON.stringify(extra) : ''); }
}
const login = async (username, password, role) => (await call('POST', '/api/auth/login', { body: { username, password, role } }));

async function runSmokeTest() {
  console.log('Auth');
  let r = await login('user1', 'user123', 'user'); const user = r.data.token;
  check('user login', r.status === 200 && r.data.user.role === 'user');
  check('wrong password rejected', (await login('user1', 'nope', 'user')).status === 401);
  check('wrong role rejected', (await login('user1', 'user123', 'admin')).status === 401);
  const resp = (await login('ngo1', 'ngo123', 'responder')).data.token;
  const admin = (await login(ADMIN.username, ADMIN.password, 'admin')).data.token;
  check('admin login', !!admin);
  check('no token => 401', (await call('GET', '/api/reports/mine')).status === 401);
  check('user cannot open admin API', (await call('GET', '/api/admin/summary', { token: user })).status === 403);
  check('responder cannot submit report', (await call('POST', '/api/reports', { token: resp, body: {} })).status === 403);

  const lifecycleDb = require('../src/db/database');
  const reporterId = lifecycleDb.prepare('SELECT id FROM users WHERE username = ?').get('user1').id;
  const createResponderCases = responderId => {
    const insert = lifecycleDb.prepare(`INSERT INTO reports
      (reporter_id, animal_type, severity, description, location, lat, lng, status, radius_km,
       assigned_to, responder_id, responder_type, accepted_at, created_at, updated_at)
      VALUES (?, 'Dog', 'mild', 'Responder lifecycle smoke case', 'Lifecycle test street', NULL, NULL, ?, 2,
       'NGO Team', ?, 'ngo', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`);
    return ['accepted', 'onway', 'rescued', 'completed'].map(status =>
      Number(insert.run(reporterId, status, responderId).lastInsertRowid));
  };
  const assertRecoveredCase = (reportId, expectedStatus) => {
    const report = lifecycleDb.prepare('SELECT * FROM reports WHERE id = ?').get(reportId);
    check(`responder lifecycle case ${reportId} ${expectedStatus}`, report.status === expectedStatus);
    return report;
  };
  const bannedRegistration = await call('POST', '/api/auth/register', {
    body: { name: 'Ban Lifecycle', username: 'banlife_' + Date.now().toString(36), password: 'secret1', role: 'responder', responderType: 'ngo' }
  });
  const bannedCases = createResponderCases(bannedRegistration.data.user.id);
  check('ban responder request succeeds', (await call('PATCH', `/api/admin/users/${bannedRegistration.data.user.id}/ban`, { token: admin })).status === 200);
  const bannedActive = bannedCases.slice(0, 2).map(id => assertRecoveredCase(id, 'reported'));
  check('ban reopens and unassigns active cases', bannedActive.every(r => !r.responder_id && !r.assigned_to && !r.responder_type && !r.accepted_at && r.last_expanded_at && r.updated_at));
  check('ban preserves rescued and completed cases', bannedCases.slice(2).every((id, index) =>
    assertRecoveredCase(id, ['rescued', 'completed'][index]).status === ['rescued', 'completed'][index]));
  check('ban adds reassignment timeline events', lifecycleDb.prepare("SELECT COUNT(*) AS n FROM report_events WHERE report_id IN (?, ?) AND title = 'Responder Unavailable'").get(...bannedCases.slice(0, 2)).n === 2);

  const deletedRegistration = await call('POST', '/api/auth/register', {
    body: { name: 'Delete Lifecycle', username: 'dellife_' + Date.now().toString(36), password: 'secret1', role: 'responder', responderType: 'vet' }
  });
  const deletedCases = createResponderCases(deletedRegistration.data.user.id);
  check('delete responder request succeeds', (await call('DELETE', `/api/admin/users/${deletedRegistration.data.user.id}`, { token: admin })).status === 200);
  const deletedActive = deletedCases.slice(0, 2).map(id => assertRecoveredCase(id, 'reported'));
  check('delete reopens active cases and preserves reporters', deletedActive.every(r => !r.responder_id && r.reporter_id === reporterId && r.last_expanded_at && r.updated_at));
  check('delete preserves rescued and completed cases', deletedCases.slice(2).every((id, index) =>
    lifecycleDb.prepare('SELECT status FROM reports WHERE id = ?').get(id).status === ['rescued', 'completed'][index]));
  check('delete adds reassignment timeline events', lifecycleDb.prepare("SELECT COUNT(*) AS n FROM report_events WHERE report_id IN (?, ?) AND title = 'Responder Unavailable'").get(...deletedCases.slice(0, 2)).n === 2);

  const uname = 'smoke_' + Date.now().toString(36);
  r = await call('POST', '/api/auth/register', { body: { name: 'Smoke Test', username: uname, password: 'secret1', role: 'user' } });
  check('register user', r.status === 201 && !!r.data.token);
  check('duplicate username rejected', (await call('POST', '/api/auth/register', { body: { name: 'X Y', username: uname, password: 'secret1', role: 'user' } })).status === 409);
  check('username-available false when taken', (await call('GET', '/api/auth/username-available?username=' + uname)).data.available === false);
  const aname = 'adm_' + Date.now().toString(36);
  r = await call('POST', '/api/auth/register', { body: { name: 'Pending Admin', username: aname, password: 'secret1', role: 'admin' } });
  check('admin signup pending (no token)', r.status === 202 && !r.data.token);
  check('pending admin cannot log in', (await login(aname, 'secret1', 'admin')).status === 403);
  const pendingList = (await call('GET', '/api/admin/users', { token: admin })).data.users;
  const pend = pendingList.find(u => u.username === aname);
  check('pending admin visible to admin', !!pend);
  await call('PATCH', `/api/admin/users/${pend.id}/approve`, { token: admin });
  check('approved admin can log in', (await login(aname, 'secret1', 'admin')).status === 200);
  await call('PATCH', `/api/admin/users/${pend.id}/ban`, { token: admin });
  check('banned admin cannot log in', (await login(aname, 'secret1', 'admin')).status === 403);

  console.log('Report lifecycle');
  const before = (await call('GET', '/api/rewards', { token: user })).data.points;
  const form = new FormData();
  Object.entries({ type: 'Dog', severity: 'critical', desc: 'Smoke test: injured dog near the bus stop', loc: 'Test Street', lat: '13.08', lng: '80.27' }).forEach(([k, v]) => form.append(k, v));
  form.append('photo', new Blob([Buffer.from('89504e470d0a1a0a', 'hex')], { type: 'image/png' }), 'x.png');
  r = await call('POST', '/api/reports', { token: user, form });
  check('create report with photo', r.status === 201 && r.data.report.code.startsWith('SC-') && r.data.report.photo === `/api/reports/${r.data.report.id}/photo` && r.data.pointsOnRescue === 30, r.data);
  const id = r.data.report.id;
  const photo = await call('GET', r.data.report.photo, { token: user, raw: true });
  check('report owner can fetch protected photo', photo.status === 200 && photo.headers.get('content-type').startsWith('image/'));
  check('photo request requires authentication', (await call('GET', r.data.report.photo)).status === 401);
  check('photo is not publicly served as a static upload', (await call('GET', '/uploads/smoke-test-photo.png', { raw: true })).status === 404);
  const otherUser = (await login('user2', 'user456', 'user')).data.token;
  check('another reporter cannot fetch photo', (await call('GET', r.data.report.photo, { token: otherUser })).status === 403);
  check('invalid report rejected', (await call('POST', '/api/reports', { token: user, body: { type: 'Dog' } })).status === 400);
  const textForm = new FormData(); textForm.append('photo', new Blob(['hi'], { type: 'text/plain' }), 'x.txt');
  check('non-image upload rejected', (await call('POST', '/api/reports', { token: user, form: textForm })).status === 400);
  const uploadsDir = process.env.UPLOAD_DIR;
  const uploadedFiles = () => fs.readdirSync(uploadsDir).length;
  const filesBeforeInvalid = uploadedFiles();
  const invalidPhotoForm = new FormData();
  Object.entries({ type: 'Dog', severity: 'critical', desc: 'short', loc: 'Invalid report street' }).forEach(([k, v]) => invalidPhotoForm.append(k, v));
  invalidPhotoForm.append('photo', new Blob([Buffer.from('89504e470d0a1a0a', 'hex')], { type: 'image/png' }), 'invalid.png');
  check('invalid fields remove saved upload', (await call('POST', '/api/reports', { token: user, form: invalidPhotoForm })).status === 400 && uploadedFiles() === filesBeforeInvalid);

  const db = require('../src/db/database');
  const triggerName = 'smoke_fail_report_insert';
  db.exec(`CREATE TRIGGER ${triggerName} BEFORE INSERT ON reports BEGIN SELECT RAISE(FAIL, 'smoke insert failure'); END`);
  const filesBeforeDbFailure = uploadedFiles();
  const dbFailureForm = new FormData();
  Object.entries({ type: 'Dog', severity: 'critical', desc: 'Database failure photo cleanup test', loc: 'Failure street' }).forEach(([k, v]) => dbFailureForm.append(k, v));
  dbFailureForm.append('photo', new Blob([Buffer.from('89504e470d0a1a0a', 'hex')], { type: 'image/png' }), 'db-failure.png');
  const originalConsoleError = console.error;
  let failedInsert;
  try {
    console.error = () => {};
    failedInsert = await call('POST', '/api/reports', { token: user, form: dbFailureForm });
  } finally {
    console.error = originalConsoleError;
    db.exec(`DROP TRIGGER IF EXISTS ${triggerName}`);
  }
  check('database insertion failure removes saved upload', failedInsert.status === 500 && uploadedFiles() === filesBeforeDbFailure);

  const rateUser = (await call('POST', '/api/auth/register', { body: { name: 'Rate Limit Test', username: 'rate_' + Date.now().toString(36), password: 'secret1', role: 'user' } })).data;
  let successfulSubmissions = 0, rateLimited;
  for (let i = 0; i < 11; i++) {
    const result = await call('POST', '/api/reports', {
      token: rateUser.token,
      body: { type: 'Cat', severity: 'mild', desc: `Rate limit smoke submission ${i}`, loc: `Rate test street ${i}` }
    });
    if (result.status === 201) successfulSubmissions++;
    if (result.status === 429) rateLimited = result;
  }
  check('per-account report submission limit returns 429 after ten reports', successfulSubmissions === 10 && rateLimited && /Too many report submissions/.test(rateLimited.data.error));
  check('report submission limit is isolated per account', (await call('POST', '/api/reports', {
    token: otherUser,
    body: { type: 'Cat', severity: 'mild', desc: 'Second user remains allowed', loc: 'Other user street' }
  })).status === 201);

  r = await call('GET', '/api/reports/open', { token: resp });
  check('responder sees open case', r.data.reports.some(x => x.id === id));
  r = await call('GET', '/api/reports/open?lat=13.08&lng=80.27&nearby=1', { token: resp });
  check('nearby filter returns distance', r.data.reports.some(x => x.id === id && x.distanceKm !== null));
  r = await call('GET', '/api/reports/open?lat=28.6&lng=77.2&nearby=1', { token: resp });
  check('nearby filter excludes far cases', !r.data.reports.some(x => x.id === id));

  await new Promise(s => setTimeout(s, 8500));
  r = await call('GET', `/api/reports/${id}`, { token: user });
  check('radius auto-expanded by server (critical 5km -> 15km)', r.data.report.radiusKm === 15, r.data.report.radiusKm);
  check('expansion logged in timeline', r.data.report.timeline.some(t => t.s.startsWith('Radius expanded')));

  const resp2 = (await login('vol1', 'vol123', 'responder')).data.token;
  check('responder can fetch photo from open dispatch pool', (await call('GET', `/api/reports/${id}/photo`, { token: resp, raw: true })).status === 200);
  const [a1, a2] = await Promise.all([call('POST', `/api/reports/${id}/accept`, { token: resp }), call('POST', `/api/reports/${id}/accept`, { token: resp2 })]);
  check('only one responder can accept', [a1.status, a2.status].sort().join() === '200,409', [a1.status, a2.status]);
  const winner = a1.status === 200 ? resp : resp2, loser = winner === resp ? resp2 : resp;
  check('non-assigned responder cannot fetch another responder photo', (await call('GET', `/api/reports/${id}/photo`, { token: loser })).status === 403);
  check('assigned responder can fetch photo', (await call('GET', `/api/reports/${id}/photo`, { token: winner, raw: true })).status === 200);
  check('other responder cannot change status', (await call('POST', `/api/reports/${id}/status`, { token: loser, body: { status: 'onway' } })).status === 403);
  check('cannot skip a step', (await call('POST', `/api/reports/${id}/status`, { token: winner, body: { status: 'rescued' } })).status === 409);
  check('on the way', (await call('POST', `/api/reports/${id}/status`, { token: winner, body: { status: 'onway' } })).status === 200);
  r = await call('POST', `/api/reports/${id}/status`, { token: winner, body: { status: 'rescued' } });
  check('rescued awards 30 points', r.data.pointsAwarded === 30, r.data);
  check('points credited to reporter', (await call('GET', '/api/rewards', { token: user })).data.points === before + 30);
  check('completed', (await call('POST', `/api/reports/${id}/status`, { token: winner, body: { status: 'completed' } })).status === 200);
  check('points not paid twice', (await call('GET', '/api/rewards', { token: user })).data.points === before + 30);

  console.log('Drop and force dispatch');
  const f2 = new FormData(); Object.entries({ type: 'Cat', severity: 'mild', desc: 'Smoke test: stray kitten', loc: 'Test Lane' }).forEach(([k, v]) => f2.append(k, v));
  const noGps = await call('POST', '/api/reports', { token: user, form: f2 });
  const id2 = noGps.data.report.id;
  check('typed-address report created without GPS', noGps.status === 201 && noGps.data.report.lat === null && noGps.data.report.lng === null, noGps.data);
  check('report without GPS retains null coordinates', (await call('GET', `/api/reports/${id2}`, { token: user })).data.report.lat === null);
  check('typed-address report stays in general dispatch pool', (await call('GET', '/api/reports/open', { token: resp })).data.reports.some(x => x.id === id2));
  check('nearby filter excludes report without GPS coordinates', !(await call('GET', '/api/reports/open?lat=13.08&lng=80.27&nearby=1', { token: resp })).data.reports.some(x => x.id === id2));
  await call('POST', `/api/reports/${id2}/accept`, { token: resp });
  r = await call('POST', `/api/reports/${id2}/drop`, { token: resp });
  check('drop returns case to open pool', r.data.report.status === 'reported' && r.data.report.assignedTo === null);
  r = await call('POST', `/api/admin/reports/${id2}/dispatch`, { token: admin, body: { unit: 'General Mobile Unit' } });
  check('admin force dispatch', r.data.report.status === 'onway' && r.data.report.assignedTo === 'General Mobile Unit');
  check('admin deletes spam', (await call('DELETE', `/api/admin/reports/${id2}`, { token: admin })).status === 200);

  console.log('Donations, rewards, analytics, export');
  r = await call('POST', '/api/donations', { token: user, body: { amount: 250, ngo: 'Blue Cross of India', name: 'Smoke' } });
  check('donation claim created pending and unverified', r.status === 201 && r.data.donation.status === 'pending' && r.data.donation.verified === false && r.data.donation.verifiedAt === null);
  const pendingExport = await call('GET', '/api/admin/export/donations?format=json', { token: admin });
  check('pending claims are excluded from verified funds', pendingExport.data.summary.totalDonationsAmount === 0 && pendingExport.data.summary.pendingDonationAmount >= 250);
  check('user donation history reports pending status', (await call('GET', '/api/donations', { token: user })).data.donations.some(d => d.id === r.data.donation.id && d.status === 'pending'));
  check('bad amount rejected', (await call('POST', '/api/donations', { token: user, body: { amount: 0, ngo: 'Blue Cross of India' } })).status === 400);
  check('user cannot verify donation claim', (await call('PATCH', `/api/admin/donations/${r.data.donation.id}/verify`, { token: user, body: { evidenceReviewed: true } })).status === 403);
  check('admin must attest external evidence review', (await call('PATCH', `/api/admin/donations/${r.data.donation.id}/verify`, { token: admin })).status === 400);
  const verification = await call('PATCH', `/api/admin/donations/${r.data.donation.id}/verify`, { token: admin, body: { evidenceReviewed: true } });
  check('admin records verification timestamp', verification.status === 200 && verification.data.verified === true && !!verification.data.verifiedAt);
  check('already-verified claim cannot be re-verified', (await call('PATCH', `/api/admin/donations/${r.data.donation.id}/verify`, { token: admin, body: { evidenceReviewed: true } })).status === 409);
  const verifiedHistory = (await call('GET', '/api/donations', { token: user })).data.donations.find(d => d.id === r.data.donation.id);
  check('admin verification updates user history', verifiedHistory.status === 'verified' && verifiedHistory.verifiedAt === verification.data.verifiedAt);
  const verifiedExport = await call('GET', '/api/admin/export/donations?format=json', { token: admin });
  check('verified claim is included only after admin review', verifiedExport.data.summary.totalDonationsAmount === 250 && verifiedExport.data.summary.pendingDonationAmount === 500);
  const cert = await call('GET', '/api/rewards/certificate/50', { token: user, raw: true });
  check('certificate PDF for unlocked milestone', cert.status === 200 && (await cert.arrayBuffer()).byteLength > 1000 && cert.headers.get('content-type') === 'application/pdf');
  check('locked certificate refused', (await call('GET', '/api/rewards/certificate/1000', { token: (await call('POST', '/api/auth/register', { body: { name: 'Fresh User', username: 'fresh_' + Date.now().toString(36), password: 'secret1', role: 'user' } })).data.token })).status === 403);
  const wk = (await call('GET', '/api/analytics/weekly', { token: admin })).data;
  check('weekly analytics', Array.isArray(wk.heatmap) && wk.heatmap.length === 7 && typeof wk.kpis.avgResponseMin === 'number');
  const mo = (await call('GET', '/api/analytics/monthly', { token: admin })).data;
  check('monthly analytics (12 months)', mo.months.length === 12 && typeof mo.range.from === 'string' && mo.topMonths.length > 0);
  const bd = (await call('GET', '/api/analytics/breakdown', { token: admin })).data;
  check('breakdown analytics', bd.stacked.labels.length === 6 && bd.radius.critical.length === 4);
  for (const [cat, fmt] of [['weekly', 'csv'], ['donations', 'csv'], ['full', 'json'], ['monthly', 'ai'], ['analytics', 'pdf']]) {
    const x = await call('GET', `/api/admin/export/${cat}?format=${fmt}`, { token: admin, raw: true });
    check(`export ${cat}/${fmt}`, x.status === 200 && (await x.text()).length > 50);
  }
  check('unsupported format rejected', (await call('GET', '/api/admin/export/donations?format=xml', { token: admin })).status === 400);
  check('public stats', typeof (await call('GET', '/api/stats/public')).data.responders === 'number');

  console.log(`\n${pass} passed, ${fail} failed`);
  return fail ? 1 : 0;
}

if (require.main === module) {
  runSmokeTest().then(code => process.exit(code)).catch(e => { console.error(e); process.exit(1); });
}

module.exports = { runSmokeTest };
