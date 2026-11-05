const express = require('express');
const { protect, requireRole } = require('../middleware/auth');
const enforcePlanLimit = require('../middleware/enforcePlanLimit');
const requirePlanFeature = require('../middleware/requirePlanFeature');
const { getInvoices, createInvoice, getInvoiceById, cancelInvoice, downloadInvoicePdf } = require('../controllers/invoiceController');

const router = express.Router();

router.use(protect, requireRole('business_owner', 'staff'));
router.get('/', getInvoices);
router.post('/', enforcePlanLimit('invoices'), createInvoice);
router.get('/:id', getInvoiceById);
router.get('/:id/pdf', requirePlanFeature('pdfDownloads'), downloadInvoicePdf);
router.post('/:id/cancel', cancelInvoice);

module.exports = router;
