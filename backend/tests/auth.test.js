const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'mock-token'),
  verify: jest.fn(),
}));

jest.mock('../models/User', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  findById: jest.fn(),
}));

jest.mock('../models/Business', () => ({
  create: jest.fn(),
  findById: jest.fn(),
}));

jest.mock('../models/Subscription', () => ({
  create: jest.fn(),
}));

jest.mock('../models/SubscriptionPlan', () => ({
  findOne: jest.fn(),
}));

jest.mock('../services/subscriptionService', () => ({
  ensureDefaultPlans: jest.fn().mockResolvedValue(),
}));

const User = require('../models/User');
const Business = require('../models/Business');
const Subscription = require('../models/Subscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const { register, login } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

beforeEach(() => {
  jest.clearAllMocks();
  process.env.JWT_SECRET = 'test-secret';
});

describe('BillFlow auth logic', () => {
  it('registers a new business owner with an HttpOnly cookie', async () => {
    const req = {
      body: { fullName: 'Test Owner', email: 'owner@example.com', password: 'secret123', businessName: 'Acme Retail' },
      cookies: {},
      headers: { 'x-billflow-client': 'mobile' },
    };
    const res = {
      cookie: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    User.findOne.mockResolvedValue(null);
    bcrypt.hash.mockResolvedValue('hashed-pass');
    SubscriptionPlan.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: 'plan-free', active: true, limits: { invoices: 20, customers: 20, products: 20, staff: 0 } }),
    });
    Business.create.mockResolvedValue({ _id: 'biz-1', name: 'Acme Retail', owner: null, save: jest.fn() });
    User.create.mockResolvedValue({
      _id: 'user-1',
      fullName: 'Test Owner',
      email: 'owner@example.com',
      password: 'hashed-pass',
      role: 'business_owner',
      businessId: 'biz-1',
    });
    Subscription.create.mockResolvedValue({ _id: 'sub-1' });

    await register(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ token: 'mock-token' }));
    expect(res.cookie).toHaveBeenCalledWith('token', 'mock-token', expect.objectContaining({ httpOnly: true }));
    expect(User.create).toHaveBeenCalled();
  });

  it('logs in a registered user', async () => {
    const req = {
      body: { email: 'login@example.com', password: 'secret123' },
      cookies: {},
      headers: { 'x-billflow-client': 'mobile' },
    };
    const res = {
      cookie: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    User.findOne.mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        _id: 'user-2',
        fullName: 'Login User',
        email: 'login@example.com',
        password: 'hashed-pass',
        role: 'business_owner',
        status: 'active',
        businessId: { _id: 'biz-2', name: 'Login Business' },
      }),
    });
    bcrypt.compare.mockResolvedValue(true);

    await login(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ token: 'mock-token' }));
    expect(res.cookie).toHaveBeenCalledWith('token', 'mock-token', expect.objectContaining({ httpOnly: true }));
  });

  it('keeps browser business login responses cookie-only', async () => {
    const req = {
      body: { email: 'browser@example.com', password: 'secret123' },
      cookies: {},
      headers: {},
    };
    const res = {
      cookie: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    User.findOne.mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        _id: 'browser-user',
        fullName: 'Browser User',
        email: 'browser@example.com',
        password: 'hashed-pass',
        role: 'business_owner',
        status: 'active',
        businessId: { _id: 'browser-business', name: 'Browser Business' },
      }),
    });
    bcrypt.compare.mockResolvedValue(true);

    await login(req, res, jest.fn());

    expect(res.json.mock.calls[0][0]).not.toHaveProperty('token');
    expect(res.cookie).toHaveBeenCalledWith('token', 'mock-token', expect.objectContaining({ httpOnly: true }));
  });

  it('logs in a super admin through the common login endpoint', async () => {
    const req = {
      body: { email: 'admin@example.com', password: 'secret123' },
      cookies: {},
      headers: {},
    };
    const res = {
      cookie: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    User.findOne.mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        _id: 'admin-1',
        fullName: 'Super Admin',
        email: 'admin@example.com',
        password: 'hashed-pass',
        role: 'super_admin',
        status: 'active',
        businessId: null,
      }),
    });
    bcrypt.compare.mockResolvedValue(true);

    await login(req, res, next);

    expect(User.findOne).toHaveBeenCalledWith({ email: 'admin@example.com' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      user: expect.objectContaining({ role: 'super_admin' }),
      business: null,
    }));
    expect(res.json.mock.calls[0][0]).not.toHaveProperty('token');
    expect(res.cookie).toHaveBeenCalledWith('token', 'mock-token', expect.objectContaining({ httpOnly: true }));
  });

  it('protects authenticated routes when the token is valid', async () => {
    const req = {
      cookies: {},
      headers: { authorization: 'Bearer valid-token' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    jwt.verify.mockReturnValue({ id: 'user-3' });
    User.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        _id: 'user-3',
        businessId: { _id: 'biz-3' },
        role: 'business_owner',
        status: 'active',
      }),
    });

    await protect(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user._id).toBe('user-3');
  });
});
