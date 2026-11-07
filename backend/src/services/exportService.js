const db = require('../db/database');
const analytics = require('./analytics');
const { toCsv, escapeHtml: h, code } = require('../utils/helpers');
const { STATUS_LABELS } = require('../utils/constants');

const CATEGORIES = {
  weekly: { label: 'Weekly Report', title: 'Weekly Rescue Report', desc: "This week's rescue stats" },
  monthly: { label: 'Monthly Report', title: '30-Day Rescue Report', desc: 'Last 30 days of rescue data' },
  analytics: { label: 'Analytics / Data', title: 'Analytics & Breakdown Report', desc: 'All reports for breakdown analysis' },
  donations: { label: 'Donations', title: 'Donation Ledger', desc: 'All donation records' },
  full: { label: 'Full Platform', title: 'Full Platform Report', desc: 'Complete snapshot of reports, donations and users' }
};
const FORMATS = { weekly: ['csv', 'json', 'pdf', 'ai'], monthly: ['csv', 'json', 'pdf', 'ai'], analytics: ['csv', 'json', 'pdf', 'ai'], donations: ['csv', 'json', 'pdf', 'ai'], full: ['json', 'ai', 'csv', 'pdf'] };

const REPORTS = 'SELECT r.*, u.name AS reporter_name FROM reports r LEFT JOIN users u ON u.id = r.reporter_id';
const rescued = r => r.status === 'rescued' || r.status === 'completed';

function reportRows(cat) {
  if (cat === 'weekly') return db.prepare(`${REPORTS} WHERE r.created_at >= ? ORDER BY r.id DESC`).all(analytics.mondayUtc().toISOString());
  if (cat === 'monthly') return db.prepare(`${REPORTS} WHERE r.created_at >= ? ORDER BY r.id DESC`).all(new Date(Date.now() - 30 * 86400000).toISOString());
  return db.prepare(`${REPORTS} ORDER BY r.id DESC`).all();
}
const reportOut = r => ({ id: code(r.id), type: r.animal_type, severity: r.severity, status: r.status, location: r.location, description: r.description, assignedTo: r.assigned_to, reporter: r.reporter_name, timestamp: r.created_at });
const donationRows = () => db.prepare('SELECT * FROM donations ORDER BY id DESC').all();
const donationOut = d => ({
  ngo: d.ngo,
  amount: d.amount,
  donor: d.donor_name,
  date: d.created_at.slice(0, 10),
  status: d.verified ? 'verified' : 'pending',
  verified: !!d.verified,
  verifiedAt: d.verified_at || null
});
const userRows = () => db.prepare('SELECT id, username, name, role, status, points, created_at FROM users ORDER BY id').all();

function dataset(cat) {
  if (cat === 'donations') return { donations: donationRows().map(donationOut) };
  const out = { reports: reportRows(cat).map(reportOut) };
  if (cat === 'full') { out.donations = donationRows().map(donationOut); out.users = userRows(); }
  return out;
}

function summary(cat) {
  const rows = reportRows(cat), don = donationRows();
  return {
    totalReports: rows.length, rescued: rows.filter(rescued).length,
    critical: rows.filter(r => r.severity === 'critical').length, open: rows.filter(r => r.status === 'reported').length,
    totalDonations: don.length,
    pendingDonationClaims: don.filter(d => !d.verified).length,
    verifiedDonations: don.filter(d => d.verified).length,
    totalDonationsAmount: don.filter(d => d.verified).reduce((a, d) => a + d.amount, 0),
    pendingDonationAmount: don.filter(d => !d.verified).reduce((a, d) => a + d.amount, 0)
  };
}

const REPORT_HEAD = ['ID', 'Type', 'Severity', 'Status', 'Location', 'Description', 'AssignedTo', 'Reporter', 'Timestamp'];
const reportCsvRow = r => [r.id, r.type, r.severity, r.status, r.location, r.description, r.assignedTo || '-', r.reporter || '-', r.timestamp];

function toCsvFile(cat) {
  if (cat === 'donations') return toCsv(['NGO', 'Amount_INR', 'DonorName', 'Date', 'Status', 'VerifiedAt'], dataset(cat).donations.map(d => [d.ngo, d.amount, d.donor, d.date, d.status, d.verifiedAt || '']));
  return toCsv(REPORT_HEAD, dataset(cat).reports.map(reportCsvRow));
}

function toJsonFile(cat) {
  return JSON.stringify({ exportedAt: new Date().toISOString(), category: CATEGORIES[cat].label, summary: summary(cat), ...dataset(cat) }, null, 2);
}

function toAiPrompt(cat) {
  const s = summary(cat), d = dataset(cat);
  const rate = s.totalReports ? Math.round((s.rescued / s.totalReports) * 100) : 0;
  return `# StrayCare Platform - AI Analysis Request

## Platform Overview
StrayCare is a stray animal rescue coordination platform. The data below is the "${CATEGORIES[cat].label}" export.

## Key Metrics (as of ${new Date().toLocaleDateString('en-GB')})
- Total Reports Filed: ${s.totalReports}
- Animals Rescued: ${s.rescued} (${rate}% rescue rate)
- Critical Cases: ${s.critical}
- Currently Open/Unassigned: ${s.open}
- Payment Claims: ${s.totalDonations} (${s.verifiedDonations} marked verified after admin review; ₹${s.totalDonationsAmount} verified)
- Pending Claims: ${s.pendingDonationClaims} (₹${s.pendingDonationAmount} not included in verified funds)

## Recent Reports (sample)
${JSON.stringify((d.reports || []).slice(0, 5), null, 2)}

## Recent Donations (sample)
${JSON.stringify((d.donations || donationRows().map(donationOut)).slice(0, 5), null, 2)}

## Analysis Request
Based on the above data for our stray animal rescue platform, please:
1. Identify the top 3 operational strengths and weaknesses
2. Suggest 5 new features or improvements to increase rescue rates
3. Analyze donation patterns and suggest fundraising strategies
4. Identify any risk patterns in the critical case data
5. Recommend what additional data we should track for better insights
6. Suggest how we can better engage and retain our responder community

Please provide specific, actionable recommendations tailored to this animal welfare context.`;
}

// ---- Printable report (opened in a new tab, "Print / Save as PDF") ----
const PRINT_CSS = `*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F5F3EE;color:#1a1916;font-size:13px}
.page{max-width:900px;margin:0 auto;padding:2rem}.hdr{background:linear-gradient(135deg,#0a3d2e,#051f18);color:#fff;padding:1.5rem 2rem;border-radius:14px;margin-bottom:1.25rem}
.hdr h1{font-size:1.4rem;margin-bottom:4px}.hdr p{opacity:.65;font-size:12px}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:1.25rem}
.kpi{background:#fff;border-radius:12px;padding:16px;text-align:center;box-shadow:0 1px 6px rgba(0,0,0,.06)}.kpi .n{font-size:1.7rem;font-weight:700}.kpi .l{font-size:11px;color:#888;text-transform:uppercase;margin-top:4px}
.card{background:#fff;border-radius:12px;padding:1.25rem;margin-bottom:1.25rem;box-shadow:0 1px 6px rgba(0,0,0,.06)}.card-title{font-size:14px;font-weight:700;margin-bottom:12px}
table{width:100%;border-collapse:collapse;font-size:12px}th{background:#F5F3EE;text-align:left;padding:8px 10px;border-bottom:2px solid #E2E0DA}td{padding:7px 10px;border-bottom:1px solid #ECEAE4}
.heat{display:flex;gap:8px}.heat div{flex:1;text-align:center}.heat b{display:block;height:48px;line-height:48px;border-radius:6px;background:#A8DFCA;font-size:15px}
.bar{background:#E2E0DA;border-radius:4px;height:8px}.bar i{display:block;background:#1D9E75;height:100%;border-radius:4px}
.toolbar{position:fixed;top:14px;right:18px;display:flex;gap:8px;z-index:9}.toolbar button{border:none;border-radius:8px;padding:9px 16px;font-weight:600;cursor:pointer;color:#fff}
.footer{margin-top:1.5rem;font-size:11px;color:#aaa;text-align:center}
@media print{body{background:#fff}.toolbar{display:none}.hdr,.kpi,.heat b,.bar i{-webkit-print-color-adjust:exact;print-color-adjust:exact}.card{page-break-inside:avoid}}`;

function shell(title, sub, body) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${h(title)} — StrayCare</title><style>${PRINT_CSS}</style></head><body>
<div class="toolbar"><button id="btn-print" style="background:#0a3d2e">🖨️ Print / Save as PDF</button><button id="btn-close" style="background:#E24B4A">✕ Close</button></div>
<div class="page"><div class="hdr"><h1>${h(title)}</h1><p>StrayCare · Generated ${h(new Date().toLocaleString('en-GB'))} · ${h(sub)}</p></div>${body}
<div class="footer">StrayCare Platform Report · Confidential — Admin Only · ${new Date().toISOString().slice(0, 10)}</div></div></body></html>`;
}

const kpi = (n, l, color) => `<div class="kpi"><div class="n" style="color:${color}">${h(n)}</div><div class="l">${h(l)}</div></div>`;

function toPrintHtml(cat) {
  const info = CATEGORIES[cat];
  if (cat === 'donations') {
    const d = donationRows();
    const totalVerified = d.filter(x => x.verified).reduce((a, x) => a + x.amount, 0);
    const totalPending = d.filter(x => !x.verified).reduce((a, x) => a + x.amount, 0);
    const rows = d.slice(0, 100).map(x => `<tr><td>${h(x.ngo)}</td><td>₹${h(x.amount)}</td><td>${h(x.donor_name)}</td><td>${h(x.created_at.slice(0, 10))}</td><td>${x.verified ? `Admin marked verified${x.verified_at ? ` (${h(x.verified_at)})` : ' (timestamp not recorded)'}` : 'Pending manual review'}</td></tr>`).join('');
    return shell(info.title, `${d.length} records`,
      `<div class="kpis">${kpi(d.length, 'Payment Claims', '#185FA5')}${kpi('₹' + totalVerified, 'Admin-verified amount', '#1D9E75')}${kpi(d.filter(x => !x.verified).length, 'Pending review', '#BA7517')}${kpi('₹' + totalPending, 'Pending amount (not verified)', '#BA7517')}</div>
       <div class="card"><table><thead><tr><th>NGO</th><th>Amount</th><th>Donor</th><th>Date</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`);
  }
  const rows = reportRows(cat);
  const resc = rows.filter(rescued).length;
  const crit = rows.filter(r => r.severity === 'critical').length;
  let extra = '';
  if (cat === 'weekly') {
    const w = analytics.weekly(), max = Math.max(...w.heatmap, 1);
    extra = `<div class="card"><div class="card-title">🌡️ Daily Activity — Cases by Day</div><div class="heat">${w.heatmap.map((v, i) => `<div><b style="opacity:${0.35 + 0.65 * (v / max)}">${v}</b>${w.days[i]}</div>`).join('')}</div></div>
      <div class="card"><div class="card-title">🐾 Animal Type Distribution</div><table><thead><tr><th>Animal</th><th>Cases</th><th>%</th><th style="width:40%">Distribution</th></tr></thead><tbody>${w.animals.map(a => `<tr><td>${h(a.label)}</td><td>${a.value}</td><td>${a.percent}%</td><td><div class="bar"><i style="width:${a.percent}%"></i></div></td></tr>`).join('') || '<tr><td colspan="4">No cases this week</td></tr>'}</tbody></table></div>`;
  }
  const body = rows.slice(0, 100).map(r => `<tr><td>${code(r.id)}</td><td>${h(r.animal_type)}</td><td>${h(r.severity)}</td><td>${h(STATUS_LABELS[r.status])}</td><td>${h(r.location.slice(0, 40))}</td><td>${h(r.assigned_to || '—')}</td><td>${h(r.created_at.slice(0, 16).replace('T', ' '))}</td></tr>`).join('');
  return shell(info.title, `${rows.length} records`,
    `<div class="kpis">${kpi(rows.length, 'Total', '#185FA5')}${kpi(resc, 'Rescued', '#1D9E75')}${kpi(crit, 'Critical', '#E24B4A')}${kpi((rows.length ? Math.round((resc / rows.length) * 100) : 0) + '%', 'Rescue Rate', '#BA7517')}</div>${extra}
     <div class="card"><div class="card-title">📋 Case Records${rows.length > 100 ? ' (first 100 shown)' : ''}</div>${rows.length ? `<table><thead><tr><th>ID</th><th>Type</th><th>Severity</th><th>Status</th><th>Location</th><th>Assigned To</th><th>Created</th></tr></thead><tbody>${body}</tbody></table>` : '<p style="color:#888">No cases recorded for this period.</p>'}</div>`);
}

function preview(cat) {
  const d = dataset(cat);
  const s = summary(cat);
  return { category: cat, label: CATEGORIES[cat].label, desc: CATEGORIES[cat].desc, formats: FORMATS[cat], summary: s, sample: (d.reports || d.donations).slice(0, 3) };
}

module.exports = { CATEGORIES, FORMATS, toCsvFile, toJsonFile, toAiPrompt, toPrintHtml, preview };
