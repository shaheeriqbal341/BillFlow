const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Business = require('../models/Business');
const Subscription = require('../models/Subscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const { ensureDefaultPlans } = require('../services/subscriptionService');
const BUSINESS_TYPES = require('../constants/businessTypes');

const generateToken = (userId) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const mobileTokenField = (req, user, token) => (
  req.headers?.['x-billflow-client'] === 'mobile' && ['business_owner', 'staff'].includes(user.role)
    ? { token }
    : {}
);

const register = async (req, res, next) => {
  try {
    const { fullName, email, password, businessName } = req.body;
    const businessType = req.body.businessType || 'General Retail Shop';
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!String(fullName || '').trim() || !normalizedEmail || !password || !String(businessName || '').trim()) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address' });
    }
    if (!BUSINESS_TYPES.includes(businessType) || businessType === 'Retail') {
      return res.status(400).json({ success: false, message: 'Select a valid business type' });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await ensureDefaultPlans();
    const freePlan = await SubscriptionPlan.findOne({ key: 'FREE' }).select('active limits');
    if (!freePlan || !freePlan.active) {
      return res.status(503).json({ success: false, message: 'Business registration is temporarily unavailable' });
    }
    const business = await Business.create({
      name: businessName,
      type: businessType,
      owner: null,
      email: normalizedEmail,
      currency: 'PKR',
    });

    const user = await User.create({
      fullName: String(fullName).trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: 'business_owner',
      businessId: business._id,
    });

    business.owner = user._id;
    await business.save();

    await Subscription.create({
      businessId: business._id,
      planName: 'FREE',
      status: 'active',
      planId: freePlan?._id || null,
      usageLimits: freePlan?.limits || { invoices: 20, customers: 20, products: 20, staff: 0 },
      usage: { invoicesUsed: 0, customersUsed: 0, productsUsed: 0 },
    });

    const token = generateToken(user._id);
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      success: true,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        businessId: user.businessId,
      },
      ...mobileTokenField(req, user, token),
      business: {
        id: business._id,
        name: business.name,
        type: business.type,
      },
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({
      email: String(email).trim().toLowerCase(),
    }).populate('businessId');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'This account is inactive' });
    }
    if (user.businessId?.status === 'suspended') {
      return res.status(403).json({ success: false, message: 'This business workspace is suspended' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = generateToken(user._id);
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        businessId: user.businessId?._id || user.businessId,
      },
      ...mobileTokenField(req, user, token),
      business: user.businessId ? { id: user.businessId._id, name: user.businessId.name, type: user.businessId.type } : null,
    });
  } catch (error) {
    next(error);
  }
};

const adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: String(email).trim().toLowerCase(), role: 'super_admin' });
    if (!user || user.status !== 'active' || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
    }

    const token = generateToken(user._id);
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      success: true,
      user: { id: user._id, fullName: user.fullName, email: user.email, role: user.role },
      business: null,
    });
  } catch (error) {
    return next(error);
  }
};

const logout = (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
  res.json({ success: true, message: 'Logged out successfully' });
};

const getProfile = async (req, res) => {
  const user = await User.findById(req.user._id).select('-password').populate('businessId');
  res.status(200).json({ success: true, user, business: user.businessId });
};

module.exports = { register, login, adminLogin, logout, getProfile };
