// Export center. Data is built server-side (GET /api/admin/export/:category?format=...).
let expCat = null;
const EXP_META = { weekly: ['📅', 'Weekly Report'], monthly: ['📆', 'Monthly Report'], analytics: ['📊', 'Analytics / Data'], donations: ['💳', 'Donations'], full: ['🗂️', 'Full Platform'] };
const FORMAT_BTNS = {
  csv: { label: '⬇️ Download CSV', bg: '#1D9E75' }, json: { label: '⬇️ Download JSON', bg: '#185FA5' },
  pdf: { label: '🖨️ Export as PDF', bg: '#6B4FBB' }, ai: { label: '🤖 AI Analysis Prompt', bg: '#E24B4A' }
};

async function selectExportCat(cat, el) {
  expCat = cat;
  document.querySelectorAll('.exp-cat-card').forEach(c => { c.style.border = '2px solid var(--border)'; c.style.background = 'var(--bg)'; c.style.boxShadow = 'none'; });
  el.style.border = '2px solid var(--g)'; el.style.background = 'var(--g3)'; el.style.boxShadow = '0 2px 12px rgba(29,158,117,0.15)';
  document.getElementById('exp-format-panel').style.display = 'block';
  try {
    const p = await api(`/admin/export/${cat}`);
    document.getElementById('exp-sel-label').textContent = `${EXP_META[cat][0]} ${p.label}`;
    document.getElementById('exp-format-grid').innerHTML = p.formats.map(f => `<button onclick="expExec('${cat}','${f}')" style="background:${FORMAT_BTNS[f].bg};color:#fff;border:none;border-radius:10px;padding:13px 8px;font-size:13px;font-weight:600;cursor:pointer">${FORMAT_BTNS[f].label}</button>`).join('');
    document.getElementById('exp-preview-lbl').textContent = p.desc;
    const s = p.summary, chip = (c, t) => `<span style="background:${c}20;color:${c};border:1px solid ${c}40;font-size:12px;font-weight:600;padding:3px 10px;border-radius:20px">${esc(t)}</span>`;
    document.getElementById('exp-summary-chips').innerHTML = cat === 'donations'
      ? chip('var(--g)', s.verifiedDonations + ' admin-verified claims') + chip('var(--blue)', '₹' + s.totalDonationsAmount + ' verified') + chip('var(--amber)', s.pendingDonationClaims + ' pending claims')
      : chip('var(--blue)', s.totalReports + ' reports') + chip('var(--g)', s.rescued + ' rescued') + chip('var(--red)', s.critical + ' critical');
    document.getElementById('exp-preview').textContent = JSON.stringify(p.sample, null, 2);
  } catch (e) { notify(e.message, 'err'); }
}

async function expExec(cat, fmt) {
  const stamp = new Date().toISOString().slice(0, 10);
  try {
    if (fmt === 'pdf') {
      const res = await api(`/admin/export/${cat}?format=pdf`, { raw: true });
      const url = URL.createObjectURL(new Blob([await res.text()], { type: 'text/html' }));
      const w = window.open(url);
      if (!w) return notify('Allow pop-ups to open the report', 'err');
      w.addEventListener('load', () => {
        w.document.getElementById('btn-print')?.addEventListener('click', () => w.print());
        w.document.getElementById('btn-close')?.addEventListener('click', () => w.close());
        setTimeout(() => w.print(), 400);
      });
      return;
    }
    const res = await api(`/admin/export/${cat}?format=${fmt}`, { raw: true });
    const blob = await res.blob();
    const ext = { csv: 'csv', json: 'json', ai: 'txt' }[fmt];
    saveBlob(blob, `straycare_${cat}_${stamp}.${ext}`);
    if (fmt === 'ai') { try { await navigator.clipboard.writeText(await blob.text()); notify('🤖 AI prompt downloaded and copied to clipboard'); } catch { notify('🤖 AI prompt downloaded'); } }
    else notify(`⬇️ ${EXP_META[cat][1]} exported as ${fmt.toUpperCase()}`);
  } catch (e) { notify(e.message, 'err'); }
}

function renderExportTab() {
  const snap = document.getElementById('exp-snap-time');
  if (snap) snap.textContent = 'Live · ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
