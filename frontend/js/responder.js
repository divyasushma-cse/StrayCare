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
  reqEl.innerHTML = !open.reports.length
    ? `<p style="color:var(--text2);text-align:center;padding:1.5rem;font-size:13px">No open requests nearby. Stay alert!</p>`
    : open.reports.map(r => `
    <div class="req-card ${r.severity === 'critical' ? 'crit-req' : ''}" style="margin-bottom:0.75rem">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:6px">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-weight:600;font-family:'Playfair Display',serif">${esc(r.type)}</span><span class="badge b-${esc(r.severity)}">${esc(r.severity)}</span>
          ${r.severity === 'critical' ? `<span class="badge b-critical pulse">🚨 PRIORITY</span>` : ''}</div>
        <span style="font-size:12px;color:var(--coral);font-weight:500">~${r.radiusKm}km radius${r.distanceKm !== undefined ? ` · ${r.distanceKm}km away` : ''}</span>
      </div>
      <div style="font-size:13px;color:var(--text2);margin-bottom:4px">📍 ${esc(r.loc)}</div>
      ${r.hasCoordinates === false ? '<div style="font-size:11px;color:var(--text3);margin-bottom:6px">No GPS coordinates — not included in Nearby-only results</div>' : ''}
      ${r.desc ? `<div style="font-size:13px;color:var(--text2);margin-bottom:8px">${esc(r.desc)}</div>` : ''}
      <div style="display:flex;align-items:center;justify-content:space-between"><span style="font-size:12px;color:var(--text3)">${timeAgo(r.ts)}</span><button class="btn btn-primary btn-sm" onclick="acceptCase(${Number(r.id)})">✓ Accept</button></div>
    </div>`).join('');

  document.getElementById('resp-active').innerHTML = !active.reports.length
    ? `<p style="color:var(--text2);font-size:13px;padding:0.5rem 0">No active cases</p>`
    : active.reports.map(r => `
    <div style="background:var(--bg);border-radius:10px;padding:1rem;margin-bottom:0.75rem">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:6px"><span style="font-weight:500;font-family:'Playfair Display',serif">${esc(r.type)} — ${esc(r.code)}</span><span class="badge b-${esc(r.status)}">${statusLbl(r.status)}</span></div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:10px">📍 ${esc(r.loc)}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${r.status === 'accepted' ? `<button class="btn btn-ghost btn-sm" onclick="updateStatus(${r.id},'onway')">🚗 On the Way</button> <button class="btn btn-danger btn-sm" onclick="dropCase(${r.id})">Drop Case</button>` : ''}
        ${r.status === 'onway' ? `<button class="btn btn-primary btn-sm" onclick="updateStatus(${r.id},'rescued')">🐾 Mark Rescued</button>` : ''}
        ${r.status === 'rescued' ? `<button class="btn btn-ghost btn-sm" onclick="updateStatus(${r.id},'completed')">✅ Completed</button>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="showTimeline(${Number(r.id)})">📋 Timeline</button>
      </div></div>`).join('');
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
