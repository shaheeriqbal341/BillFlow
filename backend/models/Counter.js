const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, unique: true },
    counterType: { type: String, required: true, default: 'invoice' },
    currentSequence: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'counters' },
);

module.exports = mongoose.model('Counter', counterSchema);
