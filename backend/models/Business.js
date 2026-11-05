const mongoose = require('mongoose');
const BUSINESS_TYPES = require('../constants/businessTypes');

const businessSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: BUSINESS_TYPES, default: 'Retail' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    status: { type: String, enum: ['active', 'suspended'], default: 'active', index: true },
    logo: { type: String, default: '' },
    email: { type: String, trim: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    country: { type: String, trim: true, default: 'Pakistan' },
    currency: { type: String, default: 'PKR' },
    taxSettings: {
      enabled: { type: Boolean, default: true },
      rate: { type: Number, default: 0 },
    },
    invoiceSettings: {
      prefix: { type: String, default: 'INV' },
      numberingStart: { type: Number, default: 1 },
      defaultNotes: { type: String, default: '' },
    },
  },
  { timestamps: true, collection: 'businesses' },
);

module.exports = mongoose.model('Business', businessSchema);
