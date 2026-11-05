const SubscriptionPlan = require('../models/SubscriptionPlan');
const Subscription = require('../models/Subscription');
const SubscriptionHistory = require('../models/SubscriptionHistory');
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const User = require('../models/User');

const DEFAULT_PLANS = [
  {
    name: 'Free',
    key: 'FREE',
    description: 'For getting started',
    monthlyPrice: 0,
    yearlyPrice: 0,
    limits: { invoices: 20, customers: 20, products: 20, staff: 0 },
    features: { basicReports: true, advancedReports: false, pdfDownloads: true, inventory: true, staffAccounts: false },
  },
  {
    name: 'Starter',
    key: 'STARTER',
    description: 'For growing businesses',
    monthlyPrice: 1500,
    yearlyPrice: 15000,
    limits: { invoices: 500, customers: 500, products: 500, staff: 2 },
    features: { basicReports: true, advancedReports: false, pdfDownloads: true, inventory: true, staffAccounts: true },
  },
  {
    name: 'Professional',
    key: 'PROFESSIONAL',
    description: 'For teams and established businesses',
    monthlyPrice: 4500,
    yearlyPrice: 45000,
    limits: { invoices: 5000, customers: 5000, products: 5000, staff: 10 },
    features: { basicReports: true, advancedReports: true, pdfDownloads: true, inventory: true, staffAccounts: true },
  },
];

async function ensureDefaultPlans() {
  for (const plan of DEFAULT_PLANS) {
    await SubscriptionPlan.updateOne({ key: plan.key }, { $setOnInsert: plan }, { upsert: true });
  }
}

function getPlanLimits(subscription, plan) {
  return plan?.limits || subscription?.usageLimits || { invoices: 20, customers: 20, products: 20, staff: 0 };
}

function getExpiryDate(start, cycle) {
  const expiry = new Date(start);
  if (cycle === 'yearly') expiry.setFullYear(expiry.getFullYear() + 1);
  else expiry.setMonth(expiry.getMonth() + 1);
  return expiry;
}

async function writeSubscriptionHistory(data) {
  return SubscriptionHistory.create(data);
}

async function expireSubscriptionIfNeeded(subscription) {
  if (!subscription || subscription.status !== 'active' || !subscription.expiryDate || subscription.expiryDate > new Date()) {
    return subscription;
  }

  const now = new Date();
  const expired = await Subscription.findOneAndUpdate(
    { _id: subscription._id, status: 'active', expiryDate: { $lte: now } },
    { $set: { status: 'expired', renewalStatus: 'expired' } },
    { returnDocument: 'after' },
  );
  if (expired) {
    await writeSubscriptionHistory({
      businessId: expired.businessId,
      subscriptionId: expired._id,
      planId: expired.planId,
      planName: expired.planName,
      billingCycle: expired.billingCycle,
      action: 'expired',
      startsAt: expired.startDate,
      endsAt: expired.expiryDate,
    });
    return expired;
  }
  return Subscription.findById(subscription._id);
}

async function countResource(businessId, resource, periodStart) {
  if (resource === 'invoices') {
    return Invoice.countDocuments({
      businessId,
      createdAt: { $gte: periodStart },
    });
  }
  if (resource === 'customers') return Customer.countDocuments({ businessId });
  if (resource === 'products') return Product.countDocuments({ businessId });
  if (resource === 'staff') return User.countDocuments({ businessId, role: 'staff' });
  throw new Error(`Unknown subscription resource: ${resource}`);
}

async function reserveUsageSlot(subscription, resource, limit) {
  const usageFields = {
    invoices: 'invoicesUsed',
    customers: 'customersUsed',
    products: 'productsUsed',
    staff: 'staffUsed',
  };
  const usageField = usageFields[resource];
  if (!usageField) throw new Error(`Unknown subscription resource: ${resource}`);
  const periodStart = resource === 'invoices' ? new Date(new Date().getFullYear(), new Date().getMonth(), 1) : null;
  const usagePath = `usage.${usageField}`;
  const periodPath = 'usage.invoicePeriod';

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const currentSubscription = await Subscription.findById(subscription._id);
    if (!currentSubscription || currentSubscription.status !== 'active') return { reserved: false };

    const actualCount = await countResource(subscription.businessId, resource, periodStart);
    if (actualCount >= limit) return { reserved: false, actualCount };

    const storedCount = Number(currentSubscription.usage?.[usageField] || 0);
    const storedPeriod = currentSubscription.usage?.invoicePeriod;
    const newPeriod = periodStart && (!storedPeriod || storedPeriod.getTime() !== periodStart.getTime());
    if (storedCount < actualCount || newPeriod) {
      const filter = { _id: currentSubscription._id, status: 'active', [usagePath]: storedCount };
      if (periodStart) filter[periodPath] = storedPeriod || null;
      const update = { $set: { [usagePath]: actualCount } };
      if (periodStart) update.$set[periodPath] = periodStart;
      const sync = await Subscription.updateOne(filter, update);
      if (sync.modifiedCount !== 1) continue;
    }

    const refreshed = await Subscription.findById(currentSubscription._id).select(usagePath);
    const used = Number(refreshed?.usage?.[usageField] || 0);
    if (used >= limit) return { reserved: false, actualCount };
    const filter = { _id: currentSubscription._id, status: 'active', [usagePath]: used };
    if (periodStart) filter[periodPath] = periodStart;
    const reserve = await Subscription.updateOne(filter, { $inc: { [usagePath]: 1 } });
    if (reserve.modifiedCount === 1) return { reserved: true, usageField, periodStart };
  }

  return { reserved: false };
}

async function releaseUsageSlot(subscriptionId, usageField, periodStart) {
  const filter = { _id: subscriptionId, [`usage.${usageField}`]: { $gt: 0 } };
  if (periodStart) filter['usage.invoicePeriod'] = periodStart;
  return Subscription.updateOne(filter, { $inc: { [`usage.${usageField}`]: -1 } });
}

module.exports = {
  DEFAULT_PLANS,
  ensureDefaultPlans,
  getPlanLimits,
  getExpiryDate,
  writeSubscriptionHistory,
  expireSubscriptionIfNeeded,
  reserveUsageSlot,
  releaseUsageSlot,
};
