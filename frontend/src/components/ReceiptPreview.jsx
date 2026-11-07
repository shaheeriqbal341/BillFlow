import { useState } from 'react';
import { Printer, X } from 'lucide-react';
import { printReceiptInBrowser } from '../services/printerService';

const money = (currency, value) => `${currency || 'PKR'} ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const receiptVariant = (item) => {
  const variant = item.productDetails?.variant || {};
  const parts = String(item.variantLabel || '').split(' / ').filter(Boolean);
  const size = String(variant.size || parts.shift() || '');
  const details = [variant.color, variant.design, ...parts].filter((part) => part && part !== size);
  return { size, details: [...new Set(details)].join(' / ') };
};

export default function ReceiptPreview({ invoice, payments = [], onClose, testMode = false }) {
  const [printNotice, setPrintNotice] = useState({ invoiceId: null, message: '' });

  if (!invoice) return null;
  const printMessage = printNotice.invoiceId === invoice._id ? printNotice.message : '';
  const business = invoice.businessId || {};
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
        {business.email && <p>{business.email}</p>}
        {business.phone && <p>{business.phone}</p>}
        {business.address && <p>{business.address}</p>}
        <hr />
        <p className="receipt-title">Receipt</p>
        <p className="receipt-customer"><strong>{customer.name || 'Walk-in customer'}</strong></p>
        <p>Date: {new Date(invoice.invoiceDate || invoice.createdAt).toLocaleString()}</p>
        <p>Invoice: {invoice.invoiceNumber}</p>
        {customer.phone && <p>Phone: {customer.phone}</p>}
        {customer.email && <p>{customer.email}</p>}
        <hr />
        <div className="receipt-items">
          <div className="receipt-table-heading"><strong>ITEM</strong><strong>SIZE</strong><strong>PRICE</strong></div>
          {invoice.items?.map((item) => {
            const { size, details } = receiptVariant(item);
            return (
              <section className="receipt-item" key={item._id || `${item.productName}-${item.variantLabel}`}>
                <div className="receipt-item-grid">
                  <strong>{item.productName}</strong>
                  <span>{size || '—'}</span>
                  <span>{Number(item.unitPrice || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
                {details && <small>{details}</small>}
                {item.productDetails?.brand && <small>{item.productDetails.brand}</small>}
                {item.productDetails?.description && <small>{item.productDetails.description}</small>}
                {item.productDetails?.industryDetails && (
                  <small>{Object.entries(item.productDetails.industryDetails)
                    .filter(([, value]) => value !== '' && value !== null && value !== undefined)
                    .map(([key, value]) => `${key.replace(/([A-Z])/g, ' $1')}: ${value instanceof Date ? value.toLocaleDateString() : String(value)}`)
                    .join(' · ')}</small>
                )}
                <small className="receipt-item-meta">Qty: {item.quantity} {item.unit || ''}</small>
                <small className="receipt-item-total"><span>Total:</span><span>{money(currency, item.lineTotal)}</span></small>
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
        <p className="receipt-thanks">Thank you for your business!</p>
      </article>
    </div>
  );
}
