function canAccessReport(user, report) {
  if (user.role === 'admin' || report.reporter_id === user.id) return true;
  return user.role === 'responder'
    && (report.status === 'reported' || report.responder_id === user.id);
}

module.exports = { canAccessReport };
