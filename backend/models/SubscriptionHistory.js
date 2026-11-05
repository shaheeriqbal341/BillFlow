const mongoose = require('mongoose');

const subscriptionHistorySchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', default: null },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan', default: null },
    planName: { type: String, required: true },
    billingCycle: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
    action: { type: String, enum: ['activated', 'renewed', 'upgraded', 'downgraded', 'cancelled', 'expired'], required: true },
    startsAt: { type: Date, default: Date.now },
    endsAt: { type: Date, default: null },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPayment', default: null },
  },
  { timestamps: true, collection: 'subscriptionHistory' },
);

module.exports = mongoose.model('SubscriptionHistory', subscriptionHistorySchema);
