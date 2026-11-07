const db = require('../db/database');

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const isRescued = r => r.status === 'rescued' || r.status === 'completed';
const dayIdx = d => (d.getDay() + 6) % 7; // Mon = 0
const pct = (cur, prev) => (prev ? Math.round(((cur - prev) / prev) * 100) : null);
const round1 = n => Math.round(n * 10) / 10;
const respMinutes = r => (r.accepted_at ? (new Date(r.accepted_at) - new Date(r.created_at)) / 60000 : null);
const avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

const rowsSince = iso => db.prepare(`SELECT id, animal_type, severity, status, radius_level, responder_type,
  created_at, accepted_at FROM reports WHERE created_at >= ? ORDER BY created_at`).all(iso);

function weekStart(offsetWeeks = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - dayIdx(d) + offsetWeeks * 7);
  return d;
}

function weekly() {
  const start = weekStart(0), prevStart = weekStart(-1);
  const all = rowsSince(prevStart.toISOString());
  const cur = all.filter(r => new Date(r.created_at) >= start);
  const prev = all.filter(r => new Date(r.created_at) < start);

  const days = DAYS.map(() => ({ reports: 0, rescued: 0, critical: 0, resp: [] }));
  cur.forEach(r => {
    const d = days[dayIdx(new Date(r.created_at))];
    d.reports++;
    if (isRescued(r)) d.rescued++;
    if (r.severity === 'critical') d.critical++;
    const m = respMinutes(r); if (m !== null) d.resp.push(m);
  });
  const responseByDay = days.map(d => round1(avg(d.resp)));

  const sev = { critical: 0, moderate: 0, mild: 0 };
  cur.forEach(r => sev[r.severity]++);

  const animalMap = {};
  cur.forEach(r => { animalMap[r.animal_type] = (animalMap[r.animal_type] || 0) + 1; });
  const animals = Object.entries(animalMap).map(([type, count]) => ({ type, count, pct: Math.round((count / cur.length) * 100) }))
    .sort((a, b) => b.count - a.count);

  const rescued = cur.filter(isRescued).length;
  const prevRescued = prev.filter(isRescued).length;
  const critical = cur.filter(r => r.severity === 'critical').length;
  const prevCritical = prev.filter(r => r.severity === 'critical').length;
  const allResp = cur.map(respMinutes).filter(v => v !== null);
  const prevResp = prev.map(respMinutes).filter(v => v !== null);

  const best = days.reduce((b, d, i) => (d.rescued > days[b].rescued ? i : b), 0);
  const mostCrit = days.reduce((b, d, i) => (d.critical > days[b].critical ? i : b), 0);
  const withResp = responseByDay.map((v, i) => ({ v, i })).filter(x => x.v > 0);
  const fastest = withResp.length ? withResp.reduce((a, b) => (b.v < a.v ? b : a)) : null;

  const fastestBy = fastest ? (() => {
    const names = { ngo: 'NGO Team', vet: 'Veterinarian', volunteer: 'Volunteer', admin: 'Admin dispatch' };
    const onDay = cur.filter(r => dayIdx(new Date(r.created_at)) === fastest.i && r.accepted_at && r.responder_type);
    if (!onDay.length) return null;
    const best = onDay.reduce((x, y) => (respMinutes(y) < respMinutes(x) ? y : x));
    return names[best.responder_type] || null;
  })() : null;

  return {
    kpis: {
      reports: cur.length, reportsDelta: pct(cur.length, prev.length),
      rescued, rescueRate: cur.length ? Math.round((rescued / cur.length) * 100) : 0,
      critical, criticalDiff: critical - prevCritical,
      avgResponse: round1(avg(allResp)),
      responseDiff: prevResp.length && allResp.length ? round1(avg(prevResp) - avg(allResp)) : null // + = faster
    },
    days: DAYS,
    perDay: { reports: days.map(d => d.reports), rescued: days.map(d => d.rescued), critical: days.map(d => d.critical), response: responseByDay },
    severity: sev,
    animals: animals.map(a => ({ label: a.type, count: a.count, pct: a.pct })),
    highlights: {
      bestDay: cur.length && days[best].rescued ? { day: DAYS[best], rescued: days[best].rescued } : null,
      fastest: fastest ? { day: DAYS[fastest.i], minutes: fastest.v, by: fastestBy } : null,
      mostCritical: cur.length && days[mostCrit].critical ? { day: DAYS[mostCrit], count: days[mostCrit].critical } : null,
      topAnimal: animals[0] ? { type: animals[0].type, pct: animals[0].pct, count: animals[0].count, total: cur.length } : null
    }
  };
}

function monthly() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 23, 1);
  const all = rowsSince(prevStart.toISOString());

  const buckets = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    return { key: d.getFullYear() * 12 + d.getMonth(), label: MONTHS[d.getMonth()], year: d.getFullYear(), reports: 0, rescued: 0, critical: 0 };
  });
  const prevTotals = { reports: 0, rescued: 0, critical: 0 };
  all.forEach(r => {
    const d = new Date(r.created_at);
    if (d < start) {
      prevTotals.reports++; if (isRescued(r)) prevTotals.rescued++; if (r.severity === 'critical') prevTotals.critical++;
      return;
    }
    const b = buckets.find(x => x.key === d.getFullYear() * 12 + d.getMonth());
    if (!b) return;
    b.reports++; if (isRescued(r)) b.rescued++; if (r.severity === 'critical') b.critical++;
  });

  const totals = buckets.reduce((t, b) => ({ reports: t.reports + b.reports, rescued: t.rescued + b.rescued, critical: t.critical + b.critical }),
    { reports: 0, rescued: 0, critical: 0 });
  const rate = totals.reports ? Math.round((totals.rescued / totals.reports) * 100) : 0;
  const prevRate = prevTotals.reports ? Math.round((prevTotals.rescued / prevTotals.reports) * 100) : null;
  const growth = buckets.map((b, i) => (i === 0 ? null : pct(b.reports, buckets[i - 1].reports)));

  return {
    period: `${buckets[0].label} ${buckets[0].year} – ${buckets[11].label} ${buckets[11].year}`,
    kpis: {
      reports: totals.reports, reportsYoy: pct(totals.reports, prevTotals.reports),
      rescued: totals.rescued, rescuedYoy: pct(totals.rescued, prevTotals.rescued),
      critical: totals.critical, criticalYoy: pct(totals.critical, prevTotals.critical),
      rescueRate: rate, rateDelta: prevRate === null ? null : rate - prevRate
    },
    labels: buckets.map(b => b.label),
    reports: buckets.map(b => b.reports),
    rescued: buckets.map(b => b.rescued),
    critical: buckets.map(b => b.critical),
    growth,
    top: buckets.map(b => ({ month: b.label, rescued: b.rescued })).sort((a, b) => b.rescued - a.rescued).slice(0, 5)
  };
}

function breakdown() {
  const rows = db.prepare(`SELECT animal_type, severity, status, radius_level, responder_type, created_at, accepted_at FROM reports`).all();
  const types = ['Dog', 'Cat', 'Bird', 'Cow', 'Horse', 'Other'];
  const stacked = {
    labels: types,
    rescued: types.map(t => rows.filter(r => r.animal_type === t && isRescued(r)).length),
    underTreatment: types.map(t => rows.filter(r => r.animal_type === t && (r.status === 'accepted' || r.status === 'onway')).length),
    criticalPending: types.map(t => rows.filter(r => r.animal_type === t && r.status === 'reported' && r.severity === 'critical').length)
  };

  const share = { ngo: 0, vet: 0, volunteer: 0 };
  rows.forEach(r => { if (share[r.responder_type] !== undefined) share[r.responder_type]++; });
  const shareTotal = share.ngo + share.vet + share.volunteer;

  const radius = { labels: ['No expansion', '1 expansion', '2 expansions', '3 expansions'] };
  ['critical', 'moderate', 'mild'].forEach(s => {
    radius[s] = [0, 1, 2, 3].map(l => rows.filter(r => r.severity === s && r.radius_level === l).length);
  });

  // Insights
  const byDay = DAYS.map(() => ({ total: 0, rescued: 0, resp: [] }));
  rows.forEach(r => {
    const d = byDay[dayIdx(new Date(r.created_at))];
    d.total++; if (isRescued(r)) d.rescued++;
    const m = respMinutes(r); if (m !== null) d.resp.push(m);
  });
  const rates = byDay.map((d, i) => ({ i, rate: d.total ? Math.round((d.rescued / d.total) * 100) : 0 }));
  const bestDay = rates.reduce((a, b) => (b.rate > a.rate ? b : a), rates[0]);
  const respAvgs = byDay.map((d, i) => ({ i, m: round1(avg(d.resp)) })).filter(x => x.m > 0);
  const slowest = respAvgs.length ? respAvgs.reduce((a, b) => (b.m > a.m ? b : a)) : null;

  const typeCount = {};
  rows.forEach(r => { typeCount[r.animal_type] = (typeCount[r.animal_type] || 0) + 1; });
  const topType = Object.entries(typeCount).sort((a, b) => b[1] - a[1])[0];

  const crit = rows.filter(r => r.severity === 'critical');
  const critExpanded = crit.length ? Math.round((crit.filter(r => r.radius_level > 0).length / crit.length) * 100) : 0;

  const rescuedRows = rows.filter(isRescued);
  const spanDays = rows.length ? Math.max(1, Math.ceil((Date.now() - Math.min(...rows.map(r => new Date(r.created_at).getTime()))) / 86400000)) : 1;

  return {
    outcomes: { labels: stacked.labels, rescued: stacked.rescued, underTreatment: stacked.underTreatment, criticalPending: stacked.criticalPending },
    responderShare: { ...share, total: shareTotal },
    radius,
    insights: {
      bestDay: rows.length ? { day: DAYS[bestDay.i], rate: bestDay.rate } : null,
      slowestDay: slowest ? { day: DAYS[slowest.i], minutes: slowest.m } : null,
      topAnimal: topType ? { type: topType[0], pct: Math.round((topType[1] / rows.length) * 100) } : null,
      criticalExpanded: critExpanded,
      avgRescuesPerDay: round1(rescuedRows.length / spanDays)
    }
  };
}

module.exports = { weekly, monthly, breakdown, weekStart, DAYS };
