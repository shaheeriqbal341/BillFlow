const express = require('express');
const { protect, requireRole } = require('../middleware/auth');
const enforcePlanLimit = require('../middleware/enforcePlanLimit');
const { getProducts, createProduct, getProductById, updateProduct, deleteProduct } = require('../controllers/productController');

const router = express.Router();

router.use(protect, requireRole('business_owner', 'staff'));
router.get('/', getProducts);
router.post('/', enforcePlanLimit('products'), createProduct);
router.get('/:id', getProductById);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

module.exports = router;
