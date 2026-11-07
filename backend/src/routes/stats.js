const router = require('express').Router();
const db = require('../db/database');

// Public landing-page counters (replaces the prototype's hard-coded "+3 / +1 / 12").
router.get('/public', (req, res) => {
  const n = sql => db.prepare(sql).get().n;
  res.json({
    reportsToday: n("SELECT COUNT(*) n FROM reports WHERE date(created_at) = date('now')"),
    rescued: n("SELECT COUNT(*) n FROM reports WHERE status IN ('rescued','completed')"),
    responders: n("SELECT COUNT(*) n FROM users WHERE role = 'responder' AND status = 'active'")
  });
});

module.exports = router;
