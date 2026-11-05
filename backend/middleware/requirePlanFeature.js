const Subscription = require('../models/Subscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const { expireSubscriptionIfNeeded } = require('../services/subscriptionService');

const LEGACY_FEATURES = {
  FREE: { pdfDownloads: true, advancedReports: false, staffAccounts: false },
  BASIC: { pdfDownloads: true, advancedReports: true, staffAccounts: true },
  PRO: { pdfDownloads: true, advancedReports: true, staffAccounts: true },
};

const requirePlanFeature = (feature) => async (req, res, next) => {
  try {
    let subscription = await Subscription.findOne({ businessId: req.businessId });
    if (!subscription) {
      return res.status(403).json({ success: false, message: 'An active subscription is required' });
    }
    subscription = await expireSubscriptionIfNeeded(subscription);
    if (subscription.status !== 'active') return res.status(403).json({ success: false, message: 'An active subscription is required' });

    const plan = subscription.planId ? await SubscriptionPlan.findById(subscription.planId).select(`features.${feature}`) : null;
    const enabled = plan?.features?.[feature] ?? LEGACY_FEATURES[subscription.planName]?.[feature] ?? false;
    if (!enabled) {
      return res.status(403).json({ success: false, message: `Your current plan does not include ${feature}` });
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = requirePlanFeature;
