const mongoose = require('mongoose');

const paymentSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: 'manual-subscription-payment' },
    instructions: { type: String, trim: true, default: '' },
    methods: {
      type: [String],
      enum: ['manual', 'bank_transfer', 'cash', 'other'],
      default: ['bank_transfer', 'cash', 'other'],
    },
  },
  { timestamps: true, collection: 'paymentSettings' },
);

module.exports = mongoose.model('PaymentSettings', paymentSettingsSchema);
