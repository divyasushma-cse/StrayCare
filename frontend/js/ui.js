const ROLE_PAGE = { user: 'user-dashboard.html', responder: 'responder-dashboard.html', admin: 'admin-dashboard.html' };

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const statusLbl = s => ({ reported: 'Reported', accepted: 'Accepted', onway: 'On the Way', rescued: 'Rescued', completed: 'Completed' }[s] || s);
function timeAgo(d) { const s = Math.floor((Date.now() - new Date(d)) / 1000); if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + 'm ago'; if (s < 86400) return Math.floor(s / 3600) + 'h ago'; return Math.floor(s / 86400) + 'd ago'; }

function notify(msg, type) {
  const inn = document.getElementById('notif-inner'), wrap = document.getElementById('notif');
  if (!inn) return;
  inn.textContent = msg; inn.className = 'notif-inner' + (type ? ' ' + type : '');
  wrap.style.display = 'block'; clearTimeout(wrap._t); wrap._t = setTimeout(() => wrap.style.display = 'none', 3600);
}

function closeModal(e) { if (!e || e.target.id === 'modal-ov') document.getElementById('modal-ov').classList.remove('open'); }
function openModal(html) { document.getElementById('modal-box').innerHTML = html; document.getElementById('modal-ov').classList.add('open'); }

function goLogin(role) { location.href = 'login.html' + (role ? '?role=' + role : ''); }
function doLogout() { Session.clear(); location.href = 'home.html'; }

// Guard for dashboard pages: wrong/no session sends the visitor to sign in.
function requirePageRole(role) {
  const u = Session.user;
  if (!Session.token || !u) { goLogin(role); return null; }
  if (u.role !== role) { location.href = ROLE_PAGE[u.role]; return null; }
  return u;
}

function renderTopbar(active) {
  const el = document.getElementById('topbar'); if (!el) return;
  const u = Session.token ? Session.user : null;
  const nav = (id, label, href, extra = '') => `<button class="tnav ${active === id ? 'active' : ''}" onclick="location.href='${href}'">${label}${extra}</button>`;
  let items = nav('home', 'Home', 'home.html');
  if (!u) items += nav('user', 'Report', 'login.html?role=user') + nav('responder', 'Responder', 'login.html?role=responder') + nav('admin', 'Admin', 'login.html?role=admin');
  else {
    const label = { user: 'Report', responder: 'Responder', admin: 'Admin' }[u.role];
    items += nav(u.role, label, ROLE_PAGE[u.role], u.role === 'user' ? ' <span class="topbar-pill" id="badge-open" style="display:none">0</span>' : '');
  }
  const badge = u ? `<div id="user-badge" class="show"><div class="ub-avatar">${esc(u.name[0].toUpperCase())}</div><span class="ub-name">${esc(u.name)}</span><button id="logout-btn" onclick="doLogout()">✕ Logout</button></div>` : '';
  el.innerHTML = `<div class="brand" onclick="location.href='home.html'">Stray<em>Care</em></div><div class="topnav">${items}${badge}</div>`;
}

function switchSub(page, sub, el) {
  document.querySelectorAll(`#page-${page} .subtab`).forEach(s => s.classList.remove('active'));
  const t = document.getElementById(`${page}-${sub}`); if (t) t.classList.add('active');
  const row = el && el.closest('.tab-row');
  if (row) row.querySelectorAll('.tpill').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  if (typeof onSubtab === 'function') onSubtab(page, sub);
}

// Shared by user / responder / admin dashboards.
async function showTimeline(rid) {
  try {
    const { report: r } = await api('/reports/' + rid);
    const color = { critical: '#E24B4A', moderate: '#BA7517', mild: '#1D9E75' }[r.severity];
    const size = Math.min(r.radiusKm * 6, 170);
    openModal(`
    <div class="modal-hdr"><h3 style="font-size:1.1rem">${esc(r.type)} — ${esc(r.code)}</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div style="margin-bottom:1rem;display:flex;gap:7px;flex-wrap:wrap"><span class="badge b-${esc(r.severity)}">${esc(r.severity)}</span><span class="badge b-${esc(r.status)}">${statusLbl(r.status)}</span></div>
    <div class="map-sim" style="margin-bottom:1rem">
      <div style="font-size:12px;background:rgba(255,255,255,0.85);padding:4px 12px;border-radius:10px;color:#333">📍 ${esc(r.loc)}</div>
      <div class="map-pin inc-pin" style="top:48%;left:48%">🐾</div>
      ${r.assignedTo ? `<div class="map-pin resp-pin" style="top:35%;left:62%">✓<div class="map-lbl">Responder</div></div>` : ''}
      <div class="rad-circle" style="width:${size}px;height:${size}px;top:48%;left:48%;border-color:${color}"></div>
    </div>
    <div class="card-title">Case Timeline</div>
    <ul class="tl">${r.timeline.map(t => `<li><div class="tl-dot done"></div><div class="tl-txt"><strong>${esc(t.s)}</strong><span style="font-size:11px;color:var(--text3);display:block">${new Date(t.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>${esc(t.n)}</div></li>`).join('')}</ul>
    ${!['rescued', 'completed'].includes(r.status) ? `<hr class="div"><div style="font-size:13px;color:var(--text2)">${r.status === 'reported' ? `Searching for responders within ${r.radiusKm}km. Radius auto-expands until someone accepts.` : r.status === 'accepted' ? 'A responder has accepted and is navigating to the animal.' : 'Responder is on their way to the location.'}</div>` : ''}`);
  } catch (e) { notify(e.message, 'err'); }
}

// Polls only while the tab is visible.
function poll(fn, ms) { setInterval(() => { if (!document.hidden) fn().catch(() => { }); }, ms); }
