jest.mock('../models/Payment', () => ({
  find: jest.fn(),
}));

jest.mock('../models/Invoice', () => ({
  aggregate: jest.fn(),
}));

const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const { getPayments } = require('../controllers/paymentController');

describe('payment list summary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Payment.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([{ _id: 'payment-1' }]) });
    Invoice.aggregate.mockResolvedValue([{ totalOutstanding: 875 }]);
  });

  it('returns payments and outstanding balance for the business excluding drafts and cancelled invoices', async () => {
    const req = { businessId: 'business-1' };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await getPayments(req, res, next);

    expect(Invoice.aggregate).toHaveBeenCalledWith([
      { $match: { businessId: 'business-1', paymentStatus: { $nin: ['draft', 'cancelled'] } } },
      { $group: { _id: null, totalOutstanding: { $sum: '$remainingAmount' } } },
    ]);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      payments: [{ _id: 'payment-1' }],
      totalOutstanding: 875,
    });
    expect(next).not.toHaveBeenCalled();
  });
});