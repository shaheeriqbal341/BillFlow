const { connectDB, disconnectDB } = require('../config/db');
const SubscriptionPlan = require('../models/SubscriptionPlan');

const plans = [
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

async function seedPlans() {
  await connectDB();
  for (const plan of plans) {
    await SubscriptionPlan.updateOne({ key: plan.key }, { $setOnInsert: plan }, { upsert: true });
  }
  console.log('Default subscription plans are available (existing plan settings preserved).');
}

async function main() {
  let exitCode = 0;
  try {
    await seedPlans();
  } catch (error) {
    console.error(error.message);
    exitCode = 1;
  } finally {
    try {
      await disconnectDB();
    } catch (error) {
      console.error(`MongoDB disconnect failed (${error.name || 'error'}).`);
      exitCode = 1;
    }
  }
  process.exitCode = exitCode;
}

main();
