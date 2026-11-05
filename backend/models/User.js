const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ['super_admin', 'business_owner', 'staff'],
      default: 'business_owner',
    },
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
    status: { type: String, enum: ['active', 'inactive', 'pending'], default: 'active' },
  },
  { timestamps: true, collection: 'users' },
);

module.exports = mongoose.model('User', userSchema);
