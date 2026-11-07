const cOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: '#596B63', font: { size: 11 } } }, y: { grid: { color: 'rgba(18,63,53,0.08)' }, ticks: { color: '#596B63', font: { size: 11 } } } } };
const donutOpts = (cut) => ({ responsive: true, maintainAspectRatio: false, cutout: cut, plugins: { legend: { display: true, position: 'bottom', labels: { font: { size: 11 }, color: '#596B63', boxWidth: 10, padding: 10 } } } });
const charts = {};
function mk(id, cfg) { if (charts[id]) charts[id].destroy(); charts[id] = new Chart(document.getElementById(id), cfg); }
const line = (data, color, extra = {}) => ({ data, borderColor: color, tension: 0.4, pointBackgroundColor: color, pointRadius: 4, ...extra });
const kpiCard = (cls, icon, num, lbl, sub, color) => `<div class="adm-kpi ${cls}"><div class="adm-kpi-icon">${icon}</div><div class="adm-kpi-body"><div class="adm-kpi-num">${esc(num)}</div><div class="adm-kpi-lbl">${esc(lbl)}</div><div class="adm-kpi-sub" style="color:${color}">${esc(sub)}</div></div></div>`;
const arrow = n => (n === null || n === undefined ? '' : n >= 0 ? '▲ ' : '▼ ');
const tile = (bg, icon, color, title, sub) => `<div style="background:${bg};border-radius:8px;padding:10px 12px;display:flex;align-items:center;gap:10px"><span style="font-size:1.3rem">${icon}</span><div><div style="font-size:13px;font-weight:600;color:${color}">${esc(title)}</div><div style="font-size:12px;color:var(--text2)">${esc(sub)}</div></div></div>`;
const FULL = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };

async function initWeeklyCharts() {
  const w = await api('/analytics/weekly'), k = w.kpis;
  document.getElementById('wk-kpis').innerHTML =
    kpiCard('kpi-total', '📋', k.reports, 'Reports', k.reportsDeltaPct === null ? 'No data last week' : `${arrow(k.reportsDeltaPct)}${Math.abs(k.reportsDeltaPct)}% vs last wk`, 'var(--blue)') +
    kpiCard('kpi-rescued', '🐾', k.rescued, 'Rescued', `${k.rescueRate}% rescue rate (${k.rescueRateDelta >= 0 ? '+' : ''}${k.rescueRateDelta} pts)`, 'var(--g)') +
    kpiCard('kpi-critical', '🚨', k.critical, 'Critical', `${k.criticalDelta >= 0 ? '▲ ' + k.criticalDelta + ' more' : '▼ ' + Math.abs(k.criticalDelta) + ' fewer'} than last wk`, 'var(--red)') +
    kpiCard('kpi-active', '⏱️', k.avgResponseMin + 'm', 'Avg Response', k.responseDeltaMin === null ? 'No comparison yet' : `${k.responseDeltaMin >= 0 ? '▲ ' + k.responseDeltaMin + ' min faster' : '▼ ' + Math.abs(k.responseDeltaMin) + ' min slower'}`, 'var(--amber)');
  renderHeatmap(w);
  mk('wk-line', { type: 'line', data: { labels: w.days, datasets: [line(w.trend.rescued, '#167D68', { backgroundColor: 'rgba(22,125,104,0.08)', fill: true }), line(w.trend.critical, '#B9413C', { borderDash: [4, 3] }), line(w.trend.reports, '#94620F')] }, options: cOpts });
  mk('wk-sev', { type: 'doughnut', data: { labels: ['Critical', 'Moderate', 'Mild'], datasets: [{ data: w.severity, backgroundColor: ['#B9413C', '#94620F', '#167D68'], borderWidth: 0 }] }, options: donutOpts('65%') });
  mk('wk-resp', { type: 'bar', data: { labels: w.days, datasets: [{ data: w.responseByDay, backgroundColor: w.responseByDay.map(v => v > 18 ? '#B9413C' : '#167D68'), borderRadius: 4 }] }, options: cOpts });
  const max = Math.max(...w.animals.map(a => a.value), 1);
  document.getElementById('wk-animals').innerHTML = w.animals.length ? w.animals.map(a => `<div class="bar-row-h"><div class="bar-lbl">${esc(a.label)}</div><div class="bar-track"><div class="bar-fill" style="width:${a.value / max * 100}%;background:#167D68"></div></div><div class="bar-val">${a.value}</div><div style="font-size:11px;color:var(--text3);width:32px">${a.percent}%</div></div>`).join('') : '<p style="font-size:13px;color:var(--text2)">No cases this week yet.</p>';
  const h = w.highlights;
  document.getElementById('wk-highlights').innerHTML =
    (h.bestDay ? tile('var(--g3)', '🏆', 'var(--g2)', `Best Day: ${FULL[h.bestDay.day]}`, `${h.bestDay.rescued} animals rescued`) : '') +
    (h.fastest ? tile('var(--blue-l)', '⚡', 'var(--blue)', `Fastest Response: ${h.fastest.minutes} min`, FULL[h.fastest.day]) : '') +
    (h.mostCritical ? tile('var(--red-l)', '📡', 'var(--red-d)', `Most Critical: ${FULL[h.mostCritical.day]}`, `${h.mostCritical.count} critical cases in one day`) : '') +
    (h.topAnimal ? tile('var(--amber-l)', '🐕', 'var(--amber-d)', `Top Animal: ${h.topAnimal.label} (${h.topAnimal.percent}%)`, `${h.topAnimal.count} of ${h.topAnimal.total} total reports`) : '') || '<p style="font-size:13px;color:var(--text2)">Highlights appear once this week has activity.</p>';
}

function renderHeatmap(w) {
  const el = document.getElementById('wk-heatmap'); if (!el) return;
  const max = Math.max(...w.heatmap, 1);
  const color = v => { const t = v / max; return t === 0 ? '#E7ECE7' : t < 0.33 ? 'rgba(22,125,104,0.25)' : t < 0.66 ? 'rgba(22,125,104,0.55)' : '#167D68'; };
  el.innerHTML = w.heatmap.map((v, i) => `<div style="text-align:center"><div title="${w.days[i]}: ${v} cases" style="background:${color(v)};border-radius:6px;height:52px;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:${v / max > 0.5 ? '#fff' : 'var(--text)'}">${v}</div><div style="font-size:11px;color:var(--text2);margin-top:4px;font-weight:500">${w.days[i]}</div></div>`).join('');
}

async function initMonthlyCharts() {
  const m = await api('/analytics/monthly'), k = m.kpis;
  document.getElementById('mo-range').textContent = `${m.range.from} – ${m.range.to}`;
  document.getElementById('mo-yoy').textContent = k.reportsYoyPct === null ? 'First year of data' : `${arrow(k.reportsYoyPct)}${Math.abs(k.reportsYoyPct)}% YoY Growth`;
  const yoy = v => v === null ? 'No prior-year data' : `${arrow(v)}${Math.abs(v)}% YoY`;
  document.getElementById('mo-kpis').innerHTML =
    kpiCard('kpi-total', '📋', k.reports, '12-mo Reports', yoy(k.reportsYoyPct), 'var(--blue)') +
    kpiCard('kpi-rescued', '🐾', k.rescued, 'Rescued', yoy(k.rescuedYoyPct), 'var(--g)') +
    kpiCard('kpi-critical', '🚨', k.critical, 'Critical', yoy(k.criticalYoyPct), 'var(--red)') +
    kpiCard('kpi-active', '🎯', k.rescueRate + '%', 'Rescue Rate', k.rateDeltaPts === null ? 'No prior-year data' : `${arrow(k.rateDeltaPts)}${Math.abs(k.rateDeltaPts)} pts vs prior year`, 'var(--amber)');
  const s = m.series, pt = { ...{ pointRadius: 3 } };
  mk('mo-line', { type: 'line', data: { labels: m.months, datasets: [line(s.rescued, '#167D68', { ...pt, backgroundColor: 'rgba(22,125,104,0.08)', fill: true }), line(s.critical, '#B9413C', { ...pt, borderDash: [4, 3] }), line(s.reports, '#3E7090', pt)] }, options: cOpts });
  mk('mo-growth', { type: 'bar', data: { labels: m.months, datasets: [{ data: m.growth.map(v => v === null ? 0 : v), backgroundColor: m.growth.map(v => v === null ? '#D3D1C7' : v >= 0 ? '#167D68' : '#B9413C'), borderRadius: 3 }] }, options: { ...cOpts, scales: { ...cOpts.scales, y: { ...cOpts.scales.y, ticks: { ...cOpts.scales.y.ticks, callback: v => v + '%' } } } } });
  const top = m.topMonths, mx = Math.max(...top.map(t => t.rescued), 1);
  document.getElementById('mo-top').innerHTML = top.map((t, i) => `<div class="bar-row-h"><div style="width:20px;color:var(--text);font-weight:500;font-size:13px;flex-shrink:0">${i + 1}.</div><div style="width:28px;color:var(--text2);font-size:13px;flex-shrink:0">${esc(t.month)}</div><div class="bar-track"><div class="bar-fill" style="width:${t.rescued / mx * 100}%;background:#167D68"></div></div><div class="bar-val">${t.rescued}</div></div>`).join('');
}

async function initBreakdownCharts() {
  const b = await api('/analytics/breakdown'), i = b.insights, st = b.stacked;
  const box = (bg, icon, color, title, val) => `<div style="background:${bg};border-radius:10px;padding:12px 14px;display:flex;align-items:center;gap:10px"><span style="font-size:1.5rem">${icon}</span><div><div style="font-size:12px;font-weight:600;color:${color}">${title}</div><div style="font-size:13px;font-weight:700;color:var(--text)">${esc(val)}</div></div></div>`;
  const dash = '—';
  document.getElementById('bd-top').innerHTML =
    box('var(--g3)', '📅', 'var(--g2)', 'Best Day', i.bestDay ? `${i.bestDay.day}s · ${i.bestDay.ratePct}%` : dash) +
    box('var(--blue-l)', '🐕', 'var(--blue)', 'Top Animal', i.topAnimal ? `${i.topAnimal.label} · ${i.topAnimal.percent}%` : dash) +
    box('var(--amber-l)', '⏱️', 'var(--amber-d)', 'Slowest Day', i.slowestDay ? `${i.slowestDay.day}s · ${i.slowestDay.minutes} min` : dash) +
    box('var(--red-l)', '📡', 'var(--red-d)', 'Radius Expanded', `${i.criticalRadiusExpandedPct}% of critical`) +
    box('#F1EFE8', '🏥', 'var(--text2)', 'Avg/Day', `${i.avgRescuesPerDay} rescues`);
  mk('bd-stacked', { type: 'bar', data: { labels: st.labels, datasets: [{ label: 'Rescued', data: st.rescued, backgroundColor: '#167D68', borderRadius: 3 }, { label: 'Under treatment', data: st.underTreatment, backgroundColor: '#94620F' }, { label: 'Critical pending', data: st.criticalPending, backgroundColor: '#B9413C' }] }, options: { ...cOpts, scales: { x: { ...cOpts.scales.x, stacked: true }, y: { ...cOpts.scales.y, stacked: true } } } });
  mk('bd-donut', { type: 'doughnut', data: { labels: b.responderShare.map(r => `${r.label} ${r.percent}%`), datasets: [{ data: b.responderShare.map(r => r.count), backgroundColor: ['#123F35', '#167D68', '#A7E4CF'], borderWidth: 0 }] }, options: donutOpts('60%') });
  const rows = [['Best rescue rate', i.bestDay ? `${FULL[i.bestDay.day]}s — ${i.bestDay.ratePct}%` : dash, true], ['Slowest response', i.slowestDay ? `${FULL[i.slowestDay.day]}s, avg ${i.slowestDay.minutes} min` : dash, false], ['Top animal type', i.topAnimal ? `${i.topAnimal.label}s (${i.topAnimal.percent}% of total)` : dash, true], ['Radius expansions', `${i.criticalRadiusExpandedPct}% of critical cases`, false], ['Avg rescues/day', String(i.avgRescuesPerDay), true]];
  document.getElementById('bd-insights').innerHTML = rows.map(r => `<div class="insight-r"><span style="color:var(--text2)">${r[0]}</span><span style="font-weight:500;color:${r[2] ? '#0F6E56' : '#993C1D'}">${esc(r[1])}</span></div>`).join('');
  mk('bd-radius', { type: 'bar', data: { labels: ['No expansion', '1 expansion', '2 expansions', '3 expansions'], datasets: [{ label: 'Critical', data: b.radius.critical, backgroundColor: '#B9413C', borderRadius: 3 }, { label: 'Moderate', data: b.radius.moderate, backgroundColor: '#94620F', borderRadius: 3 }, { label: 'Mild', data: b.radius.mild, backgroundColor: '#167D68', borderRadius: 3 }] }, options: cOpts });
}
