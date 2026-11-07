function recoverResponderCases(db, responderId, at = new Date().toISOString()) {
  const activeCases = db.prepare(`SELECT id FROM reports
    WHERE responder_id = ? AND status IN ('accepted', 'onway')`).all(responderId);
  const reopen = db.prepare(`UPDATE reports SET status = 'reported', assigned_to = NULL,
    responder_id = NULL, responder_type = NULL, accepted_at = NULL,
    last_expanded_at = ?, updated_at = ?
    WHERE id = ? AND responder_id = ? AND status IN ('accepted', 'onway')`);
  const addEvent = db.prepare(`INSERT INTO report_events (report_id, title, note, created_at)
    VALUES (?, 'Responder Unavailable', ?, ?)`);

  for (const report of activeCases) {
    const updated = reopen.run(at, at, report.id, responderId);
    if (updated.changes) {
      addEvent.run(report.id, 'Case returned to the dispatch pool because the assigned responder was removed or banned.', at);
    }
  }
  return activeCases.length;
}

module.exports = { recoverResponderCases };
