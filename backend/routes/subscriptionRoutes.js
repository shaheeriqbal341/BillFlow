const express = require('express');
const { protect, requireRole } = require('../middleware/auth');
const {
  listPlans,
  getPaymentInstructions,
  getSubscription,
  requestSubscription,
  cancelSubscription,
  renewSubscription,
} = require('../controllers/subscriptionController');

const router = express.Router();

router.get('/plans', listPlans);
router.get('/payment-instructions', getPaymentInstructions);
router.use(protect, requireRole('business_owner', 'staff'));
router.get('/', getSubscription);
router.post('/request', requestSubscription);
router.post('/renew', renewSubscription);
router.post('/cancel', cancelSubscription);

module.exports = router;
