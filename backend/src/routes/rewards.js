const router = require('express').Router();
const PDFDocument = require('pdfkit');
const db = require('../db/database');
const { requireAuth, requireRole } = require('../middleware/auth');
const { HttpError } = require('../utils/helpers');
const { MILESTONES, POINTS } = require('../utils/constants');

router.use(requireAuth, requireRole('user'));

const pointsOf = id => db.prepare('SELECT points FROM users WHERE id = ?').get(id).points;

router.get('/', (req, res) => {
  const points = pointsOf(req.user.id);
  const unlocked = MILESTONES.filter(m => points >= m.pts);
  res.json({ points, level: unlocked.length ? unlocked[unlocked.length - 1] : null, milestones: MILESTONES, rules: POINTS });
});

router.get('/certificate/:pts', (req, res) => {
  const m = MILESTONES.find(x => x.pts === Number(req.params.pts));
  if (!m) throw new HttpError(404, 'Unknown milestone');
  if (pointsOf(req.user.id) < m.pts) throw new HttpError(403, 'Milestone not unlocked yet');

  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="straycare-certificate-${m.pts}.pdf"`);
  doc.pipe(res);
  const W = doc.page.width, H = doc.page.height;
  doc.rect(20, 20, W - 40, H - 40).lineWidth(3).stroke('#085041');
  doc.rect(30, 30, W - 60, H - 60).lineWidth(1).stroke('#1D9E75');
  doc.fillColor('#085041').font('Times-Bold').fontSize(40).text('StrayCare', 0, 90, { align: 'center' });
  doc.fillColor('#6B6A65').font('Helvetica').fontSize(13).text('RESCUE. HEAL. PROTECT.', 0, 140, { align: 'center', characterSpacing: 3 });
  doc.fillColor('#1C1B18').font('Times-Roman').fontSize(24).text('Certificate of Appreciation', 0, 200, { align: 'center' });
  doc.font('Helvetica').fontSize(14).fillColor('#6B6A65').text('This is proudly presented to', 0, 250, { align: 'center' });
  doc.font('Times-Bold').fontSize(36).fillColor('#1D9E75').text(req.user.name, 0, 280, { align: 'center' });
  doc.font('Helvetica').fontSize(14).fillColor('#1C1B18')
    .text(`for earning the "${m.label}" milestone with ${m.pts}+ rescue points`, 0, 340, { align: 'center' })
    .text('and helping animals in need.', 0, 362, { align: 'center' });
  doc.fontSize(11).fillColor('#9E9D98').text(`Issued ${new Date().toISOString().slice(0, 10)}`, 0, H - 90, { align: 'center' });
  doc.end();
});

module.exports = router;
