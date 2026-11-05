const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const Subscription = require('../models/Subscription');
const { releaseUsageSlot } = require('../services/subscriptionService');
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getCustomers = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const search = String(req.query.search || '');
    const query = { businessId: req.businessId };

    if (search) {
      query.$or = [
        { name: { $regex: escapeRegex(search), $options: 'i' } },
        { email: { $regex: escapeRegex(search), $options: 'i' } },
        { phone: { $regex: escapeRegex(search), $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [customers, total] = await Promise.all([
      Customer.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Customer.countDocuments(query),
    ]);

    res.json({ success: true, customers, page, pages: Math.ceil(total / limit), total });
  } catch (error) {
    next(error);
  }
};

const createCustomer = async (req, res, next) => {
  try {
    const { name, email, phone, address, notes } = req.body;
    if (!String(name || '').trim()) {
      return res.status(400).json({ success: false, message: 'Customer name is required' });
    }
    const customer = await Customer.create({ name, email, phone, address, notes, businessId: req.businessId });
    res.status(201).json({ success: true, customer });
  } catch (error) {
    next(error);
  }
};

const getCustomerById = async (req, res, next) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, businessId: req.businessId });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    res.json({ success: true, customer });
  } catch (error) {
    next(error);
  }
};

const updateCustomer = async (req, res, next) => {
  try {
    const { name, email, phone, address, notes } = req.body;
    const updates = Object.fromEntries(
      Object.entries({ name, email, phone, address, notes }).filter(([, value]) => value !== undefined),
    );
    if (updates.name !== undefined && !String(updates.name).trim()) {
      return res.status(400).json({ success: false, message: 'Customer name cannot be empty' });
    }
    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, businessId: req.businessId },
      { $set: updates },
      { returnDocument: 'after' },
    );

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    res.json({ success: true, customer });
  } catch (error) {
    next(error);
  }
};

const deleteCustomer = async (req, res, next) => {
  try {
    const hasInvoices = await Invoice.exists({
      customerId: req.params.id,
      businessId: req.businessId,
      paymentStatus: { $ne: 'cancelled' },
    });
    if (hasInvoices) {
      return res.status(409).json({ success: false, message: 'Customer has invoices and cannot be deleted' });
    }
    const customer = await Customer.findOneAndDelete({ _id: req.params.id, businessId: req.businessId });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    const subscription = await Subscription.findOne({ businessId: req.businessId }).select('_id');
    if (subscription) await releaseUsageSlot(subscription._id, 'customersUsed', null);
    res.json({ success: true, message: 'Customer deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getCustomers, createCustomer, getCustomerById, updateCustomer, deleteCustomer };
