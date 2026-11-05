const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    notes: { type: String, default: '' },
  },
  { timestamps: true, collection: 'customers' },
);

module.exports = mongoose.model('Customer', customerSchema);
