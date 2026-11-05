const Invoice = require('../models/Invoice');
const Product = require('../models/Product');
const Customer = require('../models/Customer');

const getDashboard = async (req, res, next) => {
  try {
    const businessId = req.businessId;
    const now = new Date();
    const firstMonth = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const validInvoiceMatch = { businessId, paymentStatus: { $nin: ['draft', 'cancelled'] } };

    const [summaryRows, customers, products, lowStock, recentInvoices, monthlyRows, dailyRows, topProducts] = await Promise.all([
      Invoice.aggregate([
        { $match: { businessId } },
        {
          $group: {
            _id: null,
            totalInvoices: { $sum: { $cond: [{ $in: ['$paymentStatus', ['draft', 'cancelled']] }, 0, 1] } },
            totalSales: { $sum: { $cond: [{ $in: ['$paymentStatus', ['draft', 'cancelled']] }, 0, '$grandTotal'] } },
            totalRevenue: { $sum: { $cond: [{ $in: ['$paymentStatus', ['draft', 'cancelled']] }, 0, '$paidAmount'] } },
            totalOutstanding: { $sum: { $cond: [{ $in: ['$paymentStatus', ['draft', 'cancelled']] }, 0, '$remainingAmount'] } },
            paidInvoices: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] } },
            unpaidInvoices: { $sum: { $cond: [{ $and: [{ $not: [{ $in: ['$paymentStatus', ['draft', 'cancelled', 'paid']] }] }, { $gt: ['$remainingAmount', 0] }] }, 1, 0] } },
            pendingPayments: { $sum: { $cond: [{ $and: [{ $not: [{ $in: ['$paymentStatus', ['draft', 'cancelled']] }] }, { $gt: ['$remainingAmount', 0] }] }, 1, 0] } },
          },
        },
      ]),
      Customer.countDocuments({ businessId }),
      Product.countDocuments({ businessId }),
      Product.find({ businessId, isService: { $ne: true }, $expr: { $lte: ['$stockQuantity', '$lowStockThreshold'] } }).limit(10),
      Invoice.find({ businessId }).sort({ createdAt: -1 }).limit(5).populate('customerId', 'name'),
      Invoice.aggregate([
        { $match: { ...validInvoiceMatch, invoiceDate: { $gte: firstMonth } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$invoiceDate' } }, revenue: { $sum: '$paidAmount' } } },
      ]),
      Invoice.aggregate([
        { $match: { ...validInvoiceMatch, invoiceDate: { $gte: sevenDaysAgo } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$invoiceDate' } }, sales: { $sum: '$grandTotal' } } },
      ]),
      Invoice.aggregate([
        { $match: validInvoiceMatch },
        { $unwind: '$items' },
        { $group: { _id: '$items.productName', quantity: { $sum: '$items.quantity' }, revenue: { $sum: '$items.lineTotal' } } },
        { $sort: { quantity: -1 } },
        { $limit: 5 },
        { $project: { _id: 0, name: '$_id', quantity: 1, revenue: 1 } },
      ]),
    ]);

    const summary = summaryRows[0] || {};
    const monthlyByKey = new Map(monthlyRows.map((entry) => [entry._id, entry.revenue]));
    const dailyByKey = new Map(dailyRows.map((entry) => [entry._id, entry.sales]));
    const monthlyRevenue = Array.from({ length: 6 }, (_, index) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
      const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
      return { month: monthDate.toLocaleString('en', { month: 'short' }), revenue: monthlyByKey.get(key) || 0 };
    });

    const dailySales = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(now);
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - (6 - index));
      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      return { day: day.toLocaleString('en', { weekday: 'short' }), sales: dailyByKey.get(key) || 0 };
    });

    res.json({
      success: true,
      summary: {
        totalRevenue: summary.totalRevenue || 0,
        totalSales: summary.totalSales || 0,
        totalInvoices: summary.totalInvoices || 0,
        totalCustomers: customers,
        totalProducts: products,
        totalOutstanding: summary.totalOutstanding || 0,
        pendingPayments: summary.pendingPayments || 0,
        paidInvoices: summary.paidInvoices || 0,
        unpaidInvoices: summary.unpaidInvoices || 0,
        lowStockCount: lowStock.length,
      },
      lowStock,
      monthlyRevenue,
      dailySales,
      topProducts,
      recentInvoices,
    });
  } catch (error) {
    next(error);
  }
};

const getReports = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const query = { businessId: req.businessId };
    if (startDate || endDate) {
      query.invoiceDate = {};
      if (startDate && !Number.isFinite(new Date(startDate).getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid start date' });
      }
      if (endDate && !Number.isFinite(new Date(endDate).getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid end date' });
      }
      if (startDate) query.invoiceDate.$gte = new Date(startDate);
      if (endDate) {
        const inclusiveEnd = new Date(endDate);
        if (/^\d{4}-\d{2}-\d{2}$/.test(endDate)) inclusiveEnd.setHours(23, 59, 59, 999);
        query.invoiceDate.$lte = inclusiveEnd;
      }
      if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
        return res.status(400).json({ success: false, message: 'Start date must be before end date' });
      }
    }

    query.paymentStatus = { $nin: ['draft', 'cancelled'] };
    const invoices = await Invoice.find(query)
      .select('invoiceNumber invoiceDate customerId paymentStatus subtotal taxTotal grandTotal paidAmount remainingAmount items.purchasePrice items.quantity items.lineTotal')
      .populate('customerId', 'name')
      .sort({ invoiceDate: -1 })
      .limit(5000)
      .lean();
    const totalRevenue = invoices.reduce((sum, inv) => sum + (Number(inv.paidAmount) || 0), 0);
    const outstanding = invoices.reduce((sum, inv) => sum + (Number(inv.remainingAmount) || 0), 0);
    const profitEstimate = invoices.reduce((total, invoice) => total + invoice.items.reduce((itemTotal, item) => {
      if (typeof item.purchasePrice !== 'number') return itemTotal;
      return itemTotal + (Number(item.lineTotal || 0) - item.purchasePrice * Number(item.quantity || 0));
    }, 0), 0);
    res.json({ success: true, invoices, totalRevenue, outstanding, profitEstimate });
  } catch (error) {
    next(error);
  }
};

module.exports = { getDashboard, getReports };
