const request = require('supertest');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Invoice = require('../models/Invoice');
const Product = require('../models/Product');
const Customer = require('../models/Customer');

jest.mock('../config/db', () => ({
  ...jest.requireActual('../config/db'),
  connectDB: jest.fn(),
}));

jest.mock('bcryptjs', () => ({
  ...jest.requireActual('bcryptjs'),
  compare: jest.fn(),
}));

jest.mock('../models/User', () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
}));

jest.mock('../models/Invoice', () => ({
  aggregate: jest.fn(),
  find: jest.fn(),
}));

jest.mock('../models/Product', () => ({
  countDocuments: jest.fn(),
  find: jest.fn(),
}));

jest.mock('../models/Customer', () => ({
  countDocuments: jest.fn(),
}));

const app = require('../app');
const productionFrontendOrigin = 'https://bill-flow-cdly.vercel.app';

function createUserQuery(user) {
  const query = {
    select: jest.fn(() => query),
    populate: jest.fn(() => Promise.resolve(user)),
  };
  return query;
}

function createDashboardInvoiceQuery() {
  const query = {
    sort: jest.fn(() => query),
    limit: jest.fn(() => query),
    populate: jest.fn(() => Promise.resolve([])),
  };
  return query;
}

describe('web and mobile authentication sessions', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalJwtSecret = process.env.JWT_SECRET;
  const user = {
    _id: 'session-user',
    fullName: 'Session User',
    email: 'session@example.com',
    password: 'hashed-password',
    role: 'business_owner',
    status: 'active',
    businessId: {
      _id: 'session-business',
      name: 'Session Business',
      type: 'General Retail Shop',
      status: 'active',
    },
  };

  beforeAll(() => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'test-session-secret';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    bcrypt.compare.mockResolvedValue(true);
    User.findOne.mockReturnValue({ populate: jest.fn().mockResolvedValue(user) });
    User.findById.mockImplementation(() => createUserQuery(user));
    Invoice.aggregate.mockResolvedValue([]);
    Invoice.find.mockReturnValue(createDashboardInvoiceQuery());
    Product.countDocuments.mockResolvedValue(0);
    Product.find.mockReturnValue({ limit: jest.fn().mockResolvedValue([]) });
    Customer.countDocuments.mockResolvedValue(0);
  });

  afterAll(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
  });

  it('sets a secure cross-site HttpOnly cookie and authenticates web profile and dashboard requests', async () => {
    const csrfResponse = await request(app)
      .get('/api/auth/csrf')
      .set('Origin', productionFrontendOrigin)
      .expect(200);
    expect(csrfResponse.headers['cache-control']).toBe('no-store');
    const csrfCookie = csrfResponse.headers['set-cookie'][0].split(';')[0];

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .set('Origin', productionFrontendOrigin)
      .set('Cookie', csrfCookie)
      .set('X-CSRF-Token', csrfResponse.body.csrfToken)
      .send({ email: user.email, password: 'test-password' })
      .expect(200);

    expect(loginResponse.body.success).toBe(true);
    expect(loginResponse.body).not.toHaveProperty('token');
    expect(loginResponse.headers['set-cookie'][0]).toMatch(/^token=/i);
    expect(loginResponse.headers['set-cookie'][0]).toMatch(/Max-Age=604800/i);
    expect(loginResponse.headers['set-cookie'][0]).toMatch(/Path=\//i);
    expect(loginResponse.headers['set-cookie'][0]).toMatch(/HttpOnly/i);
    expect(loginResponse.headers['set-cookie'][0]).toMatch(/Secure/i);
    expect(loginResponse.headers['set-cookie'][0]).toMatch(/SameSite=None/i);
    const sessionCookie = loginResponse.headers['set-cookie'][0].split(';')[0];

    await request(app)
      .get('/api/auth/me')
      .set('Origin', productionFrontendOrigin)
      .set('Cookie', sessionCookie)
      .expect(200)
      .expect((response) => {
        expect(response.body.user.email).toBe(user.email);
      });

    await request(app)
      .get('/api/reports/dashboard')
      .set('Origin', productionFrontendOrigin)
      .set('Cookie', sessionCookie)
      .expect(200)
      .expect((response) => {
        expect(response.body.success).toBe(true);
      });
  });

  it.each([
    ['missing', undefined],
    ['invalid', 'token=not-a-valid-session'],
  ])('returns 401 for a %s web session cookie', async (_description, cookie) => {
    const response = request(app).get('/api/auth/me');
    if (cookie) response.set('Cookie', cookie);
    await response.expect(401);
  });

  it('continues to authenticate mobile Bearer requests and mobile login without CSRF headers', async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .set('X-BillFlow-Client', 'mobile')
      .send({ email: user.email, password: 'test-password' })
      .expect(200);

    expect(loginResponse.body.token).toEqual(expect.any(String));

    await request(app)
      .get('/api/auth/me')
      .set('X-BillFlow-Client', 'mobile')
      .set('Authorization', `Bearer ${loginResponse.body.token}`)
      .expect(200);

    await request(app)
      .get('/api/reports/dashboard')
      .set('X-BillFlow-Client', 'mobile')
      .set('Authorization', `Bearer ${loginResponse.body.token}`)
      .expect(200);
  });

  it('rejects web mutation requests without a matching CSRF cookie and header', async () => {
    await request(app).post('/api/auth/logout').expect(403);
    await request(app)
      .post('/api/auth/logout')
      .set('Cookie', 'csrfToken=cookie-value')
      .set('X-CSRF-Token', 'different-value')
      .expect(403);
  });

  it('accepts a matching CSRF token and clears session and CSRF cookies on logout', async () => {
    const csrfResponse = await request(app)
      .get('/api/auth/csrf')
      .set('Origin', productionFrontendOrigin)
      .expect(200);
    const csrfCookie = csrfResponse.headers['set-cookie'][0].split(';')[0];

    const logoutResponse = await request(app)
      .post('/api/auth/logout')
      .set('Origin', productionFrontendOrigin)
      .set('Cookie', csrfCookie)
      .set('X-CSRF-Token', csrfResponse.body.csrfToken)
      .expect(200);

    expect(logoutResponse.headers['set-cookie']).toHaveLength(2);
    expect(logoutResponse.headers['set-cookie'].some((cookie) => /^token=;/i.test(cookie))).toBe(true);
    expect(logoutResponse.headers['set-cookie'].some((cookie) => /^csrfToken=;/i.test(cookie))).toBe(true);
  });
});
