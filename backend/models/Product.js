const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema({
  size: { type: String, trim: true, default: '' },
  color: { type: String, trim: true, default: '' },
  design: { type: String, trim: true, default: '' },
  sku: { type: String, trim: true, default: '' },
  stockQuantity: { type: Number, min: 0, default: 0 },
  sellingPrice: { type: Number, min: 0 },
});

const productSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true },
    barcode: { type: String, trim: true, default: '' },
    category: { type: String, default: 'General' },
    brand: { type: String, trim: true, default: '' },
    description: { type: String, default: '' },
    imageUrl: { type: String, trim: true, default: '' },
    purchasePrice: { type: Number, required: true, default: 0 },
    sellingPrice: { type: Number, required: true, default: 0 },
    stockQuantity: { type: Number, default: 0 },
    unit: { type: String, default: 'pcs' },
    lowStockThreshold: { type: Number, default: 5 },
    isService: { type: Boolean, default: false },
    pricingType: { type: String, enum: ['fixed', 'hourly'], default: 'fixed' },
    serviceDuration: { type: Number, min: 0, default: 0 },
    variants: { type: [variantSchema], default: [] },
    industryDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: 'products' },
);

productSchema.index({ businessId: 1, sku: 1 }, { unique: true });

module.exports = mongoose.model('Product', productSchema);
