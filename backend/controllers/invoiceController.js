const { jsPDF } = require('jspdf');
const Invoice = require('../models/Invoice');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Business = require('../models/Business');
const Counter = require('../models/Counter');
const Payment = require('../models/Payment');

const toCurrency = (value) => Number((Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2));

const generateInvoiceNumber = async (businessId) => {
  const business = await Business.findById(businessId).select('invoiceSettings');
  const prefix = String(business?.invoiceSettings?.prefix || 'INV').replace(/[^a-z0-9-]/gi, '').slice(0, 12) || 'INV';
  const initialSequence = Math.max(0, Number(business?.invoiceSettings?.numberingStart || 1) - 1);
  let counter = await Counter.findOneAndUpdate(
    { businessId, counterType: 'invoice' },
    { $inc: { currentSequence: 1 } },
    { returnDocument: 'after' },
  );
  if (!counter) {
    try {
      counter = await Counter.create({
        businessId,
        counterType: 'invoice',
        currentSequence: initialSequence + 1,
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      counter = await Counter.findOneAndUpdate(
        { businessId, counterType: 'invoice' },
        { $inc: { currentSequence: 1 } },
        { returnDocument: 'after' },
      );
    }
  }

  const sequence = String(counter.currentSequence).padStart(4, '0');
  return `${prefix}-${sequence}`;
};

const getInvoices = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status = '', search = '' } = req.query;
    const query = { businessId: req.businessId };
    if (status) query.paymentStatus = status;
    if (search) {
      query.$or = [{ invoiceNumber: { $regex: search, $options: 'i' } }];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [invoices, total] = await Promise.all([
      Invoice.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).populate('customerId').populate('businessId'),
      Invoice.countDocuments(query),
    ]);

    res.json({ success: true, invoices, page: Number(page), pages: Math.ceil(total / Number(limit)), total });
  } catch (error) {
    next(error);
  }
};

const createInvoice = async (req, res, next) => {
  const stockDeductions = [];
  let createdInvoice;
  try {
    const { customerId, items, discount = 0, tax = 0, paidAmount = 0, notes = '', paymentMethod = 'Cash' } = req.body;

    if (!customerId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Customer and at least one invoice item are required' });
    }
    if (items.length > 200) {
      return res.status(400).json({ success: false, message: 'An invoice can contain up to 200 items' });
    }
    const customer = await Customer.findOne({ _id: customerId, businessId: req.businessId });
    if (!customer) return res.status(400).json({ success: false, message: 'Customer does not belong to this business' });
    if (!Number.isFinite(Number(discount)) || Number(discount) < 0 || !Number.isFinite(Number(tax)) || Number(tax) < 0 || Number(tax) > 100) {
      return res.status(400).json({ success: false, message: 'Discount and tax must be valid non-negative amounts' });
    }
    if (!Number.isFinite(Number(paidAmount)) || Number(paidAmount) < 0) {
      return res.status(400).json({ success: false, message: 'Paid amount must be a valid non-negative amount' });
    }
    if (!['Cash', 'Bank Transfer', 'Card', 'Other'].includes(paymentMethod)) {
      return res.status(400).json({ success: false, message: 'Payment method is invalid' });
    }

    let subtotal = 0;
    const preparedItems = [];

    for (const item of items) {
      const product = await Product.findOne({ _id: item.productId, businessId: req.businessId });
      if (!product) {
        return res.status(400).json({ success: false, message: `Product not found: ${item.productId}` });
      }
      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0 || (!product.isService && !Number.isInteger(quantity))) {
        return res.status(400).json({ success: false, message: `Quantity for ${product.name} must be a positive ${product.isService ? 'number' : 'whole number'}` });
      }
      const variant = product.variants.length ? product.variants.id(item.variantId) : null;
      if (product.variants.length && !variant) {
        return res.status(400).json({ success: false, message: `Select a valid variant for ${product.name}` });
      }
      if (item.variantId && !variant) {
        return res.status(400).json({ success: false, message: `Product variant not found for ${product.name}` });
      }
      if (!product.isService && quantity > (variant?.stockQuantity ?? product.stockQuantity)) {
        return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name}` });
      }

      const unitPrice = Number(variant?.sellingPrice ?? product.sellingPrice);
      const lineSubtotal = toCurrency(quantity * unitPrice);

      subtotal += lineSubtotal;
      preparedItems.push({
        productId: product._id,
        productName: product.name,
        quantity,
        unitPrice,
        purchasePrice: Number(product.purchasePrice),
        unit: product.unit,
        variantId: variant ? String(variant._id) : '',
        variantLabel: variant ? [variant.size, variant.color, variant.design].filter(Boolean).join(' / ') : '',
        isService: Boolean(product.isService),
        productDetails: {
          barcode: product.barcode,
          brand: product.brand,
          category: product.category,
          description: product.description,
          imageUrl: product.imageUrl,
          industryDetails: product.industryDetails,
          variant: variant ? variant.toObject() : null,
        },
        discount: 0,
        tax: 0,
        lineTotal: lineSubtotal,
      });
    }

    const discountTotal = toCurrency(Number(discount || 0));
    if (discountTotal > subtotal) {
      return res.status(400).json({ success: false, message: 'Discount cannot exceed the invoice subtotal' });
    }
    const taxTotal = toCurrency((subtotal - discountTotal) * (Number(tax || 0) / 100));
    const grandTotal = toCurrency(subtotal - discountTotal + taxTotal);
    const paid = toCurrency(Number(paidAmount || 0));
    if (paid > grandTotal) {
      return res.status(400).json({ success: false, message: 'Paid amount cannot exceed the invoice total' });
    }
    const remainingAmount = toCurrency(Math.max(grandTotal - paid, 0));

    const quantitiesByProduct = new Map();
    for (const item of preparedItems) {
      if (item.isService) continue;
      const key = `${item.productId}:${item.variantId}`;
      const current = quantitiesByProduct.get(key) || { productId: item.productId, variantId: item.variantId, quantity: 0 };
      current.quantity += item.quantity;
      quantitiesByProduct.set(key, current);
    }
    for (const deduction of quantitiesByProduct.values()) {
      const { productId, variantId, quantity } = deduction;
      const updatedProduct = variantId
        ? await Product.findOneAndUpdate(
          { _id: productId, businessId: req.businessId, variants: { $elemMatch: { _id: variantId, stockQuantity: { $gte: quantity } } } },
          { $inc: { 'variants.$.stockQuantity': -quantity, stockQuantity: -quantity } },
          { returnDocument: 'after' },
        )
        : await Product.findOneAndUpdate(
          { _id: productId, businessId: req.businessId, stockQuantity: { $gte: quantity } },
          { $inc: { stockQuantity: -quantity } },
          { returnDocument: 'after' },
        );
      if (!updatedProduct) {
        throw Object.assign(new Error('Stock changed while creating the invoice. Please try again.'), { statusCode: 409 });
      }
      stockDeductions.push(deduction);
    }

    const invoiceNumber = await generateInvoiceNumber(req.businessId);
    createdInvoice = await Invoice.create({
      businessId: req.businessId,
      customerId,
      invoiceNumber,
      dueDate: req.body.dueDate,
      items: preparedItems,
      subtotal: toCurrency(subtotal),
      discountTotal,
      taxTotal,
      grandTotal,
      paidAmount: paid,
      remainingAmount,
      paymentStatus: paid >= grandTotal ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
      notes,
      paymentMethod,
      stockAdjusted: true,
    });

    if (paid > 0) {
      await Payment.create({
        businessId: req.businessId,
        invoiceId: createdInvoice._id,
        amount: paid,
        method: paymentMethod,
        paymentDate: new Date(),
        notes,
      });
    }

    res.status(201).json({ success: true, invoice: createdInvoice });
  } catch (error) {
    if (createdInvoice) await Invoice.deleteOne({ _id: createdInvoice._id, businessId: req.businessId });
    for (const deduction of stockDeductions) {
      if (deduction.variantId) {
        await Product.updateOne(
          { _id: deduction.productId, businessId: req.businessId, 'variants._id': deduction.variantId },
          { $inc: { 'variants.$.stockQuantity': deduction.quantity, stockQuantity: deduction.quantity } },
        );
      } else {
        await Product.updateOne(
          { _id: deduction.productId, businessId: req.businessId },
          { $inc: { stockQuantity: deduction.quantity } },
        );
      }
    }
    next(error);
  }
};

const getInvoiceById = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, businessId: req.businessId }).populate('customerId').populate('businessId');
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    res.json({ success: true, invoice });
  } catch (error) {
    next(error);
  }
};

const cancelInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, businessId: req.businessId });
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    if (invoice.paymentStatus === 'cancelled' || !invoice.stockAdjusted) {
      return res.status(409).json({ success: false, message: 'Invoice has already been cancelled' });
    }
    if (invoice.paidAmount > 0) {
      return res.status(409).json({ success: false, message: 'Invoices with recorded payments cannot be cancelled' });
    }

    for (const item of invoice.items) {
      if (item.isService) continue;
      if (item.variantId) {
        await Product.updateOne(
          { _id: item.productId, businessId: req.businessId, 'variants._id': item.variantId },
          { $inc: { 'variants.$.stockQuantity': item.quantity, stockQuantity: item.quantity } },
        );
      } else {
        await Product.updateOne(
          { _id: item.productId, businessId: req.businessId },
          { $inc: { stockQuantity: item.quantity } },
        );
      }
    }

    invoice.paymentStatus = 'cancelled';
    invoice.cancelledAt = new Date();
    invoice.stockAdjusted = false;
    await invoice.save();

    res.json({ success: true, invoice });
  } catch (error) {
    next(error);
  }
};

const downloadInvoicePdf = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, businessId: req.businessId }).populate('customerId').populate('businessId');
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    const currency = invoice.businessId?.currency || 'PKR';
    const formatAmount = (value) => `${currency} ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const business = invoice.businessId || {};
    const customer = invoice.customerId || {};
    const logoMatch = String(business.logo || '').match(/^data:image\/(png|jpeg);base64,/);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42);
    const businessNameLines = doc.splitTextToSize(business.name || 'BillFlow Invoice', logoMatch ? 360 : pageWidth - margin * 2);
    doc.text(businessNameLines, margin, 60);
    if (logoMatch) {
      try {
        doc.addImage(business.logo, logoMatch[1].toUpperCase(), pageWidth - 125, 35, 85, 44);
      } catch {
        console.warn('An invalid business logo was omitted from the invoice PDF.');
      }
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    const invoiceDate = new Date(invoice.invoiceDate || invoice.createdAt);
    const invoiceDetails = [
      `Invoice #${invoice.invoiceNumber}`,
      `Date: ${Number.isNaN(invoiceDate.getTime()) ? 'N/A' : invoiceDate.toLocaleDateString()}`,
      `Due: ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'N/A'}`,
    ];
    let businessY = Math.max(84, 60 + businessNameLines.length * 23);
    invoiceDetails.forEach((detail) => {
      const lines = doc.splitTextToSize(detail, 360);
      doc.text(lines, margin, businessY);
      businessY += lines.length * 13;
    });

    const businessDetails = [
      business.address,
      [business.city, business.country].filter(Boolean).join(', '),
      business.phone,
      business.email,
    ].filter(Boolean);
    businessDetails.forEach((detail) => {
      const lines = doc.splitTextToSize(String(detail), 360);
      doc.text(lines, margin, businessY);
      businessY += lines.length * 12;
    });

    const customerY = Math.max(192, businessY + 12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('Bill to', margin, customerY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    let customerDetailY = customerY + 18;
    [customer.name || 'Unknown Customer', customer.email, customer.phone, customer.address].filter(Boolean).forEach((detail) => {
      const lines = doc.splitTextToSize(String(detail), 240);
      doc.text(lines, margin, customerDetailY);
      customerDetailY += lines.length * 13;
    });

    const statusX = pageWidth - margin;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('Payment status', statusX, customerY, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(22, 163, 74);
    doc.text(invoice.paymentStatus || 'draft', statusX, customerY + 18, { align: 'right' });
    doc.setTextColor(51, 65, 85);
    doc.text(`Payment method: ${invoice.paymentMethod || 'Not recorded'}`, statusX, customerY + 34, { align: 'right' });

    const quantityX = pageWidth - 245;
    const priceX = pageWidth - 145;
    const totalX = pageWidth - margin;
    let y = Math.max(customerDetailY, customerY + 52) + 20;
    const drawItemsHeader = () => {
      doc.setDrawColor(203, 213, 225);
      doc.line(margin, y, pageWidth - margin, y);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('Item / service', margin, y + 22);
      doc.text('Qty', quantityX, y + 22, { align: 'right' });
      doc.text('Price', priceX, y + 22, { align: 'right' });
      doc.text('Total', totalX, y + 22, { align: 'right' });
      doc.line(margin, y + 30, pageWidth - margin, y + 30);
      y += 48;
    };
    drawItemsHeader();
    (invoice.items || []).forEach((item) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      const lines = doc.splitTextToSize(item.productName || 'Product', 210);
      const detailParts = [
        item.variantLabel,
        item.productDetails?.brand,
        item.productDetails?.description,
        item.isService && item.productDetails?.industryDetails?.duration
          ? `${item.productDetails.industryDetails.duration} minutes`
          : '',
        ...Object.entries(item.productDetails?.industryDetails || {}).map(([key, value]) => {
          if (value === '' || value === null || value === undefined) return '';
          const renderedValue = value instanceof Date ? value.toLocaleDateString() : String(value);
          return `${key.replace(/([A-Z])/g, ' $1')}: ${renderedValue}`;
        }),
      ].filter(Boolean);
      const details = detailParts.length ? doc.splitTextToSize(detailParts.join(' · '), 210) : [];
      const rowHeight = Math.max(22, lines.length * 12) + details.length * 10;
      if (y + rowHeight > pageHeight - 60) {
        doc.addPage();
        y = 50;
        drawItemsHeader();
      }
      doc.text(lines, margin, y);
      if (details.length) {
        doc.setFontSize(8);
        doc.text(details, margin, y + Math.max(11, lines.length * 11));
      }
      doc.setFontSize(9);
      doc.text(`${item.quantity || 0}${item.unit ? ` ${item.unit}` : ''}`, quantityX, y, { align: 'right' });
      doc.text(formatAmount(item.unitPrice), priceX, y, { align: 'right' });
      doc.text(formatAmount(item.lineTotal), totalX, y, { align: 'right' });
      y += rowHeight + 8;
    });

    y += 12;
    if (y + 170 > pageHeight - margin) {
      doc.addPage();
      y = 50;
    }
    doc.line(margin, y, pageWidth - margin, y);
    const summaryRows = [
      ['Subtotal', invoice.subtotal],
      ['Tax', invoice.taxTotal],
      ['Discount', invoice.discountTotal],
      ['Grand Total', invoice.grandTotal],
      ['Paid', invoice.paidAmount],
      ['Balance due', invoice.remainingAmount],
    ];
    summaryRows.forEach(([label, amount], index) => {
      const isGrandTotal = label === 'Grand Total';
      doc.setFont('helvetica', isGrandTotal ? 'bold' : 'normal');
      doc.setFontSize(isGrandTotal ? 11 : 10);
      doc.setTextColor(15, 23, 42);
      const rowY = y + 22 + index * (isGrandTotal ? 18 : 16);
      doc.text(label, priceX - 20, rowY, { align: 'right' });
      doc.text(formatAmount(amount), totalX, rowY, { align: 'right' });
    });
    if (invoice.notes) {
      const notes = doc.splitTextToSize(`Notes: ${String(invoice.notes)}`, pageWidth - margin * 2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(notes, margin, y + 22 + summaryRows.length * 16);
    }

    const buffer = doc.output('arraybuffer');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    next(error);
  }
};

module.exports = { getInvoices, createInvoice, getInvoiceById, cancelInvoice, downloadInvoicePdf };
