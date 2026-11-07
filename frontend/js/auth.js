let selectedRole = null;
const qRole = new URLSearchParams(location.search).get('role');
if (Session.token && Session.user) location.replace(ROLE_PAGE[Session.user.role]);

const ROLE_INFO = {
  user: ['👤 User Login', 'Sign in to report and track animals'],
  responder: ['🏥 Responder Login', 'Access rescue requests in your area'],
  admin: ['⚙️ Admin Login', 'Authorised personnel only']
};
const show = (id, on) => { const e = document.getElementById(id); if (e) e.style.display = on ? 'block' : 'none'; };
const flash = (id, msg) => { const e = document.getElementById(id); if (!e) return; e.textContent = msg; e.classList.add('show'); };

function selectRole(el) {
  document.querySelectorAll('.role-opt').forEach(o => o.classList.remove('sel'));
  el.classList.add('sel'); selectedRole = el.dataset.role;
  document.getElementById('auth-err-role')?.classList.remove('show');
}
function proceedToLogin() {
  if (!selectedRole) return document.getElementById('auth-err-role').classList.add('show');
  show('auth-step1', false); show('auth-step2', true);
  document.getElementById('auth-step2-title').textContent = ROLE_INFO[selectedRole][0];
  document.getElementById('auth-step2-sub').textContent = ROLE_INFO[selectedRole][1];
  document.getElementById('auth-username').focus();
}
function backToRoles() { show('auth-step2', false); show('auth-step1', true); }
function goSignup() { location.href = 'signup.html?role=' + selectedRole; }

async function doLogin() {
  const username = document.getElementById('auth-username').value.trim();
  const password = document.getElementById('auth-password').value;
  const err = document.getElementById('auth-err-login'); err.classList.remove('show');
  if (!username || !password) return flash('auth-err-login', 'Please enter username and password.');
  const btn = document.getElementById('login-btn'); btn.disabled = true;
  try {
    const d = await api('/auth/login', { method: 'POST', body: { username, password, role: selectedRole } });
    Session.set(d.token, d.user);
    location.href = ROLE_PAGE[d.user.role];
  } catch (e) { flash('auth-err-login', e.message); btn.disabled = false; }
}

// ----- Sign-up -----
function selectSignupRole(el) {
  selectRole(el);
  show('signup-admin-note', selectedRole === 'admin');
  show('su-rtype-wrap', selectedRole === 'responder');
  clearSignupErr();
}
function clearSignupErr() { document.getElementById('auth-err-signup')?.classList.remove('show'); }
let unTimer;
function checkUsernameAvail() {
  const un = document.getElementById('su-username').value.trim(), icon = document.getElementById('su-user-icon');
  clearSignupErr(); clearTimeout(unTimer);
  if (!un) { icon.textContent = ''; return; }
  if (!/^[a-zA-Z0-9_]{4,20}$/.test(un)) { icon.textContent = '❌'; return; }
  unTimer = setTimeout(async () => {
    try { const d = await api('/auth/username-available?username=' + encodeURIComponent(un)); icon.textContent = d.available ? '✅' : '❌'; } catch { icon.textContent = ''; }
  }, 250);
}
function updatePwStrength() {
  const pw = document.getElementById('su-password').value, bar = document.getElementById('pw-strength-bar'), lbl = document.getElementById('pw-strength-lbl');
  let s = 0; if (pw.length >= 6) s++; if (pw.length >= 10) s++; if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++; if (/\d/.test(pw)) s++; if (/[^A-Za-z0-9]/.test(pw)) s++;
  const lv = [['', '#ECEAE4', 0], ['Weak', '#E24B4A', 25], ['Fair', '#BA7517', 50], ['Good', '#1D9E75', 75], ['Strong', '#085041', 100]][pw ? Math.min(Math.ceil(s * 4 / 5), 4) || 1 : 0];
  bar.style.background = `linear-gradient(to right, ${lv[1]} ${lv[2]}%, #ECEAE4 ${lv[2]}%)`; lbl.textContent = lv[0]; lbl.style.color = lv[1];
  checkPwMatch();
}
function checkPwMatch() {
  const a = document.getElementById('su-password').value, b = document.getElementById('su-password2').value, icon = document.getElementById('su-pw2-icon');
  icon.textContent = b ? (a === b ? '✅' : '❌') : '';
}
async function doSignup() {
  const role = selectedRole, name = document.getElementById('su-fullname').value.trim(), username = document.getElementById('su-username').value.trim();
  const password = document.getElementById('su-password').value, p2 = document.getElementById('su-password2').value;
  if (!role) return flash('auth-err-signup', 'Please select a role.');
  if (password !== p2) return flash('auth-err-signup', 'Passwords do not match.');
  const btn = document.getElementById('signup-btn'); btn.disabled = true;
  try {
    const d = await api('/auth/register', { method: 'POST', body: { name, username, password, role, responderType: document.getElementById('su-rtype').value } });
    if (d.pending) { notify('✅ ' + d.message); setTimeout(() => location.href = 'login.html?role=admin', 2200); return; }
    Session.set(d.token, d.user); location.href = ROLE_PAGE[d.user.role];
  } catch (e) { flash('auth-err-signup', e.message); btn.disabled = false; }
}

// Preselect role from ?role=
window.addEventListener('DOMContentLoaded', () => {
  if (!['user', 'responder', 'admin'].includes(qRole)) return;
  const el = document.querySelector(`.role-opt[data-role="${qRole}"]`);
  if (!el) return;
  if (document.getElementById('auth-step1')) { selectRole(el); proceedToLogin(); } else selectSignupRole(el);
});
