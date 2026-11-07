const router = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const a = require('../services/analytics');

router.use(requireAuth, requireRole('admin'));
router.get('/weekly', (req, res) => res.json(a.weekly()));
router.get('/monthly', (req, res) => res.json(a.monthly()));
router.get('/breakdown', (req, res) => res.json(a.breakdown()));

module.exports = router;
