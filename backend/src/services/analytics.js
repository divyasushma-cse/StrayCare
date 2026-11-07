// SQL-backed replacements for the prototype's hard-coded chart numbers.
const db = require('../db/database');
const { ANIMAL_TYPES } = require('../utils/constants');

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const isRescued = r => r.status === 'rescued' || r.status === 'completed';
const dayIdx = d => (d.getUTCDay() + 6) % 7; // Mon = 0
const respMin = r => (r.accepted_at ? (new Date(r.accepted_at) - new Date(r.created_at)) / 60000 : null);
const avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const pct = (cur, prev) => (prev ? Math.round(((cur - prev) / prev) * 100) : null);
const round1 = n => Math.round(n * 10) / 10;

const since = iso => db.prepare('SELECT * FROM reports WHERE created_at >= ?').all(iso);
const between = (a, b) => db.prepare('SELECT * FROM reports WHERE created_at >= ? AND created_at < ?').all(a, b);

function mondayUtc(d = new Date()) {
  const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  m.setUTCDate(m.getUTCDate() - dayIdx(m));
  return m;
}

function weekly() {
  const mon = mondayUtc();
  const prevMon = new Date(mon); prevMon.setUTCDate(prevMon.getUTCDate() - 7);
  const rows = since(mon.toISOString());
  const prev = between(prevMon.toISOString(), mon.toISOString());

  const perDay = DAYS.map(() => ({ reports: 0, rescued: 0, critical: 0, resp: [] }));
  rows.forEach(r => {
    const d = perDay[dayIdx(new Date(r.created_at))];
    d.reports++; if (isRescued(r)) d.rescued++; if (r.severity === 'critical') d.critical++;
    const m = respMin(r); if (m !== null) d.resp.push(m);
  });
  const rescued = rows.filter(isRescued).length;
  const critical = rows.filter(r => r.severity === 'critical').length;
  const allResp = rows.map(respMin).filter(m => m !== null);
  const prevResp = prev.map(respMin).filter(m => m !== null);
  const rate = rows.length ? Math.round((rescued / rows.length) * 100) : 0;
  const prevRate = prev.length ? Math.round((prev.filter(isRescued).length / prev.length) * 100) : 0;

  const animals = ANIMAL_TYPES.map(t => ({ label: t, value: rows.filter(r => r.animal_type === t).length }))
    .filter(a => a.value).sort((a, b) => b.value - a.value)
    .map(a => ({ ...a, percent: Math.round((a.value / rows.length) * 100) }));

  const best = perDay.reduce((bi, d, i) => (d.rescued > perDay[bi].rescued ? i : bi), 0);
  const crit = perDay.reduce((bi, d, i) => (d.critical > perDay[bi].critical ? i : bi), 0);
  const respDays = perDay.map((d, i) => ({ i, v: avg(d.resp), n: d.resp.length })).filter(x => x.n);
  const fastest = respDays.length ? respDays.reduce((a, b) => (b.v < a.v ? b : a)) : null;

  return {
    range: { from: mon.toISOString().slice(0, 10) },
    days: DAYS,
    kpis: {
      reports: rows.length, rescued, critical, avgResponseMin: Math.round(avgOrZero(allResp)), rescueRate: rate,
      reportsDeltaPct: pct(rows.length, prev.length),
      rescueRateDelta: rate - prevRate,
      criticalDelta: critical - prev.filter(r => r.severity === 'critical').length,
      responseDeltaMin: prevResp.length && allResp.length ? Math.round(avg(prevResp) - avg(allResp)) : null
    },
    heatmap: perDay.map(d => d.reports),
    trend: { rescued: perDay.map(d => d.rescued), critical: perDay.map(d => d.critical), reports: perDay.map(d => d.reports) },
    severity: ['critical', 'moderate', 'mild'].map(s => rows.filter(r => r.severity === s).length),
    responseByDay: perDay.map(d => Math.round(avg(d.resp))),
    animals,
    highlights: {
      bestDay: perDay[best].rescued ? { day: DAYS[best], rescued: perDay[best].rescued } : null,
      fastest: fastest ? { day: DAYS[fastest.i], minutes: Math.round(fastest.v) } : null,
      mostCritical: perDay[crit].critical ? { day: DAYS[crit], count: perDay[crit].critical } : null,
      topAnimal: animals[0] ? { label: animals[0].label, percent: animals[0].percent, count: animals[0].value, total: rows.length } : null
    }
  };
}
function avgOrZero(a) { return a.length ? avg(a) : 0; }

function monthly() {
  const now = new Date();
  const buckets = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    buckets.push({ key: d.toISOString().slice(0, 7), label: MONTHS[d.getUTCMonth()], year: d.getUTCFullYear(), reports: 0, rescued: 0, critical: 0 });
  }
  const start = buckets[0].key + '-01T00:00:00.000Z';
  const rows = since(start);
  rows.forEach(r => {
    const b = buckets.find(x => x.key === r.created_at.slice(0, 7));
    if (!b) return;
    b.reports++; if (isRescued(r)) b.rescued++; if (r.severity === 'critical') b.critical++;
  });
  const sum = k => buckets.reduce((a, b) => a + b[k], 0);

  const prevStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 23, 1)).toISOString();
  const prevRows = between(prevStart, start);
  const prevRescued = prevRows.filter(isRescued).length;
  const prevCritical = prevRows.filter(r => r.severity === 'critical').length;
  const rate = sum('reports') ? Math.round((sum('rescued') / sum('reports')) * 100) : 0;
  const prevRate = prevRows.length ? Math.round((prevRescued / prevRows.length) * 100) : null;

  return {
    range: { from: buckets[0].label + ' ' + buckets[0].year, to: buckets[11].label + ' ' + buckets[11].year },
    months: buckets.map(b => b.label),
    kpis: {
      reports: sum('reports'), rescued: sum('rescued'), critical: sum('critical'), rescueRate: rate,
      reportsYoyPct: pct(sum('reports'), prevRows.length), rescuedYoyPct: pct(sum('rescued'), prevRescued),
      criticalYoyPct: pct(sum('critical'), prevCritical), rateDeltaPts: prevRate === null ? null : rate - prevRate
    },
    series: { reports: buckets.map(b => b.reports), rescued: buckets.map(b => b.rescued), critical: buckets.map(b => b.critical) },
    growth: buckets.map((b, i) => (i === 0 || !buckets[i - 1].reports ? null : Math.round(((b.reports - buckets[i - 1].reports) / buckets[i - 1].reports) * 100))),
    topMonths: buckets.map(b => ({ month: b.label, rescued: b.rescued })).sort((a, b) => b.rescued - a.rescued).slice(0, 5)
  };
}

function breakdown() {
  const rows = db.prepare('SELECT * FROM reports').all();
  const types = ANIMAL_TYPES;
  const stacked = {
    labels: types,
    rescued: types.map(t => rows.filter(r => r.animal_type === t && isRescued(r)).length),
    underTreatment: types.map(t => rows.filter(r => r.animal_type === t && ['accepted', 'onway'].includes(r.status)).length),
    criticalPending: types.map(t => rows.filter(r => r.animal_type === t && r.status === 'reported' && r.severity === 'critical').length)
  };

  const handled = rows.filter(r => ['ngo', 'vet', 'volunteer'].includes(r.responder_type));
  const shareLabels = { ngo: 'NGO', vet: 'Vet', volunteer: 'Volunteer' };
  const responderShare = Object.keys(shareLabels).map(k => {
    const n = handled.filter(r => r.responder_type === k).length;
    return { label: shareLabels[k], count: n, percent: handled.length ? Math.round((n / handled.length) * 100) : 0 };
  });

  const radius = ['critical', 'moderate', 'mild'].reduce((acc, s) => {
    acc[s] = [0, 1, 2, 3].map(l => rows.filter(r => r.severity === s && r.radius_level === l).length);
    return acc;
  }, {});

  // Insights
  const byDay = DAYS.map(() => ({ total: 0, rescued: 0, resp: [] }));
  rows.forEach(r => {
    const d = byDay[dayIdx(new Date(r.created_at))];
    d.total++; if (isRescued(r)) d.rescued++;
    const m = respMin(r); if (m !== null) d.resp.push(m);
  });
  const rates = byDay.map((d, i) => ({ i, v: d.total ? Math.round((d.rescued / d.total) * 100) : -1 }));
  const bestDay = rates.reduce((a, b) => (b.v > a.v ? b : a));
  const resp = byDay.map((d, i) => ({ i, v: avg(d.resp), n: d.resp.length })).filter(x => x.n);
  const slowest = resp.length ? resp.reduce((a, b) => (b.v > a.v ? b : a)) : null;
  const counts = types.map(t => ({ t, n: rows.filter(r => r.animal_type === t).length })).sort((a, b) => b.n - a.n);
  const crit = rows.filter(r => r.severity === 'critical');
  const critExpanded = crit.length ? Math.round((crit.filter(r => r.radius_level > 0).length / crit.length) * 100) : 0;
  const rescuedRows = rows.filter(r => r.rescued_at);
  const daysSpan = rescuedRows.length
    ? Math.max(1, Math.ceil((Date.now() - Math.min(...rescuedRows.map(r => new Date(r.created_at)))) / 86400000)) : 1;

  return {
    stacked, responderShare, radius,
    insights: {
      bestDay: bestDay.v >= 0 ? { day: DAYS[bestDay.i], ratePct: bestDay.v } : null,
      slowestDay: slowest ? { day: DAYS[slowest.i], minutes: Math.round(slowest.v) } : null,
      topAnimal: counts[0] && counts[0].n ? { label: counts[0].t, percent: Math.round((counts[0].n / rows.length) * 100) } : null,
      criticalRadiusExpandedPct: critExpanded,
      avgRescuesPerDay: round1(rows.filter(isRescued).length / daysSpan)
    }
  };
}

module.exports = { weekly, monthly, breakdown, mondayUtc, DAYS };
