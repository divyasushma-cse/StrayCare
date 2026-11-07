// Thin fetch wrapper. Only the JWT lives in localStorage; all data comes from the API.
const Session = {
  get token() { try { return localStorage.getItem('sc_token'); } catch { return null; } },
  get user() { try { return JSON.parse(localStorage.getItem('sc_user') || 'null'); } catch { return null; } },
  set(token, user) { try { localStorage.setItem('sc_token', token); localStorage.setItem('sc_user', JSON.stringify(user)); } catch { } },
  clear() { try { localStorage.removeItem('sc_token'); localStorage.removeItem('sc_user'); } catch { } }
};

async function api(path, { method = 'GET', body, form, raw } = {}) {
  const headers = {};
  if (Session.token) headers.Authorization = 'Bearer ' + Session.token;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(window.API_BASE + path, { method, headers, body: payload });
  if (raw) {
    if (!res.ok) throw await toError(res);
    return res;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && Session.token) { Session.clear(); location.href = 'login.html'; }
    const err = new Error(data.error || 'Request failed'); err.status = res.status; throw err;
  }
  return data;
}
async function toError(res) { const d = await res.json().catch(() => ({})); return new Error(d.error || 'Request failed'); }

function saveBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
