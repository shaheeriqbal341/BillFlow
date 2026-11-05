import { useCallback, useEffect, useState } from 'react';
import { CreditCard, Search, Wallet } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import api from '../services/api';
import NumberInput from '../components/NumberInput';

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [outstandingTotal, setOutstandingTotal] = useState(0);
  const [invoiceId, setInvoiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [paymentResponse, invoiceResponse] = await Promise.all([
        api.get('/payments'),
        api.get('/invoices', { params: { limit: 100 } }),
      ]);
      setPayments(paymentResponse.data.payments || []);
      setInvoices(invoiceResponse.data.invoices || []);
      setOutstandingTotal(Number(paymentResponse.data.totalOutstanding || 0));
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not load payments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectedInvoice = invoices.find((invoice) => invoice._id === invoiceId);
  const totalCollected = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const visiblePayments = payments.filter((payment) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    const invoice = invoices.find((entry) => entry._id === String(payment.invoiceId));
    return [
      invoice?.invoiceNumber,
      invoice?.customerId?.name,
      payment.method,
      payment.referenceNumber,
      payment.notes,
    ].some((value) => String(value || '').toLowerCase().includes(query));
  });

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await api.post('/payments', {
        invoiceId,
        amount: Number(amount),
        method,
        referenceNumber,
        notes,
      });
      setAmount('');
      setReferenceNumber('');
      setNotes('');
      setNotice('Payment recorded.');
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not record payment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-box">
      <div className="page-header"><div><p className="eyebrow">Cash flow</p><h2>Payments</h2><p className="page-subtitle">Record collections and review payment history.</p></div></div>
      {error && <div className="alert alert-danger">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      <section className="stats-grid payment-stats" aria-label="Payment summary">
        <article className="stat-card"><div className="stat-card-top"><span>Total collected</span><span className="metric-icon metric-icon-green"><Wallet size={17} /></span></div><strong>PKR {totalCollected.toLocaleString()}</strong></article>
        <article className="stat-card"><div className="stat-card-top"><span>Payment records</span><span className="metric-icon metric-icon-blue"><CreditCard size={17} /></span></div><strong>{payments.length.toLocaleString()}</strong></article>
        <article className="stat-card"><div className="stat-card-top"><span>Outstanding balance</span><span className="metric-icon metric-icon-amber"><Wallet size={17} /></span></div><strong>PKR {outstandingTotal.toLocaleString()}</strong></article>
      </section>

      <section className="card payment-entry-card">
        <h3>Record invoice payment</h3>
        <form className="entity-form-grid" onSubmit={submit}>
          <label className="wide-field">Invoice
            <select required value={invoiceId} onChange={(event) => setInvoiceId(event.target.value)}>
              <option value="">Select an outstanding invoice</option>
              {invoices.filter((invoice) => invoice.paymentStatus !== 'cancelled' && Number(invoice.remainingAmount) > 0).map((invoice) => (
                <option key={invoice._id} value={invoice._id}>{invoice.invoiceNumber} · {invoice.customerId?.name || 'Customer'} · Balance PKR {Number(invoice.remainingAmount).toLocaleString()}</option>
              ))}
            </select>
          </label>
          {selectedInvoice && <p className="wide-field">Outstanding: <strong>PKR {Number(selectedInvoice.remainingAmount).toLocaleString()}</strong></p>}
          <label>Amount<NumberInput min="0.01" max={selectedInvoice?.remainingAmount} step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
          <label>Payment method<select value={method} onChange={(event) => setMethod(event.target.value)}><option>Cash</option><option>Bank Transfer</option><option>Card</option><option>Other</option></select></label>
          <label>Reference number<input value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} maxLength="120" /></label>
          <label>Notes<input value={notes} onChange={(event) => setNotes(event.target.value)} maxLength="500" /></label>
          <div className="wide-field entity-form-actions"><button className="btn btn-primary" disabled={saving}>{saving ? 'Recording...' : 'Record payment'}</button></div>
        </form>
      </section>

      <section className="card payment-history-card">
        <div className="section-heading">
          <div><p className="eyebrow">Transactions</p><h2>Payment history</h2></div>
          <label className="table-search"><Search size={16} /><input aria-label="Search payments" placeholder="Search invoice, method, or reference" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        </div>
      {loading ? <div className="loading-card" aria-busy="true">Loading payments...</div> : visiblePayments.length ? (
        <div className="table-card">
          <table>
            <thead><tr><th>Invoice / customer</th><th>Amount</th><th>Method</th><th>Reference</th><th>Date</th><th>Status</th></tr></thead>
            <tbody>
              {visiblePayments.map((payment) => {
                const invoice = invoices.find((entry) => entry._id === String(payment.invoiceId));
                return (
                  <tr key={payment._id}>
                    <td>{invoice?.invoiceNumber || String(payment.invoiceId || 'Invoice')}<small>{invoice?.customerId?.name || 'Customer'}</small></td>
                    <td>PKR {Number(payment.amount || 0).toLocaleString()}</td>
                    <td>{payment.method}</td><td>{payment.referenceNumber || '—'}</td>
                    <td>{new Date(payment.paymentDate).toLocaleDateString()}</td>
                    <td><span className="status-badge paid">Recorded</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <EmptyState icon={CreditCard} title={search ? 'No matching payments' : 'No payments recorded'} description={search ? 'Try another invoice number, payment method, or reference.' : 'Payments recorded against invoices will appear here.'} />}
      </section>
    </div>
  );
}
