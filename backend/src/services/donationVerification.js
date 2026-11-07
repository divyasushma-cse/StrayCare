function verifyDonation(db, donationId, adminId, { evidenceReviewed, verifiedAt = new Date().toISOString() } = {}) {
  if (evidenceReviewed !== true) return { status: 'evidence_required' };
  const updated = db.prepare(`UPDATE donations
    SET verified = 1, verified_by = ?, verified_at = ?
    WHERE id = ? AND verified = 0`).run(adminId, verifiedAt, donationId);

  if (updated.changes) return { status: 'verified', verifiedAt };
  const exists = db.prepare('SELECT 1 FROM donations WHERE id = ?').get(donationId);
  return { status: exists ? 'already_verified' : 'not_found' };
}

module.exports = { verifyDonation };
