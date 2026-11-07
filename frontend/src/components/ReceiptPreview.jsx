import { useState } from 'react';
import { Printer, X } from 'lucide-react';
import { printReceiptInBrowser } from '../services/printerService';

const money = (currency, value) => `${currency || 'PKR'} ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const receiptVariant = (item) => {
  const variant = item.productDetails?.variant || {};
  const parts = String(item.variantLabel || '').split(' / ').filter(Boolean);
  const size = String(variant.size || parts.shift() || '');
  return { size };
};

const propertyLabels = {
  model: 'Model',
  serialNumber: 'IMEI / Serial',
  warranty: 'Warranty',
  condition: 'Condition',
  accessories: 'Accessories',
  voltage: 'Voltage',
  wattage: 'Wattage',
  unitType: 'Unit type',
  batchNumber: 'Batch number',
  expiryDate: 'Expiry date',
  purchaseUnit: 'Purchase unit',
  saleUnit: 'Sale unit',
  fabric: 'Fabric',
  design: 'Design',
  serviceDescription: 'Service',
  pricingType: 'Pricing type',
  duration: 'Duration',
  repairCharges: 'Repair charges',
};

function receiptProperties(item, businessType) {
  const details = item.productDetails || {};
  const properties = [];
  if (businessType === 'Mobile Shop' && details.industryDetails?.model) {
    properties.push(['Model', details.industryDetails.model]);
  }
  if (details.brand) properties.push(['Brand', details.brand]);

  if (businessType !== 'Clothing Shop') {
    Object.entries(details.industryDetails || {}).forEach(([key, value]) => {
      if (key === 'model' && businessType === 'Mobile Shop') return;
      if (value === null || value === undefined || String(value).trim() === '') return;
      if (typeof value === 'object' && !(value instanceof Date)) return;
      if (key === 'repairCharges' && Number(value) === 0) return;
      const label = propertyLabels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
      properties.push([label, value instanceof Date ? value.toLocaleDateString() : String(value)]);
    });
  }

  return properties;
}

export default function ReceiptPreview({ invoice, payments = [], onClose, testMode = false }) {
  const [printNotice, setPrintNotice] = useState({ invoiceId: null, message: '' });

  if (!invoice) return null;
  const printMessage = printNotice.invoiceId === invoice._id ? printNotice.message : '';
  const business = invoice.businessId || {};
  const businessType = business.type || '';
  const customer = invoice.customerId || {};
  const invoicePayments = payments.filter((payment) => String(payment.invoiceId) === String(invoice._id));
  const paymentMethods = [...new Set(invoicePayments.map((payment) => payment.method).filter(Boolean))];
  const paymentMethod = paymentMethods.length ? paymentMethods.join(', ') : invoice.paymentMethod || 'Not recorded';
  const currency = business.currency || 'PKR';
  const handlePrint = () => {
    try {
      printReceiptInBrowser();
      setPrintNotice({ invoiceId: invoice._id, message: 'Browser print was requested. BillFlow cannot confirm whether it was cancelled or physically printed.' });
    } catch (error) {
      setPrintNotice({ invoiceId: invoice._id, message: error.message || 'Browser printing is unavailable.' });
    }
  };

  return (
    <div className="receipt-preview-overlay">
      <div className="receipt-preview-toolbar">
        <button type="button" className="btn btn-outline-secondary" onClick={onClose}><X size={16} /> Close</button>
        <button type="button" className="btn btn-primary" onClick={handlePrint}><Printer size={16} /> {testMode ? 'Test Print' : 'Print Receipt'}</button>
      </div>
      {printMessage && <p className="receipt-print-message" role="status">{printMessage}</p>}
      <article className="receipt-print-root" aria-label="58 millimeter receipt preview">
        {business.logo && <img className="receipt-logo" src={business.logo} alt={`${business.name || 'Business'} logo`} />}
        <h1 className="receipt-business-name">{business.name || 'BillFlow'}</h1>
        <p>Date: {new Date(invoice.invoiceDate || invoice.createdAt).toLocaleDateString(undefined, { year: '2-digit', month: 'numeric', day: 'numeric' })} · Invoice: {invoice.invoiceNumber}</p>
        {business.phone && <p>{business.phone}</p>}
        {business.email && <p>{business.email}</p>}
        {business.address && <p>{business.address}</p>}
        <hr />
        <p className="receipt-customer"><strong>{customer.name || 'Walk-in customer'}</strong></p>
        {customer.phone && <p>Phone: {customer.phone}</p>}
        {customer.email && <p>{customer.email}</p>}
        <hr />
        <div className="receipt-items">
          <div className="receipt-table-heading"><strong>ITEM</strong><strong>SIZE</strong><strong>QTY</strong><strong>PRICE</strong></div>
          {invoice.items?.map((item) => {
            const { size } = receiptVariant(item);
            return (
              <section className="receipt-item" key={item._id || `${item.productName}-${item.variantLabel}`}>
                <div className="receipt-item-grid">
                  <strong>{item.productName}</strong>
                  <span>{size || '—'}</span>
                  <span>{item.quantity}</span>
                  <span>{Number(item.unitPrice || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
                {receiptProperties(item, businessType).map(([label, value]) => (
                  <small key={label}>{label}: {value}</small>
                ))}
                <small className="receipt-item-total">Total: {money(currency, item.lineTotal ?? Number(item.quantity) * Number(item.unitPrice))}</small>
              </section>
            );
          })}
        </div>
        <hr />
        <dl>
          <div><dt>Subtotal</dt><dd>{money(currency, invoice.subtotal)}</dd></div>
          <div><dt>Discount</dt><dd>-{money(currency, invoice.discountTotal)}</dd></div>
          <div><dt>Tax</dt><dd>{money(currency, invoice.taxTotal)}</dd></div>
          <div className="receipt-total"><dt>Total</dt><dd>{money(currency, invoice.grandTotal)}</dd></div>
          <div><dt>Paid</dt><dd>{money(currency, invoice.paidAmount)}</dd></div>
          <div><dt>Balance</dt><dd>{money(currency, invoice.remainingAmount)}</dd></div>
        </dl>
        <p>Payment: {paymentMethod}</p>
        <p>Status: {invoice.paymentStatus}</p>
        <hr />
        <p className="receipt-thanks">Thank you for your shopping!</p>
      </article>
    </div>
  );
}
