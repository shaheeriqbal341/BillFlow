const express = require('express');
const { protect, requireRole } = require('../middleware/auth');
const { recordPayment, getPayments } = require('../controllers/paymentController');

const router = express.Router();

router.use(protect, requireRole('business_owner', 'staff'));
router.get('/', getPayments);
router.post('/', recordPayment);

module.exports = router;
