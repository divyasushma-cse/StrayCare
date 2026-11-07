const me = requirePageRole('admin');
renderTopbar('admin');
let units = [];
const reportPageSize = 20;
let reportPage = 1;
let reportHasMore = false;
let reportRows = [];
let reportFilters = { q: '', status: '', severity: '', realOnly: false };
document.querySelectorAll('#page-admin [role="tabpanel"]').forEach(panel => {
  panel.setAttribute('aria-hidden', String(!panel.classList.contains('active')));
});

if (me) {
  document.getElementById('adm-hero-sub').textContent = `Welcome back, ${me.name} — full system access granted`;
  document.getElementById('adm-badge').textContent = '⚡ ' + me.name;
  const clock = () => document.getElementById('adm-clock').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  clock(); setInterval(clock, 1000);
}

const emptyMsg = t => `<p style="font-size:13px;color:var(--text2);padding:0.5rem 0">${t}</p>`;

function adminCard(r) {
  const icon = { critical: '🚨', moderate: '⚠️', mild: '🌿' }[r.severity] || '📋';
  const bg = { critical: 'rgba(185,65,60,0.1)', moderate: 'rgba(148,98,15,0.1)', mild: 'rgba(22,125,104,0.1)' }[r.severity];
  const cls = { critical: 'crit', moderate: 'mod', mild: 'mild-row' }[r.severity] || '';
  return `<div class="adm-case-row ${cls}"><div class="adm-case-sev" style="background:${bg}">${icon}</div>
    <div class="adm-case-body"><div class="adm-case-title">${esc(r.type)} <span style="font-size:11px;color:var(--text3);font-family:'Outfit',sans-serif">${esc(r.code)}</span>${r.isDemo ? ' <span class="badge b-moderate demo-tag">DEMO</span>' : ''}</div>
      <div class="adm-case-meta">📍 ${esc(r.loc)} &nbsp;·&nbsp; ${timeAgo(r.ts)}${r.assignedTo ? ` &nbsp;·&nbsp; <span style="color:var(--g)">👤 ${esc(r.assignedTo)}</span>` : ` &nbsp;·&nbsp; <span style="color:var(--text3)">📡 ${r.radiusKm}km radius</span>`}</div></div>
    <div class="adm-case-actions"><span class="badge b-${esc(r.severity)}" style="font-size:11px">${esc(r.severity)}</span><span class="badge b-${esc(r.status)}" style="font-size:11px">${statusLbl(r.status)}</span>
      <button class="btn btn-ghost btn-sm" aria-label="View ${esc(r.code)} timeline" onclick="showTimeline(${Number(r.id)})">📋</button></div></div>`;
}

async function loadReportPage(page, append = false) {
  const params = new URLSearchParams({ page: String(page), limit: String(reportPageSize) });
  if (reportFilters.q) params.set('q', reportFilters.q);
  if (reportFilters.status) params.set('status', reportFilters.status);
  if (reportFilters.severity) params.set('severity', reportFilters.severity);
  if (reportFilters.realOnly) params.set('realOnly', '1');
  const result = await api('/admin/reports?' + params.toString());
  reportRows = append ? reportRows.concat(result.reports) : result.reports;
  reportPage = result.page;
  reportHasMore = result.hasMore;
  renderAdminReports(result.total);
}

function renderAdminReports(total) {
  document.getElementById('adm-all-count').textContent = `${total} reports`;
  document.getElementById('adm-all').innerHTML = reportRows.length ? reportRows.map(adminCard).join('') : emptyMsg('No reports match these filters.');
  document.getElementById('adm-case-pagination').innerHTML = `
    <span>Showing ${reportRows.length} of ${total}</span>
    ${reportHasMore ? '<button type="button" class="btn btn-ghost btn-sm" onclick="loadMoreAdminReports()">Load more reports</button>' : ''}`;
}

async function loadMoreAdminReports() {
  try { await loadReportPage(reportPage + 1, true); } catch (e) { notify(e.message, 'err'); }
}

async function loadLive({ refreshList = false, reset = false } = {}) {
  const requests = [
    api('/admin/summary'),
    api('/admin/reports?page=1&limit=8&severity=critical&status=active&realOnly=1')
  ];
  if (refreshList) {
    if (reset) {
      reportPage = 1;
      reportRows = [];
    }
    requests.push(loadReportPage(reportPage));
  }
  const [s, critical] = await Promise.all(requests);
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  const demoBadge = document.getElementById('adm-demo-badge');
  if (demoBadge) {
    demoBadge.hidden = !s.demoReports;
    demoBadge.textContent = s.demoReports ? `Demo data included · ${s.demoReports} reports` : '';
  }
  set('adm-total', s.total); set('adm-active', s.active); set('adm-rescued', s.rescued); set('adm-critical', s.critical);
  set('adm-status-open-n', s.open); set('adm-last-refresh', new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  set('adm-crit-count', critical.total);
  document.getElementById('adm-crits').innerHTML = critical.reports.length ? critical.reports.map(adminCard).join('') : emptyMsg('No real critical cases currently need action.');
}

async function loadDispatch() {
  if (!units.length) units = (await api('/admin/units')).units;
  const [{ reports }, { reports: oldest }, { donations }] = await Promise.all([
    api('/admin/reports?page=1&limit=100&realOnly=1'),
    api('/admin/reports/oldest-open'),
    api('/admin/donations?status=unverified')
  ]);
  const open = reports.filter(r => r.status === 'reported');
  document.getElementById('adm-stale-review').innerHTML = oldest.length ? oldest.map(r => `
    <div class="adm-review-row">
      <div class="adm-review-info">
        <strong>${esc(r.type)} <span>${esc(r.code)}</span></strong>
        <div>${esc(r.loc)}</div>
      </div>
      <div class="adm-review-age">Reported ${timeAgo(r.ts)}</div>
      <button class="btn btn-ghost btn-sm" onclick="showTimeline(${Number(r.id)})">Review case</button>
    </div>`).join('') : emptyMsg('No open reports need review.');
  document.getElementById('adm-override-list').innerHTML = open.length ? open.map(r => `
    <div style="padding:10px;background:var(--bg);border-radius:8px;margin-bottom:8px;border-left:3px solid ${r.severity === 'critical' ? 'var(--red)' : 'var(--amber)'}">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div><strong style="font-family:'Playfair Display',serif">${esc(r.type)} ${esc(r.code)}</strong> ${r.isDemo ? '<span class="badge b-moderate demo-tag">DEMO</span>' : ''} — <span class="badge b-${esc(r.severity)}">${esc(r.severity)}</span><div style="font-size:12px;color:var(--text2);margin-top:2px">📍 ${esc(r.loc)}</div></div>
        <div style="display:flex;gap:6px"><select id="force-assign-${r.id}" style="padding:4px;font-size:12px;border-radius:4px;outline:none;border:1px solid var(--border)">${units.map(u => `<option>${esc(u)}</option>`).join('')}</select>
          <button class="btn btn-danger btn-sm" onclick="forceDispatch(${r.id})">Deploy Unit</button></div></div></div>`).join('') : '<p style="font-size:13px;color:var(--text2)">No open cases to dispatch.</p>';
  const mod = reports.filter(r => ['reported', 'accepted'].includes(r.status));
  document.getElementById('adm-spam-list').innerHTML = mod.length ? mod.map(r => `
    <div style="padding:8px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:13px"><strong style="color:var(--text)">${esc(r.code)}</strong> - ${esc(r.type)} ${r.isDemo ? '<span class="badge b-moderate demo-tag">DEMO</span>' : ''}<br><div style="font-size:11px;color:var(--text2);max-width:200px;text-overflow:ellipsis;white-space:nowrap;overflow:hidden">"${esc(r.desc)}"</div></div>
      <button class="btn btn-ghost btn-sm" style="color:var(--coral)" onclick="deleteSpam(${r.id},'${esc(r.code)}')">🗑️ Delete</button></div>`).join('') : '<p style="font-size:13px;color:var(--text2)">No reports to moderate.</p>';
  document.getElementById('adm-donation-verify').innerHTML = donations.length ? `
    <p style="font-size:12px;color:var(--text2);margin-bottom:8px">Review payment evidence outside StrayCare before marking a claim verified. This app does not independently confirm transfers.</p>
    ${donations.map(d => `
    <div style="padding:8px;background:var(--bg);border-radius:6px;margin-bottom:6px"><div style="display:flex;justify-content:space-between;align-items:center">
      <div><strong>₹${esc(d.amount)}</strong> from ${esc(d.name)}<div style="font-size:11px;color:var(--text2)">To: ${esc(d.ngo)}</div></div>
      <button class="btn btn-primary btn-sm" onclick="verifyDonation(${d.id},${Number(d.amount)})">Mark verified</button></div></div>`).join('')}` : '<p style="font-size:13px;color:var(--text2)">No pending payment claims.</p>';
}

async function adminAct(fn, okMsg, type) {
  try { await fn(); notify(okMsg, type); await Promise.all([loadDispatch(), loadLive({ refreshList: true, reset: true })]); } catch (e) { notify(e.message, 'err'); }
}
const forceDispatch = id => { const unit = document.getElementById('force-assign-' + id).value; adminAct(() => api(`/admin/reports/${id}/dispatch`, { method: 'POST', body: { unit } }), `🚨 Case SC-${id} forced dispatch to ${unit}!`); };
const deleteSpam = (id, code) => confirm('Permanently delete this report as SPAM?') && adminAct(() => api('/admin/reports/' + id, { method: 'DELETE' }), `Case ${code} deleted from database.`, 'err');
const verifyDonation = (id, amt) => confirm(`Have you reviewed external payment evidence for ₹${amt}? StrayCare does not verify transfers automatically.`)
  && adminAct(() => api(`/admin/donations/${id}/verify`, { method: 'PATCH', body: { evidenceReviewed: true } }), `Payment claim of ₹${amt} marked verified after admin review.`);

async function loadUsers() {
  const { users } = await api('/admin/users');
  const row = (u, btns, badge) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)"><div><span class="badge ${badge}">${esc(u.role)}</span>${u.isDemo ? ' <span class="badge b-moderate demo-tag">DEMO</span>' : ''}<strong style="font-size:14px;margin-left:8px">${esc(u.name)}</strong><div style="font-size:12px;color:var(--text2)">@${esc(u.username)}</div></div><div style="display:flex;gap:6px">${btns}</div></div>`;
  const pending = users.filter(u => u.status === 'pending'), rest = users.filter(u => u.status !== 'pending');
  document.getElementById('adm-pending-users').innerHTML = pending.map(u => row(u, `<button class="btn btn-primary btn-sm" onclick="userAct(${u.id},'approve')">Approve</button><button class="btn btn-danger btn-sm" onclick="userAct(${u.id},'reject')">Reject</button>`, 'b-moderate')).join('') || '<p style="font-size:13px;color:var(--text2)">No pending accounts</p>';
  document.getElementById('adm-active-responders').innerHTML = rest.map(u => u.id === me.id ? row(u, '<span style="font-size:12px;color:var(--text3)">You</span>', 'b-mild')
    : u.status === 'banned' ? row(u, `<span class="badge b-critical">banned</span><button class="btn btn-ghost btn-sm" onclick="userAct(${u.id},'approve')">Reinstate</button>`, 'b-completed')
      : row(u, `<button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="userAct(${u.id},'ban')">Ban / Revoke</button>`, 'b-mild')).join('') || '<p style="font-size:13px;color:var(--text2)">No users</p>';
}
async function userAct(id, what) {
  if (what === 'reject' && !confirm('Reject and delete this registration permanently?')) return;
  if (what === 'ban' && !confirm('Revoke this user\'s access immediately?')) return;
  try {
    if (what === 'approve') await api(`/admin/users/${id}/approve`, { method: 'PATCH' });
    if (what === 'ban') await api(`/admin/users/${id}/ban`, { method: 'PATCH' });
    if (what === 'reject') await api(`/admin/users/${id}`, { method: 'DELETE' });
    notify({ approve: 'Access approved!', ban: 'Access revoked.', reject: 'Registration removed.' }[what], what === 'approve' ? undefined : 'err');
    loadUsers();
  } catch (e) { notify(e.message, 'err'); }
}

const loaded = {};
document.getElementById('admin-case-filters')?.addEventListener('submit', event => {
  event.preventDefault();
  reportFilters = {
    q: document.getElementById('admin-case-search').value.trim(),
    status: document.getElementById('admin-case-status').value,
    severity: document.getElementById('admin-case-severity').value,
    realOnly: document.getElementById('admin-case-real-only').checked
  };
  loadLive({ refreshList: true, reset: true }).catch(e => notify(e.message, 'err'));
});

function resetAdminCaseFilters() {
  document.getElementById('admin-case-filters').reset();
  reportFilters = { q: '', status: '', severity: '', realOnly: false };
  loadLive({ refreshList: true, reset: true }).catch(e => notify(e.message, 'err'));
}

function viewCriticalCases() {
  document.getElementById('admin-case-search').value = '';
  document.getElementById('admin-case-status').value = 'active';
  document.getElementById('admin-case-severity').value = 'critical';
  document.getElementById('admin-case-real-only').checked = true;
  reportFilters = { q: '', status: 'active', severity: 'critical', realOnly: true };
  loadLive({ refreshList: true, reset: true }).then(() => {
    document.getElementById('admin-all-reports').scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('admin-case-status').focus({ preventScroll: true });
  }).catch(e => notify(e.message, 'err'));
}

function onSubtab(page, sub) {
  if (sub === 'live') loadLive({ refreshList: true, reset: true });
  if (sub === 'dispatch') loadDispatch();
  if (sub === 'users') loadUsers();
  if (sub === 'export') renderExportTab();
  const init = { weekly: initWeeklyCharts, monthly: initMonthlyCharts, breakdown: initBreakdownCharts }[sub];
  if (init) init().catch(e => notify(e.message, 'err')); // refetched on every open so numbers are never stale
}

if (me) { loadLive({ refreshList: true, reset: true }).catch(e => notify(e.message, 'err')); poll(() => document.getElementById('admin-live').classList.contains('active') ? loadLive() : Promise.resolve(), 5000); }
