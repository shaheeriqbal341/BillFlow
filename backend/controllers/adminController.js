const mongoose = require('mongoose');
const User = require('../models/User');
const Business = require('../models/Business');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Subscription = require('../models/Subscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const SubscriptionPayment = require('../models/SubscriptionPayment');
const PaymentSettings = require('../models/PaymentSettings');
const AdminAuditLog = require('../models/AdminAuditLog');
const { ensureDefaultPlans, getExpiryDate, writeSubscriptionHistory } = require('../services/subscriptionService');
const auditAdminAction = require('../utils/auditAdminAction');

const getOverview = async (req, res, next) => {
  try {
    const now = new Date();
    const [businessCount, userCount, invoiceCount, activeSubscriptions, pendingPayments, invoicePaymentTotals, paidSubscriptionTotals] = await Promise.all([
      Business.countDocuments(),
      User.countDocuments({ role: { $ne: 'super_admin' } }),
      Invoice.countDocuments(),
      Subscription.countDocuments({ status: 'active', $or: [{ expiryDate: null }, { expiryDate: { $gt: now } }] }),
      SubscriptionPayment.countDocuments({ status: 'pending' }),
      Payment.aggregate([{ $match: { invoiceId: { $ne: null } } }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
      SubscriptionPayment.aggregate([{ $match: { status: 'approved' } }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    ]);

    const currentlyActive = { status: 'active', $or: [{ expiryDate: null }, { expiryDate: { $gt: now } }] };
    const [freeBusinesses, paidBusinesses] = await Promise.all([
      Subscription.countDocuments({ ...currentlyActive, planName: { $in: ['FREE', 'Free'] } }),
      Subscription.countDocuments({ ...currentlyActive, planName: { $nin: ['FREE', 'Free'] } }),
    ]);
    const invoicePayments = invoicePaymentTotals[0] || { total: 0, count: 0 };
    const subscriptionPayments = paidSubscriptionTotals[0] || { total: 0, count: 0 };

    res.json({
      success: true,
      overview: {
        businessCount,
        userCount,
        invoiceCount,
        activeSubscriptions,
        freeBusinesses,
        paidBusinesses,
        pendingPayments,
        paymentCount: invoicePayments.count + subscriptionPayments.count,
        paymentTotal: invoicePayments.total + subscriptionPayments.total,
      },
    });
  } catch (error) {
    next(error);
  }
};

const listBusinesses = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const filter = {};
    if (req.query.status && ['active', 'suspended'].includes(req.query.status)) filter.status = req.query.status;
    if (req.query.search) {
      const regex = new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: regex }, { email: regex }];
    }

    const [businesses, total] = await Promise.all([
      Business.find(filter)
        .select('name email phone status owner currency createdAt')
        .populate('owner', 'fullName email status')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Business.countDocuments(filter),
    ]);
    const businessIds = businesses.map((business) => business._id);
    const subscriptions = await Subscription.find({ businessId: { $in: businessIds } })
      .select('businessId planName status expiryDate billingCycle renewalStatus planId')
      .populate('planId', 'name key')
      .lean();
    const subscriptionByBusiness = new Map(subscriptions.map((sub) => [String(sub.businessId), sub]));

    res.json({
      success: true,
      businesses: businesses.map((business) => ({
        ...business,
        subscription: subscriptionByBusiness.get(String(business._id)) || null,
      })),
      page,
      pages: Math.ceil(total / limit),
      total,
    });
  } catch (error) {
    next(error);
  }
};

const getBusinessDetails = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid business ID' });
    const business = await Business.findById(req.params.id).populate('owner', 'fullName email status createdAt');
    if (!business) return res.status(404).json({ success: false, message: 'Business not found' });
    const [subscription, userCount, invoiceCount, payments] = await Promise.all([
      Subscription.findOne({ businessId: business._id }).populate('planId'),
      User.countDocuments({ businessId: business._id }),
      Invoice.countDocuments({ businessId: business._id }),
      SubscriptionPayment.find({ businessId: business._id }).select('-__v').sort({ createdAt: -1 }).limit(50),
    ]);
    res.json({ success: true, business, subscription, userCount, invoiceCount, payments });
  } catch (error) {
    next(error);
  }
};

const setBusinessStatus = async (req, res, next) => {
  try {
    const status = req.body.status;
    if (!['active', 'suspended'].includes(status)) return res.status(400).json({ success: false, message: 'Status must be active or suspended' });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid business ID' });
    const business = await Business.findByIdAndUpdate(req.params.id, { $set: { status } }, { returnDocument: 'after', runValidators: true });
    if (!business) return res.status(404).json({ success: false, message: 'Business not found' });
    await auditAdminAction(req, `business.${status}`, 'business', business._id, { name: business.name });
    res.json({ success: true, business });
  } catch (error) {
    next(error);
  }
};

const listPlans = async (req, res, next) => {
  try {
    await ensureDefaultPlans();
    const plans = await SubscriptionPlan.find().sort({ monthlyPrice: 1 }).lean();
    res.json({ success: true, plans });
  } catch (error) {
    next(error);
  }
};

const createPlan = async (req, res, next) => {
  try {
    const { name, key, monthlyPrice, yearlyPrice, limits, features, description } = req.body;
    if (!name || !key || !Number.isFinite(Number(monthlyPrice)) || !Number.isFinite(Number(yearlyPrice))) {
      return res.status(400).json({ success: false, message: 'Name, key, and valid monthly and yearly prices are required' });
    }
    const plan = await SubscriptionPlan.create({ name, key, monthlyPrice, yearlyPrice, limits, features, description });
    await auditAdminAction(req, 'plan.created', 'subscriptionPlan', plan._id, { key: plan.key });
    res.status(201).json({ success: true, plan });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'Plan name or key already exists' });
    next(error);
  }
};

const updatePlan = async (req, res, next) => {
  try {
    const allowed = ['name', 'description', 'monthlyPrice', 'yearlyPrice', 'limits', 'features', 'active'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    if (!Object.keys(updates).length) return res.status(400).json({ success: false, message: 'No editable plan fields provided' });
    const plan = await SubscriptionPlan.findByIdAndUpdate(req.params.id, { $set: updates }, { returnDocument: 'after', runValidators: true });
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    await auditAdminAction(req, 'plan.updated', 'subscriptionPlan', plan._id, { fields: Object.keys(updates) });
    res.json({ success: true, plan });
  } catch (error) {
    next(error);
  }
};

const listSubscriptionPayments = async (req, res, next) => {
  try {
    await SubscriptionPayment.updateMany(
      { status: 'reviewing', updatedAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) } },
      { $set: { status: 'pending', reviewedBy: null, reviewedAt: null } },
    );
    const filter = {};
    if (req.query.status && ['pending', 'approved', 'rejected'].includes(req.query.status)) filter.status = req.query.status;
    const payments = await SubscriptionPayment.find(filter)
      .populate({ path: 'businessId', select: 'name email status owner', populate: { path: 'owner', select: 'fullName email' } })
      .populate('planId', 'name key monthlyPrice yearlyPrice')
      .populate('reviewedBy', 'fullName email')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json({ success: true, payments });
  } catch (error) {
    next(error);
  }
};

const reviewSubscriptionPayment = async (req, res, next) => {
  try {
    const {
      decision,
      internalNote = '',
      rejectionReason = '',
    } = req.body;
    if (!['approved', 'rejected'].includes(decision)) return res.status(400).json({ success: false, message: 'Decision must be approved or rejected' });
    if (typeof internalNote !== 'string' || internalNote.length > 1000
      || typeof rejectionReason !== 'string' || rejectionReason.length > 1000) {
      return res.status(400).json({ success: false, message: 'Review notes must be 1000 characters or fewer' });
    }

    const payment = await SubscriptionPayment.findOneAndUpdate(
      { _id: req.params.id, status: 'pending' },
      { $set: { status: 'reviewing', reviewedBy: req.user._id } },
      { returnDocument: 'after' },
    );
    if (!payment) return res.status(409).json({ success: false, message: 'Payment is not pending or does not exist' });

    try {
      if (decision === 'approved') {
        const plan = await SubscriptionPlan.findById(payment.planId);
        const business = await Business.findById(payment.businessId);
        if (!plan || !plan.active || !business || business.status !== 'active') {
          throw new Error('The requested plan or business is no longer active');
        }
        const expectedAmount = payment.billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
        if (Number(payment.amount) !== Number(expectedAmount)) {
          throw Object.assign(new Error('Plan pricing changed after this request. Ask the business owner to submit a new payment request.'), { statusCode: 409 });
        }

        const now = new Date();
        let subscription = await Subscription.findOne({ businessId: payment.businessId });
        const oldPlanName = subscription?.planName;
        const startDate = subscription?.status === 'active' && subscription.expiryDate > now && subscription.planId?.equals(plan._id)
          ? subscription.expiryDate
          : now;
        const expiryDate = getExpiryDate(startDate, payment.billingCycle);
        const oldPlan = subscription?.planId
          ? await SubscriptionPlan.findById(subscription.planId).select('monthlyPrice')
          : null;
        const action = !subscription || !oldPlanName || oldPlanName === 'FREE'
          ? 'activated'
          : Number(plan.monthlyPrice) < Number(oldPlan?.monthlyPrice || 0)
            ? 'downgraded'
            : Number(plan.monthlyPrice) === Number(oldPlan?.monthlyPrice || 0)
              ? 'renewed'
              : 'upgraded';
        const snapshot = {
          planName: plan.key,
          planId: plan._id,
          status: 'active',
          startDate,
          expiryDate,
          billingCycle: payment.billingCycle,
          renewalStatus: 'manual',
          cancelledAt: null,
          usageLimits: plan.limits,
        };
        subscription = subscription
          ? await Subscription.findOneAndUpdate({ _id: subscription._id }, { $set: snapshot }, { returnDocument: 'after', runValidators: true })
          : await Subscription.create({ businessId: payment.businessId, ...snapshot });
        payment.subscriptionId = subscription._id;
        await writeSubscriptionHistory({
          businessId: payment.businessId,
          subscriptionId: subscription._id,
          planId: plan._id,
          planName: plan.name,
          billingCycle: payment.billingCycle,
          action,
          startsAt: startDate,
          endsAt: expiryDate,
          paymentId: payment._id,
        });
      }

      payment.status = decision;
      payment.reviewedAt = new Date();
      payment.internalNote = internalNote.trim();
      payment.rejectionReason = decision === 'rejected' ? rejectionReason.trim() : '';
      await payment.save();
    } catch (error) {
      await SubscriptionPayment.updateOne(
        { _id: payment._id, status: 'reviewing' },
        { $set: { status: 'pending', reviewedBy: null, reviewedAt: null, internalNote: '', rejectionReason: '' } },
      );
      throw error;
    }

    await auditAdminAction(req, `subscriptionPayment.${decision}`, 'subscriptionPayment', payment._id, {
      businessId: String(payment.businessId),
      amount: payment.amount,
    });
    res.json({ success: true, payment });
  } catch (error) {
    next(error);
  }
};

const getPaymentSettings = async (req, res, next) => {
  try {
    const settings = await PaymentSettings.findOne({ key: 'manual-subscription-payment' }).lean();
    res.json({
      success: true,
      settings: settings || { instructions: '', methods: ['bank_transfer', 'cash', 'other'] },
    });
  } catch (error) {
    next(error);
  }
};

const updatePaymentSettings = async (req, res, next) => {
  try {
    const { instructions, methods } = req.body;
    const allowedMethods = ['manual', 'bank_transfer', 'cash', 'other'];
    if (typeof instructions !== 'string' || instructions.length > 2000) {
      return res.status(400).json({ success: false, message: 'Payment instructions must be 2000 characters or fewer' });
    }
    if (!Array.isArray(methods) || !methods.length || methods.some((method) => !allowedMethods.includes(method))) {
      return res.status(400).json({ success: false, message: 'Select at least one supported manual payment method' });
    }
    const settings = await PaymentSettings.findOneAndUpdate(
      { key: 'manual-subscription-payment' },
      { $set: { instructions: instructions.trim(), methods: [...new Set(methods)] } },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
    );
    await auditAdminAction(req, 'paymentSettings.updated', 'paymentSettings', settings._id, { methods: settings.methods });
    res.json({ success: true, settings });
  } catch (error) {
    next(error);
  }
};

const getAuditLogs = async (req, res, next) => {
  try {
    const logs = await AdminAuditLog.find()
      .populate('actorId', 'fullName email')
      .sort({ createdAt: -1 })
      .limit(Math.min(200, Math.max(1, Number(req.query.limit) || 50)));
    res.json({ success: true, logs });
  } catch (error) {
    next(error);
  }
};

const listPaymentRecords = async (req, res, next) => {
  try {
    const [invoicePayments, subscriptionPayments] = await Promise.all([
      Payment.find({ invoiceId: { $ne: null } }).populate('businessId', 'name').populate('invoiceId', 'invoiceNumber').sort({ createdAt: -1 }).limit(100),
      SubscriptionPayment.find().populate('businessId', 'name').populate('planId', 'name').sort({ createdAt: -1 }).limit(100),
    ]);
    res.json({ success: true, invoicePayments, subscriptionPayments });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOverview,
  listBusinesses,
  getBusinessDetails,
  setBusinessStatus,
  listPlans,
  createPlan,
  updatePlan,
  listSubscriptionPayments,
  reviewSubscriptionPayment,
  getPaymentSettings,
  updatePaymentSettings,
  getAuditLogs,
  listPaymentRecords,
};
