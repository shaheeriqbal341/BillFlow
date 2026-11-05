const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null, index: true },
    amount: { type: Number, required: true },
    method: { type: String, enum: ['Cash', 'Bank Transfer', 'Card', 'Other'], default: 'Cash' },
    paymentDate: { type: Date, default: Date.now },
    referenceNumber: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  { timestamps: true, collection: 'payments' },
);

module.exports = mongoose.model('Payment', paymentSchema);
