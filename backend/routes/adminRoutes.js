const express = require('express');
const { protect, requireRole } = require('../middleware/auth');
const {
  getOverview,
  listBusinesses,
  getBusinessDetails,
  setBusinessStatus,
  listPlans,
  createPlan,
  updatePlan,
  listSubscriptionPayments,
  reviewSubscriptionPayment,
  getPaymentSettings,
  updatePaymentSettings,
  getAuditLogs,
  listPaymentRecords,
} = require('../controllers/adminController');

const router = express.Router();

router.use(protect, requireRole('super_admin'));

router.get('/overview', getOverview);
router.get('/businesses', listBusinesses);
router.get('/businesses/:id', getBusinessDetails);
router.patch('/businesses/:id/status', setBusinessStatus);
router.get('/plans', listPlans);
router.post('/plans', createPlan);
router.patch('/plans/:id', updatePlan);
router.get('/subscription-payments', listSubscriptionPayments);
router.patch('/subscription-payments/:id/review', reviewSubscriptionPayment);
router.get('/payment-settings', getPaymentSettings);
router.put('/payment-settings', updatePaymentSettings);
router.get('/payments', listPaymentRecords);
router.get('/audit-logs', getAuditLogs);

module.exports = router;
