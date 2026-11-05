process.env.NODE_ENV = 'test';
process.env.BILLFLOW_TEST_DATABASE = 'memory';
process.env.JWT_SECRET = 'billflow-integration-test-secret';
process.env.MONGODB_URI = '';

const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const request = require('supertest');
const app = require('../app');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Subscription = require('../models/Subscription');

function cookieFrom(response) {
  const cookies = response.headers['set-cookie'] || [];
  const cookie = cookies.find((entry) => entry.startsWith('token='));
  assert.ok(cookie, 'login/register should set an auth cookie');
  return cookie.split(';')[0];
}

async function register(email, businessName, businessType = 'General Retail Shop') {
  const response = await request(app)
    .post('/api/auth/register')
    .send({ fullName: 'Integration Owner', email, password: 'strong-password', businessName, businessType })
    .expect(201);
  assert.equal(response.body.user.password, undefined);
  assert.equal(response.body.token, undefined);
  assert.equal(response.body.business.type, businessType);
  const setCookie = response.headers['set-cookie'][0];
  assert.match(setCookie, /HttpOnly/i);
  return { cookie: cookieFrom(response), user: response.body.user };
}

async function verify() {
  await request(app).get('/api/health').expect(503).expect((response) => {
    assert.equal(response.body.success, false);
    assert.equal(response.body.database, 'disconnected');
  });
  await connectDB();
  await request(app).get('/api/health').expect(200).expect((response) => {
    assert.equal(response.body.success, true);
    assert.equal(response.body.database, 'connected');
  });
  const ownerA = await register(`owner-a-${Date.now()}@example.com`, 'Business A', 'Clothing Shop');
  const ownerB = await register(`owner-b-${Date.now()}@example.com`, 'Business B');
  await request(app).post('/api/auth/register')
    .send({ fullName: 'Duplicate Owner', email: ownerA.user.email, password: 'strong-password', businessName: 'Duplicate' })
    .expect(409);
  await request(app).post('/api/auth/login')
    .send({ email: ownerA.user.email, password: 'incorrect-password' })
    .expect(401);
  const persistedProfile = await request(app).get('/api/auth/me').set('Cookie', ownerA.cookie).expect(200);
  assert.equal(persistedProfile.body.user.password, undefined);
  assert.equal(persistedProfile.body.business.type, 'Clothing Shop');
  const storedOwnerA = await User.findById(ownerA.user.id);
  assert.ok(await bcrypt.compare('strong-password', storedOwnerA.password));
  const loggedInOwner = await request(app).post('/api/auth/login')
    .send({ email: ` ${ownerA.user.email} `, password: 'strong-password' }).expect(200);
  assert.equal(loggedInOwner.body.business.type, 'Clothing Shop');
  const logoutResponse = await request(app).post('/api/auth/logout').set('Cookie', ownerA.cookie).expect(200);
  assert.ok(logoutResponse.headers['set-cookie'][0].includes('Expires=Thu, 01 Jan 1970'));
  const updatedBusiness = await request(app).put('/api/business/me').set('Cookie', ownerA.cookie).send({
    name: 'Business A Updated',
    type: 'Clothing Shop',
    businessId: ownerB.user.businessId,
    logo: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==',
  }).expect(200);
  assert.equal(String(updatedBusiness.body.business._id), String(ownerA.user.businessId));
  assert.equal(updatedBusiness.body.business.type, 'Clothing Shop');

  const customerResponse = await request(app)
    .post('/api/customers')
    .set('Cookie', ownerA.cookie)
    .send({ name: 'Customer One', email: 'customer@example.com' })
    .expect(201);
  const customerId = customerResponse.body.customer._id;
  const disposableCustomer = await request(app).post('/api/customers').set('Cookie', ownerA.cookie)
    .send({ name: 'Disposable customer' }).expect(201);
  await request(app).delete(`/api/customers/${disposableCustomer.body.customer._id}`)
    .set('Cookie', ownerA.cookie).expect(200);

  await request(app).put(`/api/customers/${customerId}`).set('Cookie', ownerA.cookie)
    .send({ name: 'Updated Customer', businessId: ownerB.user.businessId }).expect(200);
  const updatedCustomer = await request(app).get(`/api/customers/${customerId}`).set('Cookie', ownerA.cookie).expect(200);
  assert.equal(String(updatedCustomer.body.customer.businessId), String(ownerA.user.businessId));
  await request(app).get(`/api/customers/${customerId}`).set('Cookie', ownerB.cookie).expect(404);
  const ownerBCustomers = await request(app).get('/api/customers').set('Cookie', ownerB.cookie).expect(200);
  assert.equal(ownerBCustomers.body.customers.length, 0);

  const disposable = await request(app)
    .post('/api/products')
    .set('Cookie', ownerA.cookie)
    .send({ name: 'Disposable', sku: `D-${Date.now()}`, purchasePrice: 1, sellingPrice: 2, stockQuantity: 3 })
    .expect(201);
  await request(app).put(`/api/products/${disposable.body.product._id}`).set('Cookie', ownerA.cookie).send({ sellingPrice: 3 }).expect(200);
  await request(app).delete(`/api/products/${disposable.body.product._id}`).set('Cookie', ownerA.cookie).expect(200);

  const productResponse = await request(app)
    .post('/api/products')
    .set('Cookie', ownerA.cookie)
    .send({
      name: 'Widget',
      sku: `W-${Date.now()}`,
      purchasePrice: 20,
      sellingPrice: 50,
      stockQuantity: 5,
      variants: [{ size: 'M', color: 'Blue', stockQuantity: 5, sellingPrice: 50 }],
    })
    .expect(201);
  const productId = productResponse.body.product._id;
  const variantId = productResponse.body.product.variants[0]._id;
  await request(app).put(`/api/products/${productId}`).set('Cookie', ownerA.cookie)
    .send({ businessId: ownerB.user.businessId, sellingPrice: 50 }).expect(200);
  await request(app).get(`/api/products/${productId}`).set('Cookie', ownerB.cookie).expect(404);

  const invoiceResponse = await request(app)
    .post('/api/invoices')
    .set('Cookie', ownerA.cookie)
    .send({ customerId, items: [{ productId, variantId, quantity: 2, unitPrice: 0.01 }], discount: 0, tax: 0 })
    .expect(201);
  const invoice = invoiceResponse.body.invoice;
  assert.equal(invoice.grandTotal, 100);
  assert.equal(invoice.items[0].purchasePrice, 20);
  assert.equal(invoice.items[0].variantLabel, 'M / Blue');
  const updatedProduct = await request(app).get(`/api/products/${productId}`).set('Cookie', ownerA.cookie).expect(200);
  assert.equal(updatedProduct.body.product.stockQuantity, 3);

  const pdf = await request(app).get(`/api/invoices/${invoice._id}/pdf`).set('Cookie', ownerA.cookie).expect(200);
  assert.match(pdf.headers['content-type'], /application\/pdf/);
  assert.equal(pdf.body.subarray(0, 4).toString(), '%PDF');

  await request(app).post('/api/payments').set('Cookie', ownerA.cookie).send({ invoiceId: invoice._id, amount: 25, method: 'Cash' }).expect(201);
  await request(app).post('/api/payments').set('Cookie', ownerA.cookie).send({ invoiceId: invoice._id, amount: 100, method: 'Cash' }).expect(400);
  const finalPayment = await request(app).post('/api/payments').set('Cookie', ownerA.cookie).send({ invoiceId: invoice._id, amount: 75, method: 'Bank Transfer' }).expect(201);
  assert.equal(finalPayment.body.invoice.paymentStatus, 'paid');
  await request(app).delete(`/api/customers/${customerId}`).set('Cookie', ownerA.cookie).expect(409);
  await request(app).delete(`/api/products/${productId}`).set('Cookie', ownerA.cookie).expect(409);
  await request(app).get('/api/admin/overview').set('Cookie', ownerA.cookie).expect(403);

  await request(app).post('/api/invoices').set('Cookie', ownerA.cookie)
    .send({ customerId, items: [{ productId, variantId, quantity: 1 }], discount: 0, tax: 0 }).expect(201);
  const invoiceList = await request(app).get('/api/invoices').set('Cookie', ownerA.cookie).expect(200);
  const unpaid = invoiceList.body.invoices.find((item) => item.paymentStatus === 'unpaid');
  await request(app).post(`/api/invoices/${unpaid._id}/cancel`).set('Cookie', ownerA.cookie).expect(200);
  await request(app).post(`/api/invoices/${unpaid._id}/cancel`).set('Cookie', ownerA.cookie).expect(409);
  const restoredProduct = await request(app).get(`/api/products/${productId}`).set('Cookie', ownerA.cookie).expect(200);
  assert.equal(restoredProduct.body.product.stockQuantity, 3);

  const adminEmail = `admin-${Date.now()}@example.com`;
  await User.create({
    fullName: 'Integration Admin',
    email: adminEmail,
    password: await bcrypt.hash('admin-password-long-enough', 12),
    role: 'super_admin',
  });
  const adminLogin = await request(app)
    .post('/api/auth/admin/login')
    .send({ email: adminEmail, password: 'admin-password-long-enough' })
    .expect(200);
  const adminCookie = cookieFrom(adminLogin);
  assert.equal(adminLogin.body.user.password, undefined);
  await request(app).get('/api/customers').set('Cookie', adminCookie).expect(403);
  await request(app).get('/api/subscriptions').set('Cookie', adminCookie).expect(403);
  await request(app).get('/api/business/users').set('Cookie', adminCookie).expect(403);
  await request(app).get('/api/admin/payment-settings').set('Cookie', ownerA.cookie).expect(403);
  await request(app).post('/api/auth/login').send({ email: adminEmail, password: 'admin-password-long-enough' }).expect(401);
  const overview = await request(app).get('/api/admin/overview').set('Cookie', adminCookie).expect(200);
  assert.ok(overview.body.overview.businessCount >= 2);

  const plansResponse = await request(app).get('/api/subscriptions/plans').expect(200);
  const defaultInstructions = await request(app).get('/api/subscriptions/payment-instructions').expect(200);
  assert.ok(defaultInstructions.body.instructions);
  await request(app).put('/api/admin/payment-settings').set('Cookie', adminCookie)
    .send({ instructions: 'Transfer to BillFlow test account.', methods: ['bank_transfer', 'other'] }).expect(200);
  const savedInstructions = await request(app).get('/api/subscriptions/payment-instructions').expect(200);
  assert.equal(savedInstructions.body.instructions, 'Transfer to BillFlow test account.');
  const starter = plansResponse.body.plans.find((plan) => plan.key === 'STARTER');
  const createdPlan = await request(app).post('/api/admin/plans').set('Cookie', adminCookie)
    .send({
      name: 'Micro',
      key: 'MICRO',
      description: 'Small test plan',
      monthlyPrice: 100,
      yearlyPrice: 1000,
      limits: { invoices: 1, customers: 1, products: 1, staff: 0 },
      features: { basicReports: true, advancedReports: false, pdfDownloads: false, inventory: true, staffAccounts: false },
    }).expect(201);
  await request(app).patch(`/api/admin/plans/${createdPlan.body.plan._id}`).set('Cookie', adminCookie)
    .send({ monthlyPrice: 125, limits: { invoices: 1, customers: 1, products: 1, staff: 0 }, features: { ...createdPlan.body.plan.features, pdfDownloads: false } })
    .expect(200);
  await request(app).post('/api/subscriptions/request').set('Cookie', ownerB.cookie)
    .send({ planId: starter._id, billingCycle: 'monthly', reference: 'wrong-amount-reference', method: 'bank_transfer', amount: 1 }).expect(400);
  const rejectedRequest = await request(app).post('/api/subscriptions/request').set('Cookie', ownerB.cookie)
    .send({
      planId: starter._id,
      billingCycle: 'monthly',
      reference: 'reject-reference',
      method: 'bank_transfer',
      amount: starter.monthlyPrice,
      paymentDate: new Date().toISOString(),
      proofDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
      notes: 'Integration payment proof fixture',
    }).expect(201);
  await request(app).patch(`/api/admin/subscription-payments/${rejectedRequest.body.payment._id}/review`)
    .set('Cookie', adminCookie).send({ decision: 'rejected', rejectionReason: 'Test rejection', internalNote: 'Internal review' }).expect(200);
  const ownerBSubscriptionData = await request(app).get('/api/subscriptions').set('Cookie', ownerB.cookie).expect(200);
  assert.equal(ownerBSubscriptionData.body.payments[0].rejectionReason, 'Test rejection');
  assert.equal(ownerBSubscriptionData.body.payments[0].internalNote, undefined);
  const businessBId = ownerB.user.businessId;
  const unchangedSub = await Subscription.findOne({ businessId: businessBId });
  assert.equal(unchangedSub.planName, 'FREE');

  const approvedRequest = await request(app).post('/api/subscriptions/request').set('Cookie', ownerA.cookie)
    .send({ planId: starter._id, billingCycle: 'yearly', reference: 'approved-reference', method: 'bank_transfer' }).expect(201);
  await request(app).patch(`/api/admin/subscription-payments/${approvedRequest.body.payment._id}/review`)
    .set('Cookie', adminCookie).send({ decision: 'approved' }).expect(200);
  const activeSubscription = await Subscription.findOne({ businessId: ownerA.user.businessId });
  assert.equal(activeSubscription.planName, 'STARTER');
  assert.equal(activeSubscription.billingCycle, 'yearly');
  assert.ok(activeSubscription.expiryDate > activeSubscription.startDate);

  const microRequest = await request(app).post('/api/subscriptions/request').set('Cookie', ownerA.cookie)
    .send({ planId: createdPlan.body.plan._id, billingCycle: 'monthly', reference: 'micro-reference', method: 'bank_transfer' }).expect(201);
  await request(app).patch(`/api/admin/subscription-payments/${microRequest.body.payment._id}/review`)
    .set('Cookie', adminCookie).send({ decision: 'approved' }).expect(200);
  await request(app).post('/api/customers').set('Cookie', ownerA.cookie).send({ name: 'Over limit customer' }).expect(403);
  await request(app).post('/api/products').set('Cookie', ownerA.cookie)
    .send({ name: 'Over limit product', sku: 'LIMIT-1', purchasePrice: 1, sellingPrice: 2, stockQuantity: 1 }).expect(403);
  await request(app).post('/api/business/users').set('Cookie', ownerA.cookie)
    .send({ fullName: 'No Staff', email: 'staff@example.com', password: 'strong-password' }).expect(403);
  await request(app).get(`/api/invoices/${invoice._id}/pdf`).set('Cookie', ownerA.cookie).expect(403);

  const serviceOwner = await register(`service-${Date.now()}@example.com`, 'Service Business', 'Freelancer / Service Business');
  const serviceCustomer = await request(app).post('/api/customers').set('Cookie', serviceOwner.cookie).send({ name: 'Service Client' }).expect(201);
  const service = await request(app).post('/api/products').set('Cookie', serviceOwner.cookie).send({
    name: 'Consulting',
    sku: `S-${Date.now()}`,
    purchasePrice: 0,
    sellingPrice: 80,
    industryDetails: { pricingType: 'hourly', duration: 60, serviceDescription: 'Consulting session' },
  }).expect(201);
  assert.equal(service.body.product.isService, true);
  assert.equal(service.body.product.stockQuantity, 0);
  const serviceInvoice = await request(app).post('/api/invoices').set('Cookie', serviceOwner.cookie).send({
    customerId: serviceCustomer.body.customer._id,
    items: [{ productId: service.body.product._id, quantity: 1.5 }],
  }).expect(201);
  assert.equal(serviceInvoice.body.invoice.grandTotal, 120);

  const ownerBCustomer = await request(app).post('/api/customers').set('Cookie', ownerB.cookie).send({ name: 'B Customer' }).expect(201);
  const ownerBProduct = await request(app).post('/api/products').set('Cookie', ownerB.cookie)
    .send({ name: 'B Widget', sku: 'B-1', purchasePrice: 1, sellingPrice: 10, stockQuantity: 2 }).expect(201);
  const ownerBInvoice = await request(app).post('/api/invoices').set('Cookie', ownerB.cookie)
    .send({ customerId: ownerBCustomer.body.customer._id, items: [{ productId: ownerBProduct.body.product._id, quantity: 1 }] }).expect(201);
  assert.equal(ownerBInvoice.body.invoice.invoiceNumber, invoice.invoiceNumber);
  const ownerAPayments = await request(app).get('/api/payments').set('Cookie', ownerA.cookie).expect(200);
  const ownerBPayments = await request(app).get('/api/payments').set('Cookie', ownerB.cookie).expect(200);
  assert.equal(ownerAPayments.body.totalOutstanding, 0);
  assert.equal(ownerBPayments.body.totalOutstanding, 10);

  const report = await request(app).get('/api/reports/dashboard').set('Cookie', ownerA.cookie).expect(200);
  assert.equal(report.body.summary.totalRevenue, 100);
  assert.equal(report.body.summary.totalInvoices, 1);

  const businessStatus = await request(app).patch(`/api/admin/businesses/${businessBId}/status`)
    .set('Cookie', adminCookie).send({ status: 'suspended' }).expect(200);
  assert.equal(businessStatus.body.business.status, 'suspended');
  await request(app).get('/api/customers').set('Cookie', ownerB.cookie).expect(403);
  await request(app).get('/api/admin/audit-logs').set('Cookie', adminCookie).expect(200);

  const updatedPlans = await request(app).get('/api/admin/plans').set('Cookie', adminCookie).expect(200);
  const starterAdmin = updatedPlans.body.plans.find((plan) => plan.key === 'STARTER');
  assert.equal(starterAdmin.limits.staff, 2);

  console.log('Billing integration verification passed: CRUD, role boundaries, tenant isolation, invoices, stock, PDF, payments, admin, manual subscription review, limits, and reporting.');
}

verify()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDB();
  });
