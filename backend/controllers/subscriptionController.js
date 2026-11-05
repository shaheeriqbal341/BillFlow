const Subscription = require('../models/Subscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const SubscriptionPayment = require('../models/SubscriptionPayment');
const SubscriptionHistory = require('../models/SubscriptionHistory');
const Business = require('../models/Business');
const PaymentSettings = require('../models/PaymentSettings');
const { ensureDefaultPlans, getExpiryDate, writeSubscriptionHistory, expireSubscriptionIfNeeded } = require('../services/subscriptionService');
const validateImageDataUrl = require('../utils/validateImageDataUrl');

const listPlans = async (req, res, next) => {
  try {
    await ensureDefaultPlans();
    const plans = await SubscriptionPlan.find({ active: true }).sort({ monthlyPrice: 1 }).lean();
    res.json({ success: true, plans });
  } catch (error) {
    next(error);
  }
};

const getPaymentInstructions = async (req, res, next) => {
  try {
    const settings = await PaymentSettings.findOne({ key: 'manual-subscription-payment' }).lean();
    res.json({
      success: true,
      instructions: settings?.instructions || 'Payment instructions have not been configured. Contact BillFlow support.',
      methods: settings?.methods?.length ? settings.methods : ['bank_transfer', 'cash', 'other'],
    });
  } catch (error) {
    next(error);
  }
};

const getSubscription = async (req, res, next) => {
  try {
    let subscription = await Subscription.findOne({ businessId: req.businessId }).populate('planId');
    subscription = await expireSubscriptionIfNeeded(subscription);
    const [payments, history] = await Promise.all([
      SubscriptionPayment.find({ businessId: req.businessId }).select('-internalNote -reviewedBy').populate('planId', 'name key').sort({ createdAt: -1 }).limit(50),
      SubscriptionHistory.find({ businessId: req.businessId }).sort({ createdAt: -1 }).limit(50),
    ]);
    res.json({ success: true, subscription, payments, history });
  } catch (error) {
    next(error);
  }
};

const requestSubscription = async (req, res, next) => {
  try {
    if (req.user.role !== 'business_owner') {
      return res.status(403).json({ success: false, message: 'Only a business owner can change subscriptions' });
    }

    const {
      planId,
      billingCycle = 'monthly',
      reference,
      method,
      amount: submittedAmount,
      paymentDate,
      proofDataUrl = '',
      notes = '',
    } = req.body;
    if (!['monthly', 'yearly'].includes(billingCycle)) {
      return res.status(400).json({ success: false, message: 'Billing cycle must be monthly or yearly' });
    }

    const plan = await SubscriptionPlan.findOne({ _id: planId, active: true });
    if (!plan) return res.status(404).json({ success: false, message: 'Active plan not found' });
    const business = await Business.findById(req.businessId);
    if (!business || business.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Business workspace is not active' });
    }
    const currentSubscription = await Subscription.findOne({ businessId: req.businessId });

    if (plan.key === 'FREE') {
      const now = new Date();
      const action = currentSubscription && currentSubscription.planName !== 'FREE' ? 'downgraded' : 'activated';
      const payload = {
        planName: plan.key,
        planId: plan._id,
        status: 'active',
        startDate: now,
        expiryDate: null,
        billingCycle: 'monthly',
        renewalStatus: 'manual',
        cancelledAt: null,
        usageLimits: plan.limits,
      };
      const subscription = currentSubscription
        ? await Subscription.findOneAndUpdate({ _id: currentSubscription._id }, { $set: payload }, { returnDocument: 'after', runValidators: true })
        : await Subscription.create({ businessId: req.businessId, ...payload });
      await writeSubscriptionHistory({
        businessId: req.businessId,
        subscriptionId: subscription._id,
        planId: plan._id,
        planName: plan.name,
        billingCycle: 'monthly',
        action,
        startsAt: now,
      });
      return res.json({ success: true, subscription, message: 'Free plan activated' });
    }

    if (typeof reference !== 'string' || reference.trim().length < 3 || reference.trim().length > 120) {
      return res.status(400).json({ success: false, message: 'Enter a payment reference (3 to 120 characters)' });
    }
    const pending = await SubscriptionPayment.findOne({ businessId: req.businessId, status: 'pending' });
    if (pending) return res.status(409).json({ success: false, message: 'A subscription payment is already awaiting review' });

    const amount = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
    if (submittedAmount !== undefined && Number(submittedAmount) !== Number(amount)) {
      return res.status(400).json({ success: false, message: 'Payment amount does not match the selected plan price' });
    }
    if (!['manual', 'bank_transfer', 'cash', 'other'].includes(method)) {
      return res.status(400).json({ success: false, message: 'Select a supported manual payment method' });
    }
    const submittedPaymentDate = paymentDate ? new Date(paymentDate) : new Date();
    if (!Number.isFinite(submittedPaymentDate.getTime()) || submittedPaymentDate > new Date(Date.now() + 24 * 60 * 60 * 1000)) {
      return res.status(400).json({ success: false, message: 'Payment date is invalid or in the future' });
    }
    if (typeof notes !== 'string' || notes.length > 1000) {
      return res.status(400).json({ success: false, message: 'Notes must be 1000 characters or fewer' });
    }
    if (proofDataUrl && !validateImageDataUrl(proofDataUrl)) {
      return res.status(400).json({ success: false, message: 'Payment proof must be a PNG, JPEG, or WebP image' });
    }
    if (proofDataUrl.length > 2_500_000) {
      return res.status(400).json({ success: false, message: 'Payment proof must be smaller than 1.8 MB' });
    }
    const paymentSettings = await PaymentSettings.findOne({ key: 'manual-subscription-payment' }).lean();
    const selectedMethod = method || paymentSettings?.methods?.[0] || 'manual';
    if (!['manual', 'bank_transfer', 'cash', 'other'].includes(selectedMethod)) {
      return res.status(400).json({ success: false, message: 'Select a supported manual payment method' });
    }
    if (paymentSettings?.methods?.length && !paymentSettings.methods.includes(selectedMethod)) {
      return res.status(400).json({ success: false, message: 'This payment method is not currently accepted' });
    }
    const payment = await SubscriptionPayment.create({
      businessId: req.businessId,
      planId: plan._id,
      planName: plan.name,
      billingCycle,
      amount,
      currency: business.currency || 'PKR',
      method: selectedMethod,
      reference: reference.trim(),
      paymentDate: submittedPaymentDate,
      proofDataUrl,
      notes: notes.trim(),
    });
    res.status(201).json({
      success: true,
      payment,
      message: 'Payment submitted for manual review. Your plan changes only after approval.',
    });
  } catch (error) {
    next(error);
  }
};

const cancelSubscription = async (req, res, next) => {
  try {
    if (req.user.role !== 'business_owner') {
      return res.status(403).json({ success: false, message: 'Only a business owner can cancel subscriptions' });
    }
    const subscription = await Subscription.findOne({ businessId: req.businessId });
    if (!subscription || subscription.planName === 'FREE') {
      return res.status(400).json({ success: false, message: 'There is no paid subscription to cancel' });
    }
    if (subscription.status !== 'active') {
      return res.status(409).json({ success: false, message: 'Only an active subscription can be cancelled' });
    }

    subscription.renewalStatus = 'cancelled';
    subscription.cancelledAt = new Date();
    await subscription.save();
    await writeSubscriptionHistory({
      businessId: req.businessId,
      subscriptionId: subscription._id,
      planId: subscription.planId,
      planName: subscription.planName,
      billingCycle: subscription.billingCycle,
      action: 'cancelled',
      startsAt: subscription.startDate,
      endsAt: subscription.expiryDate,
    });
    res.json({ success: true, subscription, message: 'Renewal cancelled; access remains until the current term ends' });
  } catch (error) {
    next(error);
  }
};

const renewSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.findOne({ businessId: req.businessId }).populate('planId');
    if (!subscription || !subscription.planId || subscription.planId.key === 'FREE') {
      return res.status(400).json({ success: false, message: 'No paid plan is available to renew' });
    }
    req.body.planId = subscription.planId._id;
    req.body.billingCycle = subscription.billingCycle || 'monthly';
    return requestSubscription(req, res, next);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listPlans,
  getPaymentInstructions,
  getSubscription,
  requestSubscription,
  cancelSubscription,
  renewSubscription,
};
