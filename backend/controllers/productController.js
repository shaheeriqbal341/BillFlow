const Product = require('../models/Product');
const Invoice = require('../models/Invoice');
const Business = require('../models/Business');
const Subscription = require('../models/Subscription');
const { releaseUsageSlot } = require('../services/subscriptionService');
const validateImageDataUrl = require('../utils/validateImageDataUrl');
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const text = (value, label, maxLength) => {
  const parsed = String(value || '').trim();
  if (parsed.length > maxLength) {
    throw Object.assign(new Error(`${label} must be ${maxLength} characters or fewer`), { statusCode: 400 });
  }
  return parsed;
};

const numeric = (value, label, { integer = false } = {}) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || (integer && !Number.isInteger(parsed))) {
    throw Object.assign(new Error(`${label} must be a valid non-negative ${integer ? 'whole number' : 'number'}`), { statusCode: 400 });
  }
  return parsed;
};

function productPayload(input, businessType, previous = {}) {
  const value = (key, fallback) => input[key] === undefined ? (previous[key] ?? fallback) : input[key];
  const name = text(value('name', ''), 'Product name', 120);
  const sku = text(value('sku', ''), 'SKU', 80);
  if (!name || !sku) {
    throw Object.assign(new Error('Product name and SKU are required'), { statusCode: 400 });
  }

  const purchasePrice = numeric(value('purchasePrice', 0), 'Purchase price');
  const sellingPrice = numeric(value('sellingPrice', 0), 'Sale price');
  const lowStockThreshold = numeric(value('lowStockThreshold', 5), 'Low stock threshold', { integer: true });
  const isService = businessType === 'Freelancer / Service Business';
  const details = input.industryDetails === undefined ? (previous.industryDetails || {}) : input.industryDetails;
  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    throw Object.assign(new Error('Industry details must be an object'), { statusCode: 400 });
  }

  let allowedDetails = {};
  if (businessType === 'Mobile Shop') {
    allowedDetails = {
      model: text(details.model, 'Model', 120),
      serialNumber: text(details.serialNumber, 'IMEI / Serial number', 120),
      warranty: text(details.warranty, 'Warranty', 120),
      condition: text(details.condition, 'Device condition', 80),
      accessories: text(details.accessories, 'Accessories', 500),
      repairCharges: numeric(details.repairCharges ?? 0, 'Repair charges'),
    };
  } else if (businessType === 'Clothing Shop') {
    allowedDetails = {
      fabric: text(details.fabric, 'Fabric', 120),
      design: text(details.design, 'Design', 120),
    };
  } else if (businessType === 'Electric Shop') {
    allowedDetails = {
      voltage: text(details.voltage, 'Voltage', 80),
      wattage: text(details.wattage, 'Wattage', 80),
      unitType: text(details.unitType, 'Unit type', 80),
      warranty: text(details.warranty, 'Warranty', 120),
      model: text(details.model, 'Model', 120),
    };
  } else if (businessType === 'Grocery Store') {
    const expiryDate = details.expiryDate ? new Date(details.expiryDate) : null;
    if (expiryDate && !Number.isFinite(expiryDate.getTime())) {
      throw Object.assign(new Error('Expiry date is invalid'), { statusCode: 400 });
    }
    allowedDetails = {
      batchNumber: text(details.batchNumber, 'Batch number', 120),
      expiryDate,
      purchaseUnit: text(details.purchaseUnit, 'Purchase unit', 80),
      saleUnit: text(details.saleUnit, 'Sale unit', 80),
    };
  } else if (isService) {
    allowedDetails = {
      serviceDescription: text(details.serviceDescription, 'Service description', 1000),
      pricingType: ['hourly', 'fixed'].includes(details.pricingType) ? details.pricingType : 'fixed',
      duration: numeric(details.duration ?? 0, 'Service duration'),
    };
  }

  const inputVariants = businessType === 'Clothing Shop'
    ? (input.variants === undefined ? (previous.variants || []) : input.variants)
    : [];
  if (!Array.isArray(inputVariants)) {
    throw Object.assign(new Error('Product variants must be a list'), { statusCode: 400 });
  }
  if (inputVariants.length > 50) {
    throw Object.assign(new Error('A product can have up to 50 size/color variants'), { statusCode: 400 });
  }
  const variants = inputVariants.map((variant) => {
    const size = text(variant.size, 'Variant size', 80);
    const color = text(variant.color, 'Variant color', 80);
    if (!size || !color) {
      throw Object.assign(new Error('Each clothing variant requires a size and color'), { statusCode: 400 });
    }
    return {
      _id: variant._id,
      size,
      color,
      design: text(variant.design, 'Variant design', 120),
      sku: text(variant.sku, 'Variant SKU', 80),
      stockQuantity: numeric(variant.stockQuantity, 'Variant stock', { integer: true }),
      ...(variant.sellingPrice !== undefined && variant.sellingPrice !== ''
        ? { sellingPrice: numeric(variant.sellingPrice, 'Variant sale price') }
        : {}),
    };
  });
  const stockQuantity = isService
    ? 0
    : variants.length
      ? variants.reduce((sum, variant) => sum + variant.stockQuantity, 0)
      : numeric(value('stockQuantity', 0), 'Quantity', { integer: true });

  const imageUrl = String(value('imageUrl', '') || '').trim();
  if (imageUrl.length > 2_500_000) {
    throw Object.assign(new Error('Product image must be smaller than 1.8 MB'), { statusCode: 400 });
  }
  if (imageUrl && !/^https?:\/\//i.test(imageUrl) && !validateImageDataUrl(imageUrl, { maxLength: 2_500_000 })) {
    throw Object.assign(new Error('Image must be an HTTP(S) URL or a PNG, JPEG, or WebP data URL'), { statusCode: 400 });
  }

  return {
    name,
    sku,
    barcode: text(value('barcode', ''), 'Barcode', 80),
    category: text(value('category', 'General') || 'General', 'Category', 80),
    brand: text(value('brand', ''), 'Brand', 100),
    description: text(value('description', ''), 'Description', 1000),
    imageUrl,
    purchasePrice,
    sellingPrice,
    stockQuantity,
    unit: text(value('unit', 'pcs') || 'pcs', 'Unit', 32),
    lowStockThreshold: isService ? 0 : lowStockThreshold,
    isService,
    pricingType: isService ? allowedDetails.pricingType : 'fixed',
    serviceDuration: isService ? allowedDetails.duration : 0,
    variants,
    industryDetails: allowedDetails,
  };
}

const getProducts = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const search = String(req.query.search || '');
    const category = String(req.query.category || '');
    const query = { businessId: req.businessId };

    if (search) {
      query.$or = [
        { name: { $regex: escapeRegex(search), $options: 'i' } },
        { sku: { $regex: escapeRegex(search), $options: 'i' } },
        { barcode: { $regex: escapeRegex(search), $options: 'i' } },
      ];
    }
    if (category) query.category = category;

    const skip = (page - 1) * limit;
    const [products, total] = await Promise.all([
      Product.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Product.countDocuments(query),
    ]);
    res.json({ success: true, products, page, pages: Math.ceil(total / limit), total });
  } catch (error) {
    next(error);
  }
};

const createProduct = async (req, res, next) => {
  try {
    const business = await Business.findById(req.businessId).select('type');
    if (!business) return res.status(404).json({ success: false, message: 'Business not found' });
    const product = await Product.create({ ...productPayload(req.body, business.type), businessId: req.businessId });
    res.status(201).json({ success: true, product });
  } catch (error) {
    next(error);
  }
};

const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, businessId: req.businessId });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, product });
  } catch (error) {
    next(error);
  }
};

const updateProduct = async (req, res, next) => {
  try {
    const [product, business] = await Promise.all([
      Product.findOne({ _id: req.params.id, businessId: req.businessId }),
      Business.findById(req.businessId).select('type'),
    ]);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    if (!business) return res.status(404).json({ success: false, message: 'Business not found' });

    Object.assign(product, productPayload(req.body, business.type, product.toObject()));
    await product.save();
    res.json({ success: true, product });
  } catch (error) {
    next(error);
  }
};

const deleteProduct = async (req, res, next) => {
  try {
    const inActiveInvoice = await Invoice.exists({
      businessId: req.businessId,
      'items.productId': req.params.id,
      paymentStatus: { $ne: 'cancelled' },
    });
    if (inActiveInvoice) {
      return res.status(409).json({ success: false, message: 'Product appears on an active invoice and cannot be deleted' });
    }
    const product = await Product.findOneAndDelete({ _id: req.params.id, businessId: req.businessId });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    const subscription = await Subscription.findOne({ businessId: req.businessId }).select('_id');
    if (subscription) await releaseUsageSlot(subscription._id, 'productsUsed', null);
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getProducts, createProduct, getProductById, updateProduct, deleteProduct };
