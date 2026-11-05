import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Building2,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import ThemeToggle from '../components/ThemeToggle';
import NumberInput from '../components/NumberInput';

const sections = [
  { label: 'Platform overview', value: 'Overview', icon: LayoutDashboard },
  { label: 'Businesses', value: 'Businesses', icon: Building2 },
  { label: 'Subscription plans', value: 'Plans', icon: Package },
  { label: 'Payment approvals', value: 'Payments', icon: CreditCard },
  { label: 'Audit log', value: 'Audit log', icon: Activity },
];
const paymentMethods = [
  ['bank_transfer', 'Bank transfer'],
  ['cash', 'Cash'],
  ['other', 'Other manual method'],
];
const initialPlanForm = {
  name: '',
  key: '',
  description: '',
  monthlyPrice: 0,
  yearlyPrice: 0,
};

function formatAmount(value) {
  return `PKR ${Number(value || 0).toLocaleString()}`;
}

export default function SuperAdminPage() {
  const { user, logout } = useAuth();
  const [section, setSection] = useState('Overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [overview, setOverview] = useState({});
  const [businesses, setBusinesses] = useState([]);
  const [plans, setPlans] = useState([]);
  const [payments, setPayments] = useState([]);
  const [paymentRecords, setPaymentRecords] = useState({ invoicePayments: [], subscriptionPayments: [] });
  const [logs, setLogs] = useState([]);
  const [paymentSettings, setPaymentSettings] = useState({ instructions: '', methods: ['bank_transfer', 'cash', 'other'] });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [businessDetails, setBusinessDetails] = useState(null);
  const [planForm, setPlanForm] = useState(initialPlanForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [overviewResponse, businessResponse, plansResponse, paymentResponse, paymentRecordsResponse, logsResponse, paymentSettingsResponse] = await Promise.all([
        api.get('/admin/overview'),
        api.get('/admin/businesses', { params: { search, status: statusFilter } }),
        api.get('/admin/plans'),
        api.get('/admin/subscription-payments'),
        api.get('/admin/payments'),
        api.get('/admin/audit-logs'),
        api.get('/admin/payment-settings'),
      ]);
      setOverview(overviewResponse.data.overview || {});
      setBusinesses(businessResponse.data.businesses || []);
      setPlans(plansResponse.data.plans || []);
      setPayments(paymentResponse.data.payments || []);
      setPaymentRecords(paymentRecordsResponse.data || { invoicePayments: [], subscriptionPayments: [] });
      setLogs(logsResponse.data.logs || []);
      setPaymentSettings(paymentSettingsResponse.data.settings || { instructions: '', methods: [] });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load administrator data');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  useEffect(() => {
    if (!mobileNavOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMobileNavOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileNavOpen]);

  const setBusinessState = async (business, status) => {
    setNotice('');
    setError('');
    try {
      await api.patch(`/admin/businesses/${business._id}/status`, { status });
      setNotice(`${business.name} ${status === 'active' ? 'activated' : 'suspended'}.`);
      await loadAdminData();
      if (businessDetails?._id === business._id) {
        const { data } = await api.get(`/admin/businesses/${business._id}`);
        setBusinessDetails(data);
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Business status update failed');
    }
  };

  const reviewPayment = async (payment, decision) => {
    const rejectionReason = decision === 'rejected' ? window.prompt('Reason shown to the business owner (optional):') : '';
    if (decision === 'rejected' && rejectionReason === null) return;
    const internalNote = window.prompt('Private administrator note (optional):') || '';
    setError('');
    try {
      await api.patch(`/admin/subscription-payments/${payment._id}/review`, { decision, internalNote, rejectionReason: rejectionReason || '' });
      setNotice(`Payment ${decision}.`);
      await loadAdminData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Payment review failed');
    }
  };

  const savePaymentSettings = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const { data } = await api.put('/admin/payment-settings', paymentSettings);
      setPaymentSettings(data.settings);
      setNotice('Manual payment instructions updated.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Payment settings could not be saved');
    }
  };

  const togglePaymentMethod = (method) => {
    setPaymentSettings((current) => {
      const methods = current.methods.includes(method)
        ? current.methods.filter((item) => item !== method)
        : [...current.methods, method];
      return { ...current, methods };
    });
  };

  const updatePlan = async (plan, field, value) => {
    const patch = field.includes('.')
      ? { [field.split('.')[0]]: { ...plan[field.split('.')[0]], [field.split('.')[1]]: value } }
      : { [field]: value };
    try {
      await api.patch(`/admin/plans/${plan._id}`, patch);
      setNotice(`${plan.name} plan updated.`);
      await loadAdminData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Plan update failed');
    }
  };

  const createPlan = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await api.post('/admin/plans', {
        ...planForm,
        key: planForm.key.toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
        monthlyPrice: Number(planForm.monthlyPrice),
        yearlyPrice: Number(planForm.yearlyPrice),
        limits: { invoices: 100, customers: 100, products: 100, staff: 1 },
        features: { basicReports: true, advancedReports: false, pdfDownloads: true, inventory: true, staffAccounts: true },
      });
      setPlanForm(initialPlanForm);
      setNotice('Plan created.');
      await loadAdminData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not create plan');
    }
  };

  const openBusiness = async (id) => {
    setError('');
    try {
      const { data } = await api.get(`/admin/businesses/${id}`);
      setBusinessDetails(data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not load business');
    }
  };

  const signOut = async () => {
    await logout();
    window.location.href = '/login';
  };

  const summaryCards = [
    ['Businesses', overview.businessCount, Building2],
    ['Registered users', overview.userCount, LayoutDashboard],
    ['Active subscriptions', overview.activeSubscriptions, Package],
    ['Free businesses', overview.freeBusinesses, Building2],
    ['Paid businesses', overview.paidBusinesses, CreditCard],
    ['Payments recorded', overview.paymentCount, Activity],
    ['Payment volume', formatAmount(overview.paymentTotal), CreditCard],
    ['Pending reviews', overview.pendingPayments, Activity],
  ];

  return (
    <div className={`admin-shell${mobileNavOpen ? ' admin-nav-open' : ''}`}>
      {mobileNavOpen && <button className="admin-sidebar-backdrop" type="button" aria-label="Close platform navigation" onClick={() => setMobileNavOpen(false)} />}
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-mark"><Building2 size={19} /></span>
          <span><strong>BillFlow</strong><small>Platform administration</small></span>
          <button className="admin-sidebar-close" type="button" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)}><X size={19} /></button>
        </div>
        <div className="admin-sidebar-caption">Control center</div>
        <nav className="admin-nav" aria-label="Platform administration">
          {sections.map(({ label, value, icon: Icon }) => (
            <button
              key={value}
              type="button"
              className={`admin-nav-link${section === value ? ' active' : ''}`}
              aria-current={section === value ? 'page' : undefined}
              onClick={() => { setSection(value); setMobileNavOpen(false); }}
            >
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <span className="admin-account-avatar">{(user?.fullName || 'A').split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')}</span>
          <span className="admin-account-copy"><strong>{user?.fullName || 'Administrator'}</strong><small>Super Admin</small></span>
        </div>
      </aside>
      <div className="admin-workspace">
        <header className="admin-header">
          <div className="admin-header-title">
            <button className="admin-mobile-menu" type="button" aria-label="Open platform navigation" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen(true)}><Menu size={20} /></button>
            <div><div className="eyebrow">BillFlow control center</div><h1>{section === 'Overview' ? 'Platform overview' : section === 'Plans' ? 'Subscription plans' : section === 'Payments' ? 'Payment approvals' : section}</h1></div>
          </div>
          <div className="admin-user">
            <span className="admin-platform-label">Platform administration</span>
            <ThemeToggle compact />
            <details className="admin-profile-menu">
              <summary aria-label={`Open account menu for ${user?.fullName || 'administrator'}`}>
                <span className="admin-header-avatar" aria-hidden="true">{(user?.fullName || 'A').split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')}</span>
                <span>{user?.fullName || 'Administrator'}</span>
              </summary>
              <div className="admin-profile-popover">
                <strong>Super Admin</strong>
                <button className="btn btn-outline-secondary btn-sm" type="button" onClick={signOut}><LogOut size={15} /> Sign out</button>
              </div>
            </details>
          </div>
        </header>
        <main className="admin-content">
          {error && <div className="alert alert-danger" role="alert">{error}</div>}
          {notice && <div className="alert alert-success" role="status">{notice}</div>}
          {loading ? <div className="card">Loading administrator data...</div> : null}

      {!loading && section === 'Overview' && (
        <section>
          <div className="admin-stat-grid">
            {summaryCards.map(([label, value, Icon], index) => (
              <article className="stat-card" key={label}>
                <div className="admin-stat-heading"><span>{label}</span><span className={`metric-icon metric-icon-${['blue', 'cyan', 'green', 'blue', 'green', 'violet', 'blue', 'amber'][index]}`}><Icon size={18} /></span></div>
                <strong>{value ?? 0}</strong>
              </article>
            ))}
          </div>
          <div className="card admin-section-card">
            <h2>Recent subscription requests</h2>
            <PaymentsTable payments={payments.filter((payment) => payment.status === 'pending').slice(0, 5)} onReview={reviewPayment} />
          </div>
        </section>
      )}

      {!loading && section === 'Businesses' && (
        <section className="card admin-section-card">
          <div className="admin-toolbar">
            <h2>Business accounts</h2>
            <input aria-label="Search businesses" placeholder="Search business or email" value={search} onChange={(event) => setSearch(event.target.value)} />
            <select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          <div className="table-card">
            <table>
              <thead><tr><th>Business</th><th>Owner</th><th>Status</th><th>Plan</th><th>Renewal / Expiry</th><th>Actions</th></tr></thead>
              <tbody>
                {businesses.map((business) => (
                  <tr key={business._id}>
                    <td><button className="table-link" onClick={() => openBusiness(business._id)}>{business.name}</button><small>{business.email}</small></td>
                    <td>{business.owner?.fullName || '—'}<small>{business.owner?.email}</small></td>
                    <td><span className={`status-badge ${business.status}`}>{business.status}</span></td>
                    <td>{business.subscription?.planId?.name || business.subscription?.planName || 'No plan'}</td>
                    <td>{business.subscription?.expiryDate ? new Date(business.subscription.expiryDate).toLocaleDateString() : business.subscription?.renewalStatus || '—'}</td>
                    <td className="action-cell">
                      <button className="btn btn-sm btn-outline-primary" onClick={() => openBusiness(business._id)}>Details</button>
                      <button className={`btn btn-sm ${business.status === 'active' ? 'btn-outline-danger' : 'btn-outline-success'}`} onClick={() => setBusinessState(business, business.status === 'active' ? 'suspended' : 'active')}>
                        {business.status === 'active' ? 'Suspend' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
                {!businesses.length && <tr><td colSpan="6">No businesses match this search.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!loading && section === 'Plans' && (
        <section>
          <div className="card admin-section-card">
            <h2>Create a plan</h2>
            <form className="plan-create-form" onSubmit={createPlan}>
              <input placeholder="Plan name" value={planForm.name} onChange={(event) => setPlanForm({ ...planForm, name: event.target.value })} required />
              <input placeholder="Unique plan key" value={planForm.key} onChange={(event) => setPlanForm({ ...planForm, key: event.target.value })} required />
              <NumberInput placeholder="Monthly price" min="0" value={planForm.monthlyPrice} onChange={(event) => setPlanForm({ ...planForm, monthlyPrice: event.target.value })} required />
              <NumberInput placeholder="Yearly price" min="0" value={planForm.yearlyPrice} onChange={(event) => setPlanForm({ ...planForm, yearlyPrice: event.target.value })} required />
              <input placeholder="Description" value={planForm.description} onChange={(event) => setPlanForm({ ...planForm, description: event.target.value })} />
              <button className="btn btn-primary">Create plan</button>
            </form>
          </div>
          <div className="plan-admin-grid">
            {plans.map((plan) => (
              <article className="card plan-admin-card" key={plan._id}>
                <div className="plan-admin-title">
                  <div><span>{plan.key}</span></div>
                  <button className={`btn btn-sm ${plan.active ? 'btn-outline-danger' : 'btn-outline-success'}`} onClick={() => updatePlan(plan, 'active', !plan.active)}>{plan.active ? 'Deactivate' : 'Activate'}</button>
                </div>
                    <label>Plan name<input value={plan.name} onChange={(event) => setPlans((items) => items.map((item) => item._id === plan._id ? { ...item, name: event.target.value } : item))} onBlur={(event) => updatePlan(plan, 'name', event.target.value)} /></label>
                    <label>Description<input value={plan.description || ''} onChange={(event) => setPlans((items) => items.map((item) => item._id === plan._id ? { ...item, description: event.target.value } : item))} onBlur={(event) => updatePlan(plan, 'description', event.target.value)} /></label>
                <label>Monthly price<NumberInput min="0" value={plan.monthlyPrice} onChange={(event) => setPlans((items) => items.map((item) => item._id === plan._id ? { ...item, monthlyPrice: event.target.value } : item))} onBlur={(event) => updatePlan(plan, 'monthlyPrice', Number(event.target.value))} /></label>
                <label>Yearly price<NumberInput min="0" value={plan.yearlyPrice} onChange={(event) => setPlans((items) => items.map((item) => item._id === plan._id ? { ...item, yearlyPrice: event.target.value } : item))} onBlur={(event) => updatePlan(plan, 'yearlyPrice', Number(event.target.value))} /></label>
                {['invoices', 'customers', 'products', 'staff'].map((key) => (
                  <label key={key}>{key[0].toUpperCase() + key.slice(1)} limit<NumberInput min="0" value={plan.limits?.[key] ?? 0} onChange={(event) => setPlans((items) => items.map((item) => item._id === plan._id ? { ...item, limits: { ...item.limits, [key]: Number(event.target.value) } } : item))} onBlur={(event) => updatePlan(plan, `limits.${key}`, Number(event.target.value))} /></label>
                ))}
                {Object.entries(plan.features || {}).map(([key, enabled]) => (
                  <label className="feature-toggle" key={key}>
                    <input type="checkbox" checked={Boolean(enabled)} onChange={(event) => updatePlan(plan, `features.${key}`, event.target.checked)} />
                    {key.replace(/([A-Z])/g, ' $1')}
                  </label>
                ))}
              </article>
            ))}
          </div>
        </section>
      )}

      {!loading && section === 'Payments' && (
        <>
          <section className="card admin-section-card">
            <h2>Manual subscription payment instructions</h2>
            <p>These instructions are shown to business owners when requesting a paid plan. Never include private admin credentials.</p>
            <form className="payment-settings-form" onSubmit={savePaymentSettings}>
              <label>Instructions<textarea rows="4" maxLength="2000" value={paymentSettings.instructions} onChange={(event) => setPaymentSettings({ ...paymentSettings, instructions: event.target.value })} placeholder="Provide the payment details and steps customers should follow." required /></label>
              <fieldset><legend>Accepted manual methods</legend>
                {paymentMethods.map(([method, label]) => <label key={method}><input type="checkbox" checked={paymentSettings.methods.includes(method)} onChange={() => togglePaymentMethod(method)} /> {label}</label>)}
              </fieldset>
              <button className="btn btn-primary" type="submit">Save payment settings</button>
            </form>
          </section>
          <section className="card admin-section-card">
            <h2>Subscription payment review</h2>
            <PaymentsTable payments={payments} onReview={reviewPayment} />
          </section>
          <section className="card admin-section-card">
            <h2>Business invoice payments</h2>
            <div className="table-card">
              <table><thead><tr><th>Business</th><th>Invoice</th><th>Amount</th><th>Method</th><th>Date</th></tr></thead>
                <tbody>{paymentRecords.invoicePayments.map((payment) => <tr key={payment._id}><td>{payment.businessId?.name || '—'}</td><td>{payment.invoiceId?.invoiceNumber || '—'}</td><td>{formatAmount(payment.amount)}</td><td>{payment.method}</td><td>{new Date(payment.paymentDate).toLocaleDateString()}</td></tr>)}
                  {!paymentRecords.invoicePayments.length && <tr><td colSpan="5">No invoice payment records.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {!loading && section === 'Audit log' && (
        <section className="card admin-section-card">
          <h2>Administrator audit log</h2>
          <div className="table-card">
            <table><thead><tr><th>Time</th><th>Admin</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
              <tbody>{logs.map((log) => <tr key={log._id}><td>{new Date(log.createdAt).toLocaleString()}</td><td>{log.actorId?.email || '—'}</td><td>{log.action}</td><td>{log.targetType}</td><td>{JSON.stringify(log.details || {})}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}

      {businessDetails && (
        <div className="modal-backdrop" role="presentation" onClick={() => setBusinessDetails(null)}>
          <section className="business-detail-modal" role="dialog" aria-modal="true" aria-label="Business details" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setBusinessDetails(null)}>Close</button>
            <h2>{businessDetails.business.name}</h2>
            <p>{businessDetails.business.email || 'No email'} · {businessDetails.business.status}</p>
            <div className="detail-grid">
              <span>Owner</span><strong>{businessDetails.business.owner?.fullName || '—'}</strong>
              <span>Users</span><strong>{businessDetails.userCount}</strong>
              <span>Invoices</span><strong>{businessDetails.invoiceCount}</strong>
              <span>Plan</span><strong>{businessDetails.subscription?.planId?.name || businessDetails.subscription?.planName || '—'}</strong>
              <span>Expiry</span><strong>{businessDetails.subscription?.expiryDate ? new Date(businessDetails.subscription.expiryDate).toLocaleDateString() : 'No expiry'}</strong>
            </div>
            <h3>Subscription payments</h3>
            <PaymentsTable payments={businessDetails.payments || []} onReview={reviewPayment} />
          </section>
        </div>
      )}
        </main>
      </div>
    </div>
  );
}

function PaymentsTable({ payments, onReview }) {
  return (
    <div className="table-card">
      <table>
        <thead><tr><th>Business / owner</th><th>Plan</th><th>Amount</th><th>Method / reference</th><th>Payment date</th><th>Proof / notes</th><th>Status</th><th>Review</th></tr></thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment._id}>
              <td>{payment.businessId?.name || 'Business'}<small>{payment.businessId?.owner?.fullName || payment.businessId?.email || '—'}</small><small>{payment.businessId?.owner?.email}</small></td>
              <td>{payment.planId?.name || payment.planName}</td>
              <td>{formatAmount(payment.amount)}</td>
              <td>{payment.method?.replace(/_/g, ' ')}<small>{payment.reference}</small><small>{payment.billingCycle}</small></td>
              <td>{new Date(payment.paymentDate || payment.createdAt).toLocaleString()}<small>Submitted {new Date(payment.createdAt).toLocaleString()}</small></td>
              <td>{payment.proofDataUrl && <a href={payment.proofDataUrl} target="_blank" rel="noreferrer">View proof</a>}{payment.notes && <small>{payment.notes}</small>}</td>
              <td><span className={`status-badge ${payment.status}`}>{payment.status}</span></td>
              <td>{payment.status === 'pending' ? <div className="action-cell"><button className="btn btn-sm btn-success" onClick={() => onReview(payment, 'approved')}>Approve</button><button className="btn btn-sm btn-outline-danger" onClick={() => onReview(payment, 'rejected')}>Reject</button></div> : <>{payment.rejectionReason && <small>Owner note: {payment.rejectionReason}</small>}{payment.internalNote && <small>Admin note: {payment.internalNote}</small>}{!payment.rejectionReason && !payment.internalNote && '—'}</>}</td>
            </tr>
          ))}
          {!payments.length && <tr><td colSpan="8">No payment requests.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
