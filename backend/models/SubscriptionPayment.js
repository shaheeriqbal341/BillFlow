const mongoose = require('mongoose');

const subscriptionPaymentSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true },
    planName: { type: String, required: true },
    billingCycle: { type: String, enum: ['monthly', 'yearly'], required: true },
    amount: { type: Number, min: 0, required: true },
    currency: { type: String, default: 'PKR' },
    method: { type: String, enum: ['manual', 'bank_transfer', 'cash', 'other'], default: 'manual' },
    reference: { type: String, required: true, trim: true },
    paymentDate: { type: Date, default: Date.now },
    proofDataUrl: { type: String, default: '' },
    notes: { type: String, trim: true, default: '', maxlength: 1000 },
    status: { type: String, enum: ['pending', 'reviewing', 'approved', 'rejected'], default: 'pending', index: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    internalNote: { type: String, default: '', maxlength: 1000 },
    rejectionReason: { type: String, default: '', maxlength: 1000 },
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', default: null },
  },
  { timestamps: true, collection: 'subscriptionPayments' },
);

module.exports = mongoose.model('SubscriptionPayment', subscriptionPaymentSchema);
