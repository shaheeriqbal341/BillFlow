import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';

const today = () => new Date().toISOString().slice(0, 10);

export default function SubscriptionsPage() {
  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [payments, setPayments] = useState([]);
  const [history, setHistory] = useState([]);
  const [paymentInstructions, setPaymentInstructions] = useState({ instructions: '', methods: ['bank_transfer', 'cash', 'other'] });
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [reference, setReference] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [paymentDate, setPaymentDate] = useState(today);
  const [proofDataUrl, setProofDataUrl] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [plansResponse, subscriptionResponse, instructionsResponse] = await Promise.all([
        api.get('/subscriptions/plans'),
        api.get('/subscriptions'),
        api.get('/subscriptions/payment-instructions'),
      ]);
      setPlans(plansResponse.data.plans || []);
      setSubscription(subscriptionResponse.data.subscription);
      setPayments(subscriptionResponse.data.payments || []);
      setHistory(subscriptionResponse.data.history || []);
      setPaymentInstructions(instructionsResponse.data);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not load subscription information');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectPlan = async (plan) => {
    setError('');
    setNotice('');
    if (plan.key === 'FREE') {
      setSaving(true);
      try {
        const { data } = await api.post('/subscriptions/request', { planId: plan._id, billingCycle: 'monthly' });
        setNotice(data.message || 'Free plan activated.');
        await load();
      } catch (requestError) {
        setError(requestError.response?.data?.message || 'Could not activate plan');
      } finally {
        setSaving(false);
      }
      return;
    }
    setSelectedPlan(plan);
    setReference('');
    setPaymentMethod(paymentInstructions.methods?.[0] || 'manual');
    setPaymentDate(today());
    setProofDataUrl('');
    setPaymentNotes('');
  };

  const submitPayment = async (event) => {
    event.preventDefault();
    if (!selectedPlan) return;
    setSaving(true);
    setError('');
    try {
      const { data } = await api.post('/subscriptions/request', {
        planId: selectedPlan._id,
        billingCycle,
        amount: Number(currentPrice(selectedPlan)),
        reference: reference.trim(),
        method: paymentMethod,
        paymentDate,
        proofDataUrl,
        notes: paymentNotes.trim(),
      });
      setSelectedPlan(null);
      setNotice(data.message);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not submit payment reference');
    } finally {
      setSaving(false);
    }
  };

  const uploadProof = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 1_800_000) {
      setError('Choose a PNG, JPEG, or WebP proof image smaller than 1.8 MB.');
      setProofDataUrl('');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setProofDataUrl(String(reader.result || ''));
      setError('');
    };
    reader.onerror = () => {
      setProofDataUrl('');
      setError('Could not read the selected payment proof image.');
    };
    reader.readAsDataURL(file);
  };

  const cancel = async () => {
    if (!window.confirm('Cancel renewal for your current paid subscription?')) return;
    setSaving(true);
    setError('');
    try {
      const { data } = await api.post('/subscriptions/cancel');
      setNotice(data.message);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not cancel subscription');
    } finally {
      setSaving(false);
    }
  };

  const renew = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { data } = await api.post('/subscriptions/renew', {
        reference: reference.trim(),
        method: paymentInstructions.methods?.[0] || 'manual',
        paymentDate,
        proofDataUrl,
        notes: paymentNotes.trim(),
      });
      setNotice(data.message);
      setReference('');
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not submit renewal payment');
    } finally {
      setSaving(false);
    }
  };

  const activePlanName = subscription?.planId?.name || subscription?.planName || 'Free';
  const isPaidPlan = !['FREE', 'Free'].includes(subscription?.planName);
  const currentPrice = (plan) => billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
  const usageRows = [
    ['Invoices this period', subscription?.usage?.invoicesUsed, subscription?.usageLimits?.invoices ?? subscription?.planId?.limits?.invoices],
    ['Customers', subscription?.usage?.customersUsed, subscription?.usageLimits?.customers ?? subscription?.planId?.limits?.customers],
    ['Products', subscription?.usage?.productsUsed, subscription?.usageLimits?.products ?? subscription?.planId?.limits?.products],
    ['Staff accounts', subscription?.usage?.staffUsed, subscription?.usageLimits?.staff ?? subscription?.planId?.limits?.staff],
  ];

  return (
    <div className="page-box">
      <div className="page-header">
        <div><p className="eyebrow">Plans</p><h2>Subscriptions</h2></div>
        <label className="cycle-select">Billing
          <select value={billingCycle} onChange={(event) => setBillingCycle(event.target.value)}>
            <option value="monthly">Monthly</option><option value="yearly">Yearly</option>
          </select>
        </label>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      {loading ? <div className="card">Loading plans...</div> : (
        <>
          <section className="current-subscription card">
            <div>
              <p className="eyebrow">Current plan</p>
              <h3>{activePlanName}</h3>
              <p>Status: <strong>{subscription?.status || 'Not set'}</strong> · Renewal: {subscription?.renewalStatus || 'manual'}</p>
              <p>Expires: {subscription?.expiryDate ? new Date(subscription.expiryDate).toLocaleDateString() : 'No expiry'}</p>
            </div>
            {isPaidPlan && subscription?.renewalStatus !== 'cancelled' && (
              <button className="btn btn-outline-danger" onClick={cancel} disabled={saving}>Cancel renewal</button>
            )}
          </section>
          <section className="card subscription-usage-card">
            <div className="section-heading">
              <div><p className="eyebrow">Plan usage</p><h2>Usage and limits</h2></div>
              <span className={`status-badge ${subscription?.status || 'pending'}`}>{subscription?.status || 'Not set'}</span>
            </div>
            <div className="usage-grid">
              {usageRows.map(([label, usedValue, limitValue]) => {
                const used = Number(usedValue || 0);
                const limit = Number(limitValue || 0);
                const percentage = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
                return (
                  <div className="usage-item" key={label}>
                    <div className="usage-item-heading"><span>{label}</span><strong>{used.toLocaleString()} <small>of {limit.toLocaleString()}</small></strong></div>
                    <div className="usage-meter" role="progressbar" aria-label={label} aria-valuenow={used} aria-valuemin="0" aria-valuemax={limit || 1}>
                      <span style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="plan-cards">
            {plans.map((plan) => (
              <article className={`card plan-card ${plan.key === subscription?.planName ? 'current' : ''}`} key={plan._id}>
                <p className="eyebrow">{plan.key === 'FREE' ? 'Start here' : 'Subscription'}</p>
                <h3>{plan.name}</h3>
                <p>{plan.description}</p>
                <strong className="plan-price">{currentPrice(plan) === 0 ? 'Free' : `PKR ${Number(currentPrice(plan)).toLocaleString()}`}<small> / {billingCycle === 'yearly' ? 'year' : 'month'}</small></strong>
                <ul>
                  <li>{plan.limits?.invoices ?? 0} invoices per month</li>
                  <li>{plan.limits?.customers ?? 0} customers</li>
                  <li>{plan.limits?.products ?? 0} products</li>
                  <li>{plan.limits?.staff ?? 0} staff accounts</li>
                  {Object.entries(plan.features || {}).filter(([, enabled]) => enabled).map(([feature]) => <li key={feature}>{feature.replace(/([A-Z])/g, ' $1')}</li>)}
                </ul>
                <button className="btn btn-primary" disabled={saving || plan.key === subscription?.planName} onClick={() => selectPlan(plan)}>
                  {plan.key === subscription?.planName ? 'Current plan' : plan.key === 'FREE' ? 'Select Free' : 'Choose plan'}
                </button>
              </article>
            ))}
          </div>

          {isPaidPlan && (subscription?.renewalStatus === 'cancelled' || subscription?.status === 'expired') && (
            <form className="card renewal-form" onSubmit={renew}>
              <h3>Submit a renewal payment</h3>
              <p>Renewal is manually reviewed. Your subscription does not renew until an administrator approves the reference.</p>
              <div className="entity-form-grid">
                <label>Manual method<select value={paymentInstructions.methods?.[0] || 'manual'} disabled>
                  {(paymentInstructions.methods || ['manual']).map((method) => <option key={method} value={method}>{method.replace(/_/g, ' ')}</option>)}
                </select></label>
                <label>Payment date<input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} required /></label>
                <label className="wide-field">Proof image (optional)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadProof} /></label>
                <label className="wide-field">Notes<textarea rows="2" maxLength="1000" value={paymentNotes} onChange={(event) => setPaymentNotes(event.target.value)} /></label>
              </div>
              <div className="entity-form-actions">
                <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Bank/payment reference" required minLength="3" maxLength="120" />
                <button className="btn btn-primary" disabled={saving}>{saving ? 'Submitting...' : 'Submit renewal'}</button>
              </div>
            </form>
          )}

          {selectedPlan && (
            <div className="modal-backdrop" onClick={() => setSelectedPlan(null)}>
              <section className="business-detail-modal payment-request-modal" role="dialog" aria-modal="true" aria-label="Submit plan payment" onClick={(event) => event.stopPropagation()}>
                <button className="modal-close" onClick={() => setSelectedPlan(null)}>Close</button>
                <h2>Request {selectedPlan.name}</h2>
                <p>{formatPlanAmount(currentPrice(selectedPlan), billingCycle)} · {billingCycle}</p>
                <p>Submit your manual transfer or payment reference. The subscription activates only after administrator approval.</p>
                <div className="manual-payment-instructions"><strong>Payment instructions</strong><p>{paymentInstructions.instructions}</p></div>
                <form className="auth-form" onSubmit={submitPayment}>
                  <label>Payment reference<input value={reference} onChange={(event) => setReference(event.target.value)} required minLength="3" maxLength="120" /></label>
                  <label>Payment method<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} required>
                    {paymentInstructions.methods?.map((method) => <option key={method} value={method}>{method.replace(/_/g, ' ')}</option>)}
                  </select></label>
                  <label>Payment date<input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} required /></label>
                  <label>Payment proof (optional)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadProof} /></label>
                  {proofDataUrl && <img className="payment-proof-preview" src={proofDataUrl} alt="Selected payment proof preview" />}
                  <label>Additional notes<textarea rows="3" maxLength="1000" value={paymentNotes} onChange={(event) => setPaymentNotes(event.target.value)} /></label>
                  <p className="muted-copy">Do not submit card numbers, security codes, PINs, or passwords.</p>
                  <button className="btn btn-primary" disabled={saving}>{saving ? 'Submitting...' : 'Submit for review'}</button>
                </form>
              </section>
            </div>
          )}

          <section className="card admin-section-card">
            <h3>Payment requests</h3>
            <div className="table-card">
              <table><thead><tr><th>Plan</th><th>Amount</th><th>Method / Ref</th><th>Status / Notes</th><th>Payment date</th><th>Proof</th></tr></thead>
                <tbody>{payments.map((payment) => <tr key={payment._id}><td>{payment.planId?.name || payment.planName}</td><td>PKR {Number(payment.amount).toLocaleString()}</td>
                  <td>{payment.method?.replace(/_/g, ' ')}<small>{payment.reference}</small></td>
                  <td><span className={`status-badge ${payment.status}`}>{payment.status}</span>{payment.rejectionReason && <small>{payment.rejectionReason}</small>}{payment.notes && <small>{payment.notes}</small>}</td>
                  <td>{new Date(payment.paymentDate || payment.createdAt).toLocaleDateString()}</td>
                  <td>{payment.proofDataUrl ? <a href={payment.proofDataUrl} target="_blank" rel="noreferrer">View image</a> : '—'}</td></tr>)}
                  {!payments.length && <tr><td colSpan="6">No subscription payment requests.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card admin-section-card">
            <h3>Subscription history</h3>
            <div className="table-card">
              <table><thead><tr><th>Date</th><th>Plan</th><th>Action</th><th>Cycle</th><th>Period ending</th></tr></thead>
                <tbody>{history.map((entry) => <tr key={entry._id}><td>{new Date(entry.createdAt).toLocaleDateString()}</td><td>{entry.planName}</td><td>{entry.action}</td><td>{entry.billingCycle}</td><td>{entry.endsAt ? new Date(entry.endsAt).toLocaleDateString() : '—'}</td></tr>)}
                  {!history.length && <tr><td colSpan="5">No subscription history yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function formatPlanAmount(amount, cycle) {
  const price = Number(amount || 0);
  return price ? `PKR ${price.toLocaleString()} / ${cycle}` : 'Free plan';
}
