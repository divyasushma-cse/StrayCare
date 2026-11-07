const me = requirePageRole('user');
renderTopbar('user');
let selSeverity = null, gps = null, NGO_UPI = {}, pendingDonation = null;
const reportPhotoUrls = new Map();
const reportPhotoLoads = new Map();
const MILESTONES = [{ pts: 50, label: 'First Rescuer', icon: '🐾' }, { pts: 200, label: 'Guardian', icon: '🛡️' }, { pts: 500, label: 'Hero', icon: '🌟' }, { pts: 1000, label: 'Legend', icon: '🏆' }];
const RADII_LEVELS = 4;

async function loadReportPhoto(img) {
  const id = img.dataset.photoReport;
  if (reportPhotoUrls.has(id)) { img.src = reportPhotoUrls.get(id); return; }
  if (!reportPhotoLoads.has(id)) {
    const loading = api(`/reports/${encodeURIComponent(id)}/photo`, { raw: true })
      .then(res => res.blob())
      .then(blob => {
        if (!blob.type.startsWith('image/')) throw new Error('Photo response is not an image');
        return URL.createObjectURL(blob);
      })
      .then(url => { reportPhotoUrls.set(id, url); return url; })
      .finally(() => reportPhotoLoads.delete(id));
    reportPhotoLoads.set(id, loading);
  }
  try { img.src = await reportPhotoLoads.get(id); }
  catch { img.hidden = true; img.alt = 'Photo unavailable'; }
}

// ---------- Report ----------
function previewPhoto(inp) {
  const f = inp.files[0]; if (!f) return;
  if (f.size > 5 * 1024 * 1024) { inp.value = ''; return notify('Photo must be under 5 MB', 'err'); }
  const url = URL.createObjectURL(f), ph = document.getElementById('photo-ph');
  ph.style.display = 'none';
  let img = document.getElementById('photo-prev');
  if (!img) { img = document.createElement('img'); img.id = 'photo-prev'; img.className = 'photo-prev'; ph.after(img); }
  img.src = url; img.onclick = () => inp.click();
}
function selSev(el) {
  document.querySelectorAll('.sev-opt').forEach(o => o.className = 'sev-opt');
  el.classList.add('sel-' + el.dataset.sev); selSeverity = el.dataset.sev;
}
function getGPS() {
  const msg = document.getElementById('gps-msg');
  if (!navigator.geolocation) { msg.style.color = 'var(--red)'; return msg.textContent = 'GPS not supported on this device'; }
  msg.style.color = 'var(--g)'; msg.textContent = '📡 Getting location...';
  navigator.geolocation.getCurrentPosition(async pos => {
    gps = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    let label = `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}`;
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${gps.lat}&lon=${gps.lng}`);
      const j = await r.json(); if (j.display_name) label = j.display_name.split(',').slice(0, 3).join(',');
    } catch { }
    document.getElementById('loc-inp').value = label;
    msg.textContent = '✓ Location captured';
  }, () => { msg.style.color = 'var(--red)'; msg.textContent = 'Could not get location. Please type it.'; }, { enableHighAccuracy: true, timeout: 10000 });
}
async function submitReport() {
  const type = document.getElementById('ani-type').value, desc = document.getElementById('ani-desc').value.trim(), loc = document.getElementById('loc-inp').value.trim();
  if (!type) return notify('Please select animal type', 'err');
  if (!selSeverity) return notify('Please select severity level', 'err');
  if (desc.length < 10) return notify("Please describe the animal's condition (at least 10 characters)", 'err');
  if (!loc) return notify('Please enter a location or tap GPS', 'err');
  const form = new FormData();
  form.append('type', type); form.append('severity', selSeverity); form.append('desc', desc); form.append('loc', loc);
  if (gps) { form.append('lat', gps.lat); form.append('lng', gps.lng); }
  const f = document.getElementById('photo-inp').files[0]; if (f) form.append('photo', f);
  try {
    const d = await api('/reports', { method: 'POST', form });
    notify(`✅ Report ${d.report.code} submitted! You'll earn ${d.pointsOnRescue} pts on rescue.`);
    ['ani-type', 'ani-desc', 'loc-inp'].forEach(id => document.getElementById(id).value = '');
    document.querySelectorAll('.sev-opt').forEach(o => o.className = 'sev-opt'); selSeverity = null; gps = null;
    document.getElementById('gps-msg').textContent = ''; document.getElementById('photo-inp').value = '';
    document.getElementById('photo-prev')?.remove(); document.getElementById('photo-ph').style.display = '';
    await loadMyReports();
    switchSub('user', 'myreports', document.querySelectorAll('#user-tabs .tpill')[1]);
  } catch (e) { notify(e.message, 'err'); }
}

// ---------- My reports ----------
async function loadMyReports() {
  const { reports } = await api('/reports/mine');
  const el = document.getElementById('my-reports-list');
  const open = reports.filter(r => r.status === 'reported').length, badge = document.getElementById('badge-open');
  if (badge) { badge.textContent = open; badge.style.display = open ? 'inline' : 'none'; }
  if (!reports.length) { el.innerHTML = `<p style="color:var(--text2);text-align:center;padding:3rem;font-size:14px">No reports yet — be the first to help an animal in need!</p>`; return; }
  el.innerHTML = reports.map(r => `
    <div class="rcard ${esc(r.severity)}" style="margin-bottom:0.75rem">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
        <div style="flex:1">
          <div class="rtitle">${esc(r.type)} — ${esc(r.code)}</div>
          <div class="rmeta"><span class="badge b-${esc(r.severity)}">${esc(r.severity)}</span><span class="badge b-${esc(r.status)}">${statusLbl(r.status)}</span>${r.isDemo ? '<span class="badge b-moderate demo-tag">DEMO DATA</span>' : ''}<span style="font-size:12px;color:var(--text3)">${timeAgo(r.ts)}</span></div>
          <div style="font-size:12px;color:var(--text2);margin-top:6px">📍 ${esc(r.loc)}</div>
          ${r.desc ? `<div style="font-size:13px;color:var(--text2);margin-top:4px">${esc(r.desc)}</div>` : ''}
          ${r.assignedTo ? `<div style="font-size:12px;color:var(--g);margin-top:6px;font-weight:500">✓ Assigned to: ${esc(r.assignedTo)}</div>` : ''}
        </div>
        ${r.photo ? `<img data-photo-report="${Number(r.id)}" alt="" style="width:62px;height:62px;border-radius:8px;object-fit:cover;flex-shrink:0">` : ''}
      </div>
      ${r.status === 'reported' ? `<div class="rbar"><div class="rbar-lbl"><span>Search radius</span><span>${r.radiusKm} km</span></div><div class="rbar-track"><div class="rbar-fill ${r.severity === 'critical' ? 'urg' : ''}" style="width:${(r.radiusLevel + 1) / RADII_LEVELS * 100}%"></div></div></div>` : ''}
      <button class="btn btn-ghost btn-sm" style="margin-top:10px" onclick="showTimeline(${Number(r.id)})">📋 View Timeline</button>
    </div>`).join('');
  el.querySelectorAll('img[data-photo-report]').forEach(loadReportPhoto);
}

window.addEventListener('pagehide', () => {
  reportPhotoUrls.forEach(url => URL.revokeObjectURL(url));
  reportPhotoUrls.clear();
});

// ---------- Rewards ----------
async function loadRewards() {
  const d = await api('/rewards'), pts = d.points;
  document.getElementById('pts-display').textContent = pts;
  document.getElementById('pts-level').innerHTML = d.level
    ? `<span class="badge" style="background:var(--amber-l);color:var(--amber-d);font-size:14px;padding:6px 16px">${esc(d.level.icon)} ${esc(d.level.label)}</span>`
    : `<span style="color:var(--text2);font-size:13px">Earn 50 points to unlock your first milestone!</span>`;
  document.getElementById('milestones-list').innerHTML = d.milestones.map(m => {
    const ok = pts >= m.pts;
    return `<div class="milestone-row"><div style="font-size:26px;opacity:${ok ? 1 : 0.3}">${esc(m.icon)}</div>
      <div style="flex:1"><div style="font-weight:500;color:${ok ? 'var(--text)' : 'var(--text2)'}">${esc(m.label)}</div><div style="font-size:12px;color:var(--text3)">${m.pts} points required</div></div>
      ${ok ? `<button class="btn btn-ghost btn-sm" onclick="downloadCertificate(${m.pts})">🏅 Download</button>` : `<span style="font-size:12px;color:var(--text3)">${m.pts - pts} pts to go</span>`}</div>`;
  }).join('');
}
async function downloadCertificate(pts) {
  try { const res = await api('/rewards/certificate/' + pts, { raw: true }); saveBlob(await res.blob(), `straycare-certificate-${pts}.pdf`); notify('🏅 Certificate downloaded!'); }
  catch (e) { notify(e.message, 'err'); }
}

// ---------- Donations ----------
function setDonate(amt) { document.getElementById('donate-amt').value = amt; }
function makeDonation() {
  const amt = parseFloat(document.getElementById('donate-amt').value), ngo = document.getElementById('donate-ngo').value;
  const name = document.getElementById('donate-name').value.trim() || me.name;
  if (!amt || amt < 1) return notify('Please enter a valid amount (minimum ₹1)', 'err');
  if (amt > 100000) return notify('Maximum donation amount is ₹1,00,000', 'err');
  showUpiModal(amt, ngo, name);
}
function showUpiModal(amt, ngo, name) {
  pendingDonation = { amt, ngo, name };
  const upiId = NGO_UPI[ngo] || 'straycare@upi';
  const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(ngo)}&am=${amt}&cu=INR&tn=${encodeURIComponent('StrayCare Donation')}`;
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(upiLink)}`;
  openModal(`
    <div class="modal-hdr"><h3 id="modal-title" style="font-size:1.1rem">Complete Donation — &#8377;${esc(amt)}</h3><button class="modal-close" aria-label="Close dialog" onclick="closeModal()">&#x2715;</button></div>
    <div class="upi-box">
      <div style="font-size:13px;color:var(--text2);margin-bottom:1rem">Payment to: <strong>${esc(ngo)}</strong></div>
      <div style="font-size:12px;color:var(--amber-d);margin-bottom:1rem">Submitting confirmation creates a pending payment claim. StrayCare does not process or automatically verify payments; an admin must review external payment evidence.</div>
      <div class="upi-qr-wrap" id="upi-qr-wrap"><img src="${qr}" width="140" height="140" alt="UPI QR Code" id="upi-qr-img"></div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:8px">Scan with any UPI app (PhonePe, GPay, Paytm&hellip;)</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:6px">&mdash; or pay using UPI ID &mdash;</div>
      <div class="upi-id-display">${esc(upiId)}</div>
      <ol class="upi-steps"><li>Open your UPI app (PhonePe / GPay / Paytm)</li><li>Scan QR code above <strong>or</strong> send to UPI ID above</li><li>Enter amount: <strong>&#8377;${esc(amt)}</strong></li><li>Use note: <em>StrayCare Donation</em></li><li>After payment, tap &ldquo;I&apos;ve Paid&rdquo; below</li></ol>
      <a href="${esc(upiLink)}" style="display:block;text-decoration:none;margin-bottom:10px"><button class="upi-confirm-btn" style="background:var(--blue)">&#128241; Open UPI App Directly</button></a>
      <button class="upi-confirm-btn" onclick="confirmDonation()">Submit payment claim for review</button>
    </div>`);
  const img = document.getElementById('upi-qr-img');
  if (img) img.onerror = () => { document.getElementById('upi-qr-wrap').innerHTML = '<div style="font-size:12px;color:var(--text2);text-align:center;padding:10px">QR unavailable<br>Use UPI ID below</div>'; };
}
async function confirmDonation() {
  if (!pendingDonation) return;
  const { amt, ngo, name } = pendingDonation;
  try {
    await api('/donations', { method: 'POST', body: { amount: amt, ngo, name } });
    pendingDonation = null; closeModal();
    document.getElementById('donate-amt').value = ''; document.getElementById('donate-name').value = '';
    notify(`Payment claim for ₹${amt} to ${ngo} submitted. It is pending admin review and is not counted as verified funds.`); loadDonations();
  } catch (e) { notify(e.message, 'err'); }
}
async function loadDonations() {
  const { donations } = await api('/donations'), el = document.getElementById('donate-hist');
  if (!donations.length) { el.innerHTML = `<p style="font-size:13px;color:var(--text2)">No donations yet</p>`; return; }
  el.innerHTML = donations.map(d => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:0.5px solid var(--border)">
      <div><div style="font-weight:500;display:flex;align-items:center;gap:6px">₹${esc(d.amount)} ${d.status === 'verified' ? '<span class="badge b-accepted" style="font-size:10px;padding:2px 6px">Admin reviewed ✓</span>' : '<span class="badge b-moderate" style="font-size:10px;padding:2px 6px">Pending verification</span>'}</div>
        <div style="font-size:12px;color:var(--text2)">${esc(d.ngo)}</div><div style="font-size:12px;color:var(--text3)">${esc(d.name)}</div></div>
      <span style="font-size:12px;color:var(--text3)">${esc(d.date)}</span></div>`).join('');
}

function onSubtab(page, sub) { if (sub === 'rewards') loadRewards(); if (sub === 'donate') loadDonations(); if (sub === 'myreports') loadMyReports(); }

if (me) {
  api('/donations/ngos').then(d => { d.ngos.forEach(n => NGO_UPI[n.name] = n.upi); }).catch(() => { });
  loadMyReports().catch(e => notify(e.message, 'err'));
  loadRewards().catch(() => { });
  poll(loadMyReports, 5000);
}
