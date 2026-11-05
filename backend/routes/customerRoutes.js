const express = require('express');
const { protect, requireRole } = require('../middleware/auth');
const enforcePlanLimit = require('../middleware/enforcePlanLimit');
const {
  getCustomers,
  createCustomer,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
} = require('../controllers/customerController');

const router = express.Router();

router.use(protect, requireRole('business_owner', 'staff'));
router.get('/', getCustomers);
router.post('/', enforcePlanLimit('customers'), createCustomer);
router.get('/:id', getCustomerById);
router.put('/:id', updateCustomer);
router.delete('/:id', deleteCustomer);

module.exports = router;
