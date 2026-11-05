const Business = require('../models/Business');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const { reserveUsageSlot, releaseUsageSlot } = require('../services/subscriptionService');
const BUSINESS_TYPES = require('../constants/businessTypes');
const validateImageDataUrl = require('../utils/validateImageDataUrl');
const bcrypt = require('bcryptjs');

const getBusinessProfile = async (req, res, next) => {
  try {
    const business = await Business.findById(req.businessId || req.user.businessId);
    if (!business) {
      return res.status(404).json({ success: false, message: 'Business not found' });
    }
    res.json({ success: true, business });
  } catch (error) {
    next(error);
  }
};

const updateBusinessProfile = async (req, res, next) => {
  try {
    const fields = ['name', 'type', 'logo', 'email', 'phone', 'address', 'city', 'country', 'currency', 'taxSettings', 'invoiceSettings'];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => fields.includes(key)),
    );
    if (updates.type && !BUSINESS_TYPES.includes(updates.type)) {
      return res.status(400).json({ success: false, message: 'Select a valid business type' });
    }
    if (updates.logo && !/^https?:\/\//i.test(updates.logo) && !validateImageDataUrl(updates.logo, { allowWebp: false })) {
      return res.status(400).json({ success: false, message: 'Logo must be an HTTP(S) URL or a valid PNG/JPEG image up to 1.8 MB' });
    }
    const business = await Business.findByIdAndUpdate(
      req.businessId || req.user.businessId,
      { $set: updates },
      { returnDocument: 'after', runValidators: true },
    );

    if (!business) {
      return res.status(404).json({ success: false, message: 'Business not found' });
    }

    res.json({ success: true, business });
  } catch (error) {
    next(error);
  }
};

const getBusinessUsers = async (req, res, next) => {
  try {
    const users = await User.find({ businessId: req.businessId }).select('-password');
    res.json({ success: true, users });
  } catch (error) {
    next(error);
  }
};

const createBusinessStaff = async (req, res, next) => {
  let reservation;
  let subscriptionId;
  try {
    if (req.user.role !== 'business_owner') {
      return res.status(403).json({ success: false, message: 'Only a business owner can create staff accounts' });
    }
    const { fullName, email, password } = req.body;
    if (!fullName || !email || !password || password.length < 8) {
      return res.status(400).json({ success: false, message: 'Name, email, and a password of at least 8 characters are required' });
    }
    const normalizedEmail = email.toLowerCase().trim();
    if (await User.exists({ email: normalizedEmail })) {
      return res.status(409).json({ success: false, message: 'Email is already registered' });
    }

    const subscription = await Subscription.findOne({ businessId: req.businessId });
    if (!subscription || subscription.status !== 'active' || (subscription.expiryDate && subscription.expiryDate <= new Date())) {
      return res.status(403).json({ success: false, message: 'An active subscription is required to add staff' });
    }
    const plan = subscription.planId ? await SubscriptionPlan.findById(subscription.planId).select('limits features active') : null;
    const staffLimit = plan?.limits.staff ?? subscription.usageLimits?.staff ?? 0;
    const staffEnabled = plan?.features.staffAccounts ?? staffLimit > 0;
    if (!staffEnabled) return res.status(403).json({ success: false, message: 'Staff accounts are not enabled for your plan' });
    subscriptionId = subscription._id;
    reservation = await reserveUsageSlot(subscription, 'staff', staffLimit);
    if (!reservation.reserved) return res.status(403).json({ success: false, message: `Your plan allows up to ${staffLimit} staff accounts` });

    const user = await User.create({
      fullName: fullName.trim(),
      email: normalizedEmail,
      password: await bcrypt.hash(password, 10),
      role: 'staff',
      businessId: req.businessId,
    });
    res.status(201).json({
      success: true,
      user: { id: user._id, fullName: user.fullName, email: user.email, role: user.role },
    });
  } catch (error) {
    if (reservation?.reserved) {
      await releaseUsageSlot(subscriptionId, reservation.usageField, reservation.periodStart);
    }
    next(error);
  }
};

module.exports = { getBusinessProfile, updateBusinessProfile, getBusinessUsers, createBusinessStaff };
