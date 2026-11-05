const express = require('express');
const { getBusinessProfile, updateBusinessProfile, getBusinessUsers, createBusinessStaff } = require('../controllers/businessController');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/me', protect, requireRole('business_owner', 'staff'), getBusinessProfile);
router.put('/me', protect, requireRole('business_owner'), updateBusinessProfile);
router.get('/users', protect, requireRole('business_owner'), getBusinessUsers);
router.post('/users', protect, requireRole('business_owner'), createBusinessStaff);

module.exports = router;
