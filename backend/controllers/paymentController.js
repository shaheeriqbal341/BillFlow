const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');

const recordPayment = async (req, res, next) => {
  try {
    const { invoiceId, amount, method, referenceNumber, notes } = req.body;
    const paymentAmount = Number(amount);
    if (!invoiceId || !Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invoice and a positive payment amount are required' });
    }
    const invoice = await Invoice.findOne({ _id: invoiceId, businessId: req.businessId });

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    if (invoice.paymentStatus === 'cancelled') {
      return res.status(409).json({ success: false, message: 'Payments cannot be recorded against a cancelled invoice' });
    }
    if (paymentAmount > Number(invoice.remainingAmount ?? invoice.grandTotal - invoice.paidAmount)) {
      return res.status(400).json({ success: false, message: 'Payment cannot exceed the outstanding balance' });
    }
    if (!['Cash', 'Bank Transfer', 'Card', 'Other'].includes(method || 'Cash')) {
      return res.status(400).json({ success: false, message: 'Payment method is invalid' });
    }

    const precisionAmount = Math.round(paymentAmount * 100) / 100;
    const updatedInvoice = await Invoice.findOneAndUpdate(
      {
        _id: invoiceId,
        businessId: req.businessId,
        paymentStatus: { $nin: ['cancelled', 'paid'] },
        remainingAmount: { $gte: precisionAmount },
      },
      {
        $inc: { paidAmount: precisionAmount, remainingAmount: -precisionAmount },
        $set: { paymentMethod: method || 'Cash' },
      },
      { returnDocument: 'after' },
    );
    if (!updatedInvoice) {
      return res.status(409).json({ success: false, message: 'Invoice balance changed; refresh and try again' });
    }

    await Invoice.updateOne(
      { _id: updatedInvoice._id, remainingAmount: { $lte: 0 } },
      { $set: { paymentStatus: 'paid' } },
    );
    await Invoice.updateOne(
      { _id: updatedInvoice._id, remainingAmount: { $gt: 0 }, paymentStatus: { $ne: 'cancelled' } },
      { $set: { paymentStatus: 'partial' } },
    );

    let payment;
    try {
      payment = await Payment.create({
        businessId: req.businessId,
        invoiceId,
        amount: precisionAmount,
        method: method || 'Cash',
        referenceNumber,
        notes,
      });
    } catch (error) {
      await Invoice.updateOne(
        { _id: updatedInvoice._id, businessId: req.businessId },
        { $inc: { paidAmount: -precisionAmount, remainingAmount: precisionAmount } },
      );
      throw error;
    }

    const finalInvoice = await Invoice.findOne({ _id: updatedInvoice._id, businessId: req.businessId });
    res.status(201).json({ success: true, payment, invoice: finalInvoice });
  } catch (error) {
    next(error);
  }
};

const getPayments = async (req, res, next) => {
  try {
    const [payments, outstandingRows] = await Promise.all([
      Payment.find({ businessId: req.businessId }).sort({ paymentDate: -1 }),
      Invoice.aggregate([
        { $match: { businessId: req.businessId, paymentStatus: { $nin: ['draft', 'cancelled'] } } },
        { $group: { _id: null, totalOutstanding: { $sum: '$remainingAmount' } } },
      ]),
    ]);
    res.json({ success: true, payments, totalOutstanding: outstandingRows[0]?.totalOutstanding || 0 });
  } catch (error) {
    next(error);
  }
};

module.exports = { recordPayment, getPayments };
