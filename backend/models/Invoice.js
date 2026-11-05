const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0.01 },
    unitPrice: { type: Number, required: true, min: 0 },
    purchasePrice: { type: Number, min: 0 },
    unit: { type: String, default: 'pcs' },
    variantId: { type: String, default: '' },
    variantLabel: { type: String, default: '' },
    isService: { type: Boolean, default: false },
    productDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    lineTotal: { type: Number, required: true, default: 0 },
  },
  { _id: true },
);

const invoiceSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    invoiceNumber: { type: String, required: true },
    invoiceDate: { type: Date, default: Date.now },
    dueDate: { type: Date },
    items: [invoiceItemSchema],
    subtotal: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    remainingAmount: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: ['draft', 'issued', 'paid', 'partial', 'unpaid', 'overdue', 'cancelled'],
      default: 'draft',
    },
    paymentMethod: { type: String, default: 'Cash' },
    notes: { type: String, default: '' },
    stockAdjusted: { type: Boolean, default: false },
    cancelledAt: { type: Date },
  },
  { timestamps: true, collection: 'invoices' },
);

invoiceSchema.index({ businessId: 1, invoiceNumber: 1 }, { unique: true });

module.exports = mongoose.model('Invoice', invoiceSchema);
