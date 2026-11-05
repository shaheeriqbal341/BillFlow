const Subscription = require('../models/Subscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const { expireSubscriptionIfNeeded, reserveUsageSlot, releaseUsageSlot } = require('../services/subscriptionService');

const LEGACY_LIMITS = {
  FREE: { invoices: 20, customers: 20, products: 20, staff: 0 },
  BASIC: { invoices: 500, customers: 500, products: 500, staff: 2 },
  PRO: { invoices: 5000, customers: 5000, products: 5000, staff: 10 },
};

const enforcePlanLimit = (resource) => async (req, res, next) => {
  try {
    let subscription = await Subscription.findOne({ businessId: req.businessId });
    if (!subscription) {
      return res.status(403).json({ success: false, message: 'A subscription is required to use this feature' });
    }

    subscription = await expireSubscriptionIfNeeded(subscription);
    if (subscription.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Your subscription is not active. Renew or select a plan to continue.' });
    }

    const plan = subscription.planId
      ? await SubscriptionPlan.findById(subscription.planId).select('limits active')
      : null;
    const limits = plan?.limits || subscription.usageLimits || LEGACY_LIMITS[subscription.planName] || LEGACY_LIMITS.FREE;
    const limit = Number(limits[resource]);
    if (Number.isFinite(limit) && limit >= 0) {
      const reservation = await reserveUsageSlot(subscription, resource, limit);
      if (!reservation.reserved) {
        return res.status(403).json({
          success: false,
          message: `Your plan limit for ${resource} (${limit}) has been reached`,
          limit,
          currentCount: reservation.actualCount,
        });
      }

      res.once('finish', () => {
        if (res.statusCode >= 400) {
          releaseUsageSlot(subscription._id, reservation.usageField, reservation.periodStart).catch((error) => {
            console.error('Failed to release subscription usage reservation:', error);
          });
        }
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = enforcePlanLimit;
