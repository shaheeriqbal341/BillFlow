const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    key: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, default: '' },
    monthlyPrice: { type: Number, required: true, min: 0, default: 0 },
    yearlyPrice: { type: Number, required: true, min: 0, default: 0 },
    limits: {
      invoices: { type: Number, min: 0, default: 20 },
      customers: { type: Number, min: 0, default: 20 },
      products: { type: Number, min: 0, default: 20 },
      staff: { type: Number, min: 0, default: 0 },
    },
    features: {
      basicReports: { type: Boolean, default: true },
      advancedReports: { type: Boolean, default: false },
      pdfDownloads: { type: Boolean, default: true },
      inventory: { type: Boolean, default: true },
      staffAccounts: { type: Boolean, default: false },
    },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, collection: 'subscriptionPlans' },
);

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
