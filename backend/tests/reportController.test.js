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

const Invoice = require('../models/Invoice');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const { getDashboard, getReports } = require('../controllers/reportController');

describe('dashboard report', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Invoice.aggregate.mockImplementation((pipeline) => {
      const group = pipeline.find((stage) => stage.$group)?.$group;
      return Promise.resolve(group?.totalOutstanding
        ? [{ totalOutstanding: 875, totalRevenue: 1200, totalInvoices: 4, totalSales: 2075 }]
        : []);
    });
    const invoiceQuery = {
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    };
    Invoice.find.mockReturnValue(invoiceQuery);
    Product.countDocuments.mockResolvedValue(3);
    Product.find.mockReturnValue({ limit: jest.fn().mockResolvedValue([]) });
    Customer.countDocuments.mockResolvedValue(2);
  });

  it('reports the exact outstanding balance excluding drafts and cancelled invoices', async () => {
    const req = { businessId: 'business-1' };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await getDashboard(req, res, next);

    const summaryPipeline = Invoice.aggregate.mock.calls[0][0];
    expect(summaryPipeline[1].$group.totalOutstanding).toEqual({
      $sum: {
        $cond: [
          { $in: ['$paymentStatus', ['draft', 'cancelled']] },
          0,
          '$remainingAmount',
        ],
      },
    });
    expect(summaryPipeline[1].$group.totalSales).toEqual({
      $sum: {
        $cond: [
          { $in: ['$paymentStatus', ['draft', 'cancelled']] },
          0,
          '$grandTotal',
        ],
      },
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      summary: expect.objectContaining({ totalOutstanding: 875, totalSales: 2075 }),
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('selects only the invoice fields used in reports and returns lean documents', async () => {
    const req = { businessId: 'business-1', query: { startDate: '2026-01-01', endDate: '2026-01-31' } };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await getReports(req, res, next);

    const query = Invoice.find.mock.results[0].value;
    expect(Invoice.find).toHaveBeenCalledWith(expect.objectContaining({
      businessId: 'business-1',
      paymentStatus: { $nin: ['draft', 'cancelled'] },
    }));
    expect(query.select).toHaveBeenCalledWith('invoiceNumber invoiceDate customerId paymentStatus subtotal taxTotal grandTotal paidAmount remainingAmount items.purchasePrice items.quantity items.lineTotal');
    expect(query.lean).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, invoices: [] }));
    expect(next).not.toHaveBeenCalled();
  });
});
