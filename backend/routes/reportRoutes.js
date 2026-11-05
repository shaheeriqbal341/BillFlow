const express = require('express');
const { protect, requireRole } = require('../middleware/auth');
const { getDashboard, getReports } = require('../controllers/reportController');

const router = express.Router();

router.use(protect, requireRole('business_owner', 'staff'));
router.get('/dashboard', getDashboard);
router.get('/', getReports);

module.exports = router;
