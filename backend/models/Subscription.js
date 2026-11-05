const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    planName: { type: String, default: 'FREE' },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan', default: null },
    status: { type: String, enum: ['active', 'expired', 'trial', 'cancelled', 'pending'], default: 'active', index: true },
    startDate: { type: Date, default: Date.now },
    expiryDate: { type: Date },
    billingCycle: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
    renewalStatus: { type: String, enum: ['auto', 'manual', 'cancelled', 'expired'], default: 'manual' },
    cancelledAt: { type: Date, default: null },
    usageLimits: {
      invoices: { type: Number, default: 20 },
      customers: { type: Number, default: 20 },
      products: { type: Number, default: 20 },
      staff: { type: Number, default: 0 },
    },
    usage: {
      invoicesUsed: { type: Number, default: 0 },
      customersUsed: { type: Number, default: 0 },
      productsUsed: { type: Number, default: 0 },
      staffUsed: { type: Number, default: 0 },
      invoicePeriod: { type: Date, default: null },
    },
  },
  { timestamps: true, collection: 'subscriptions' },
);

module.exports = mongoose.model('Subscription', subscriptionSchema);
