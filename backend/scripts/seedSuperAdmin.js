const bcrypt = require('bcryptjs');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');

async function seedSuperAdmin() {
  const { SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, SUPER_ADMIN_NAME } = process.env;
  if (!SUPER_ADMIN_EMAIL?.trim() || !SUPER_ADMIN_PASSWORD || !SUPER_ADMIN_NAME?.trim()) {
    throw new Error('Set SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, and SUPER_ADMIN_NAME before seeding.');
  }
  if (SUPER_ADMIN_PASSWORD.length < 14) {
    throw new Error('SUPER_ADMIN_PASSWORD must contain at least 14 characters.');
  }

  const name = SUPER_ADMIN_NAME.trim();
  const email = SUPER_ADMIN_EMAIL.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('SUPER_ADMIN_EMAIL must be a valid email address.');
  }

  await connectDB();
  const existing = await User.findOne({ role: 'super_admin' });
  if (existing) {
    if (existing.email === email) {
      console.log('The configured super-admin account already exists; no changes made.');
      return;
    }
    throw new Error('A super-admin account already exists. No additional account was created.');
  }

  const existingEmail = await User.findOne({ email });
  if (existingEmail) {
    throw new Error('This email already belongs to an account. No role changes were made.');
  }

  const password = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12);
  await User.create({
    fullName: name,
    email,
    password,
    role: 'super_admin',
    status: 'active',
  });
  console.log('Initial super-admin account created.');
}

async function main() {
  let exitCode = 0;
  try {
    await seedSuperAdmin();
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
