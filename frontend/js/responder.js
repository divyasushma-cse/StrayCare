const me = requirePageRole('responder');
renderTopbar('responder');
let coords = null;

function setRespType(t) { api('/auth/me/responder-type', { method: 'PATCH', body: { responderType: t } }).then(() => notify('Responder type updated')).catch(e => notify(e.message, 'err')); }

function getCoords() {
  return new Promise(res => {
    if (coords) return res(coords);
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition(p => { coords = { lat: p.coords.latitude, lng: p.coords.longitude }; res(coords); }, () => res(null), { timeout: 8000 });
  });
}

async function loadResponder() {
  let q = '';
  if (document.getElementById('nearby-only')?.checked) {
    const c = await getCoords();
    if (c) q = `?nearby=1&lat=${c.lat}&lng=${c.lng}`;
    else { document.getElementById('nearby-only').checked = false; notify('Location unavailable — showing all requests', 'err'); }
  }
  const [open, active, stats] = await Promise.all([api('/reports/open' + q), api('/reports/assigned'), api('/reports/responder-stats')]);
  document.getElementById('rs-open').textContent = stats.open;
  document.getElementById('rs-accepted').textContent = stats.accepted;
  document.getElementById('rs-completed').textContent = stats.completed;
  document.getElementById('rs-critical').textContent = stats.critical;

  const reqEl = document.getElementById('resp-requests');
  document.getElementById('resp-request-count').textContent = `${open.reports.length} available`;
  reqEl.innerHTML = !open.reports.length
    ? `<div class="responder-empty"><span aria-hidden="true">🐾</span><strong>All clear for now</strong><p>No open requests nearby. Stay alert!</p></div>`
    : open.reports.map(r => `
    <article class="req-card ${r.severity === 'critical' ? 'crit-req' : esc(r.severity)}">
      <div class="req-card-top">
        <div class="req-card-title">
          <span class="req-animal-icon" aria-hidden="true">🐾</span>
          <div><h4>${esc(r.type)} needs help</h4></div>
        </div>
        <span class="req-radius">${r.distanceKm !== undefined ? `${r.distanceKm} km away` : `${r.radiusKm} km search radius`}</span>
      </div>
      <div class="req-card-badges">
        <span class="badge b-${esc(r.severity)}">${esc(r.severity)}</span>
        ${r.severity === 'critical' ? `<span class="badge b-critical req-priority">🚨 Priority</span>` : ''}
        <span class="req-age">Reported ${timeAgo(r.ts)}</span>
      </div>
      <div class="req-location">📍 ${esc(r.loc)}</div>
      ${r.hasCoordinates === false ? '<div class="req-no-gps">No GPS coordinates — excluded from Nearby-only results</div>' : ''}
      ${r.desc ? `<p class="req-description">${esc(r.desc)}</p>` : ''}
      <div class="req-card-footer"><span class="req-updated">Case ${esc(r.code)}</span><button class="btn btn-primary btn-sm" onclick="acceptCase(${Number(r.id)})">✓ Accept case</button></div>
    </article>`).join('');

  document.getElementById('resp-active').innerHTML = !active.reports.length
    ? `<div class="responder-empty responder-empty-small"><span aria-hidden="true">✨</span><strong>No active cases</strong><p>Accept an incoming request to start helping.</p></div>`
    : active.reports.map(r => `
    <article class="responder-active-card">
      <div class="responder-active-heading"><span class="responder-active-title">${esc(r.type)} — ${esc(r.code)}</span><span class="badge b-${esc(r.status)}">${statusLbl(r.status)}</span></div>
      <div class="req-location">📍 ${esc(r.loc)}</div>
      <div class="responder-active-actions">
        ${r.status === 'accepted' ? `<button class="btn btn-ghost btn-sm" onclick="updateStatus(${r.id},'onway')">🚗 On the Way</button> <button class="btn btn-danger btn-sm" onclick="dropCase(${r.id})">Drop Case</button>` : ''}
        ${r.status === 'onway' ? `<button class="btn btn-primary btn-sm" onclick="updateStatus(${r.id},'rescued')">🐾 Mark Rescued</button>` : ''}
        ${r.status === 'rescued' ? `<button class="btn btn-ghost btn-sm" onclick="updateStatus(${r.id},'completed')">✅ Completed</button>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="showTimeline(${Number(r.id)})">📋 Timeline</button>
      </div></article>`).join('');
}

async function act(path, body, okMsg) {
  try { const d = await api(path, { method: 'POST', body }); if (okMsg) notify(okMsg(d)); await loadResponder(); }
  catch (e) { notify(e.message, 'err'); loadResponder().catch(() => { }); }
}
const acceptCase = id => act(`/reports/${id}/accept`, {}, d => `✅ Case ${d.report.code} accepted!`);
const updateStatus = (id, status) => act(`/reports/${id}/status`, { status }, d => d.pointsAwarded ? `🐾 Case ${d.report.code} rescued — reporter earned ${d.pointsAwarded} pts` : `Case ${d.report.code} → ${statusLbl(d.report.status)}`);
const dropCase = id => confirm('Drop this case? It goes back to the open pool.') && act(`/reports/${id}/drop`, {}, d => `Case ${d.report.code} returned to the pool`);

if (me) {
  const sel = document.getElementById('resp-type'); if (sel && me.responderType) sel.value = me.responderType;
  loadResponder().catch(e => notify(e.message, 'err'));
  poll(loadResponder, 4000);
}
