import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Search, Wallet } from 'lucide-react';
import api from '../services/api';
import ReceiptPreview from '../components/ReceiptPreview';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import NumberInput from '../components/NumberInput';

const emptyItem = { productId: '', variantId: '', quantity: 1 };
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [receiptInvoice, setReceiptInvoice] = useState(null);
  const [open, setOpen] = useState(() => new URLSearchParams(window.location.search).get('create') === '1');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [customerId, setCustomerId] = useState('');
  const [items, setItems] = useState([{ ...emptyItem }]);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [invoiceResponse, customerResponse, productResponse, paymentResponse] = await Promise.all([
        api.get('/invoices', { params: { page, limit: 20, search: escapeRegex(search), status: statusFilter || undefined } }),
        api.get('/customers', { params: { limit: 100 } }),
        api.get('/products', { params: { limit: 100 } }),
        api.get('/payments'),
      ]);
      setInvoices(invoiceResponse.data.invoices || []);
      setPages(invoiceResponse.data.pages || 1);
      setTotalRecords(invoiceResponse.data.total ?? invoiceResponse.data.invoices?.length ?? 0);
      setCustomers(customerResponse.data.customers || []);
      setProducts(productResponse.data.products || []);
      setPayments(paymentResponse.data.payments || []);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not load invoice data');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const subtotal = useMemo(() => items.reduce((sum, item) => {
    const product = products.find((entry) => entry._id === item.productId);
    const variant = product?.variants?.find((entry) => entry._id === item.variantId);
    return sum + Number(variant?.sellingPrice ?? product?.sellingPrice ?? 0) * Number(item.quantity || 0);
  }, 0), [items, products]);
  const total = Math.max(0, subtotal - Number(discount || 0)) * (1 + Number(tax || 0) / 100);
  const invoiceTotal = invoices.reduce((sum, invoice) => sum + (invoice.paymentStatus === 'cancelled' ? 0 : Number(invoice.grandTotal || 0)), 0);
  const outstandingTotal = invoices.reduce((sum, invoice) => sum + (invoice.paymentStatus === 'cancelled' ? 0 : Number(invoice.remainingAmount || 0)), 0);
  const paidInvoices = invoices.filter((invoice) => invoice.paymentStatus === 'paid').length;

  const handleDownloadPdf = async (invoiceId) => {
    setError('');
    try {
      const response = await api.get(`/invoices/${invoiceId}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${invoiceId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to download PDF');
    }
  };

  const createInvoice = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = {
        customerId,
        items: items.map((item) => ({ productId: item.productId, variantId: item.variantId || undefined, quantity: Number(item.quantity) })),
        discount: Number(discount),
        tax: Number(tax),
        paidAmount: Number(paidAmount),
        dueDate: dueDate || undefined,
        notes,
        paymentMethod,
      };
      await api.post('/invoices', payload);
      setOpen(false);
      setCustomerId('');
      setItems([{ ...emptyItem }]);
      setDiscount(0);
      setTax(0);
      setPaidAmount(0);
      setNotes('');
      setNotice('Invoice created.');
      const reloadCurrentPage = page === 1;
      setLoading(true);
      setPage(1);
      if (reloadCurrentPage) await loadData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not create invoice');
    } finally {
      setSaving(false);
    }
  };

  const updateItem = (index, key, value) => {
    setItems((current) => current.map((item, currentIndex) => currentIndex === index ? { ...item, [key]: value } : item));
  };

  return (
    <div className="page-box">
      <div className="page-header">
        <div><p className="eyebrow">Billing</p><h2>Invoices</h2><p className="page-subtitle">Create bills, track balances, and share printable invoices.</p></div>
        <button className="btn btn-primary" onClick={() => setOpen(true)}>Create invoice</button>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      <section className="stats-grid invoice-stats" aria-label="Invoice overview">
        <article className="stat-card"><div className="stat-card-top"><span>{search || statusFilter ? 'Matching invoices' : 'Total invoices'}</span><span className="metric-icon metric-icon-blue"><FileText size={17} /></span></div><strong>{totalRecords.toLocaleString()}</strong></article>
        <article className="stat-card"><div className="stat-card-top"><span>Invoiced total · current page</span><span className="metric-icon metric-icon-violet"><Wallet size={17} /></span></div><strong>PKR {invoiceTotal.toLocaleString()}</strong></article>
        <article className="stat-card"><div className="stat-card-top"><span>Outstanding · current page</span><span className="metric-icon metric-icon-amber"><Wallet size={17} /></span></div><strong>PKR {outstandingTotal.toLocaleString()}</strong></article>
        <article className="stat-card"><div className="stat-card-top"><span>Paid · current page</span><span className="metric-icon metric-icon-green"><FileText size={17} /></span></div><strong>{paidInvoices.toLocaleString()}</strong></article>
      </section>

      {open && (
        <div className="card entity-form-card">
          <div className="entity-form-heading"><h3>New invoice</h3><button className="btn btn-sm btn-outline-secondary" onClick={() => setOpen(false)}>Close</button></div>
          <form onSubmit={createInvoice}>
            <div className="entity-form-grid">
              <label>Customer<select required value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Select a customer</option>{customers.map((customer) => <option key={customer._id} value={customer._id}>{customer.name}</option>)}</select></label>
              <label>Due date<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
            </div>
            <div className="invoice-items-editor">
              <h4>Items</h4>
              {items.map((item, index) => {
                const product = products.find((entry) => entry._id === item.productId);
                const variant = product?.variants?.find((entry) => entry._id === item.variantId);
                const unitPrice = Number(variant?.sellingPrice ?? product?.sellingPrice ?? 0);
                const available = variant?.stockQuantity ?? product?.stockQuantity;
                return (
                  <div className="invoice-item-row" key={`invoice-item-${index}`}>
                    <select required value={item.productId} onChange={(event) => setItems((current) => current.map((entry, itemIndex) => itemIndex === index
                      ? { ...entry, productId: event.target.value, variantId: '' }
                      : entry))}>
                      <option value="">Select product or service</option>{products.map((entry) => <option key={entry._id} value={entry._id} disabled={!entry.isService && entry.stockQuantity <= 0}>{entry.name} · {entry.isService ? entry.pricingType : `${entry.stockQuantity} available`} · PKR {Number(entry.sellingPrice).toLocaleString()}</option>)}
                    </select>
                    {product?.variants?.length > 0 && (
                      <select required value={item.variantId} onChange={(event) => updateItem(index, 'variantId', event.target.value)} aria-label="Product variant">
                        <option value="">Select size / color</option>
                        {product.variants.map((entry) => <option key={entry._id} value={entry._id} disabled={entry.stockQuantity <= 0}>{[entry.size, entry.color, entry.design].filter(Boolean).join(' / ')} · {entry.stockQuantity} available</option>)}
                      </select>
                    )}
                    <NumberInput min={product?.isService ? '0.01' : '1'} step={product?.isService ? '0.01' : '1'} max={product?.isService ? undefined : available || undefined} value={item.quantity} onChange={(event) => updateItem(index, 'quantity', event.target.value)} required aria-label="Quantity" />
                    <span>{product ? `PKR ${(unitPrice * Number(item.quantity)).toLocaleString()}` : '—'}</span>
                    {items.length > 1 && <button className="btn btn-sm btn-outline-danger" type="button" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>}
                  </div>
                );
              })}
              <button className="btn btn-sm btn-outline-primary" type="button" onClick={() => setItems((current) => [...current, { ...emptyItem }])}>Add line item</button>
            </div>
            <div className="entity-form-grid">
              <label>Discount amount<NumberInput min="0" max={subtotal} step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} /></label>
              <label>Tax rate (%)<NumberInput min="0" max="100" step="0.01" value={tax} onChange={(event) => setTax(event.target.value)} /></label>
              <label>Paid now<NumberInput min="0" max={total} step="0.01" value={paidAmount} onChange={(event) => setPaidAmount(event.target.value)} /></label>
              <label>Payment method<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option>Cash</option><option>Bank Transfer</option><option>Card</option><option>Other</option></select></label>
              <label className="wide-field">Notes<textarea rows="2" value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
              <div className="wide-field invoice-total-preview">Subtotal: PKR {subtotal.toLocaleString()} · Estimated total: PKR {total.toFixed(2)}</div>
              <div className="wide-field entity-form-actions"><button className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save invoice'}</button></div>
            </div>
          </form>
        </div>
      )}

      <section className="card invoice-history-card">
        <div className="section-heading invoice-history-heading">
          <div><p className="eyebrow">Billing records</p><h2>All invoices</h2></div>
          <div className="table-filters">
            <label className="table-search"><Search size={16} /><input aria-label="Search invoices" placeholder="Search invoice number" value={search} onChange={(event) => { setLoading(true); setSearch(event.target.value); setPage(1); }} /></label>
            <select aria-label="Filter invoices by status" value={statusFilter} onChange={(event) => { setLoading(true); setStatusFilter(event.target.value); setPage(1); }}>
              <option value="">All statuses</option><option value="paid">Paid</option><option value="partial">Partial</option><option value="unpaid">Unpaid</option><option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      {loading ? <div className="loading-card" aria-busy="true">Loading invoices...</div> : invoices.length ? (
        <div className="table-card">
          <table>
            <thead><tr><th>Invoice #</th><th>Customer</th><th>Date</th><th>Status</th><th>Total</th><th>Balance</th><th>Actions</th></tr></thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice._id}>
                  <td>{invoice.invoiceNumber}</td><td>{invoice.customerId?.name || 'Unknown'}</td><td>{new Date(invoice.invoiceDate).toLocaleDateString()}</td>
                  <td><span className={`status-badge ${invoice.paymentStatus}`}>{invoice.paymentStatus}</span></td>
                  <td>PKR {Number(invoice.grandTotal || 0).toLocaleString()}</td><td>PKR {Number(invoice.remainingAmount || 0).toLocaleString()}</td>
                  <td className="action-cell">
                    <button className="btn btn-sm btn-outline-primary" onClick={() => handleDownloadPdf(invoice._id)}>A4 PDF</button>
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setReceiptInvoice(invoice)}>Receipt</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <EmptyState icon={FileText} title={search || statusFilter ? 'No matching invoices' : 'No invoices yet'} description={search || statusFilter ? 'Try another invoice number or clear the selected status filter.' : 'Create your first invoice to start tracking sales and payments.'} action={!search && !statusFilter && <button className="btn btn-primary" onClick={() => setOpen(true)}>Create invoice</button>} />}
      <Pagination page={page} pages={pages} total={totalRecords} onChange={(nextPage) => { setLoading(true); setPage(nextPage); }} />
      </section>
      <ReceiptPreview invoice={receiptInvoice} payments={payments} onClose={() => setReceiptInvoice(null)} />
    </div>
  );
}
