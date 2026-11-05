import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  CreditCard,
  FileText,
  Package,
  Plus,
  RefreshCw,
  ReceiptText,
  ShoppingBag,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import EmptyState from '../components/EmptyState';
import api from '../services/api';

const formatNumber = (value) => Number(value || 0).toLocaleString();
const formatCurrency = (value) => `PKR ${Number(value || 0).toLocaleString()}`;

function ChartTooltip({ active, payload, label, currency = false }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <span>{label}</span>
      <strong>{currency ? formatCurrency(payload[0].value) : formatNumber(payload[0].value)}</strong>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton" aria-label="Loading dashboard" aria-busy="true">
      <div className="skeleton-title" />
      <div className="stats-grid">{Array.from({ length: 7 }, (_, index) => <div className="stat-card skeleton-card" key={index} />)}</div>
      <div className="dashboard-chart-grid"><div className="card skeleton-chart" /><div className="card skeleton-chart" /></div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, business } = useAuth();
  const [today] = useState(() => new Date());
  const [summary, setSummary] = useState({});
  const [monthlyRevenue, setMonthlyRevenue] = useState([]);
  const [dailySales, setDailySales] = useState([]);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/reports/dashboard');
      setSummary(data.summary || {});
      setMonthlyRevenue(data.monthlyRevenue || []);
      setDailySales(data.dailySales || []);
      setRecentInvoices(data.recentInvoices || []);
      setTopProducts(data.topProducts || []);
      setLowStock(data.lowStock || []);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Dashboard data could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const greeting = useMemo(() => {
    const hour = today.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, [today]);

  const stats = [
    { label: 'Total revenue', value: formatCurrency(summary.totalRevenue), icon: Wallet, tone: 'blue' },
    { label: 'Total sales', value: formatCurrency(summary.totalSales), icon: ShoppingBag, tone: 'violet' },
    { label: 'Total invoices', value: formatNumber(summary.totalInvoices), icon: FileText, tone: 'cyan' },
    { label: 'Paid invoices', value: formatNumber(summary.paidInvoices), icon: CreditCard, tone: 'green' },
    { label: 'Pending invoices', value: formatNumber(summary.pendingPayments), icon: ArrowUpRight, tone: 'amber' },
    { label: 'Customers', value: formatNumber(summary.totalCustomers), icon: Users, tone: 'green' },
    { label: 'Products', value: formatNumber(summary.totalProducts), icon: Package, tone: 'amber' },
  ];

  if (loading) return <DashboardSkeleton />;
  if (error) {
    return (
      <div className="page-box dashboard-error-state">
        <div className="card">
          <EmptyState
            icon={RefreshCw}
            title="Dashboard data is unavailable"
            description={error}
            action={<button className="btn btn-primary" onClick={load}><RefreshCw size={15} /> Try again</button>}
          />
        </div>
      </div>
    );
  }

  const hasInvoices = Number(summary.totalInvoices || 0) > 0;
  const hasRevenue = Number(summary.totalRevenue || 0) > 0;
  const hasDailySales = dailySales.some((point) => Number(point.sales || 0) > 0);

  return (
    <div className="page-box dashboard-page">
      <section className="dashboard-welcome">
        <div>
          <p className="eyebrow">Business overview</p>
          <h1>{greeting}{user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}</h1>
          <p>Here is your business performance overview.</p>
        </div>
        <div className="dashboard-date">
          <span>{today.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
          <strong>{business?.name || 'Your business'}</strong>
        </div>
      </section>

      <section className="stats-grid dashboard-stats" aria-label="Business key metrics">
        {stats.map(({ label, value, icon: Icon, tone }) => (
          <article className="stat-card dashboard-stat-card" key={label}>
            <div className="stat-card-top">
              <span>{label}</span>
              <span className={`metric-icon metric-icon-${tone}`}><Icon size={18} strokeWidth={1.9} /></span>
            </div>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      {!hasInvoices && (
        <section className="dashboard-onboarding card">
          <div className="onboarding-copy">
            <span className="onboarding-icon"><ReceiptText size={22} /></span>
            <div>
              <p className="eyebrow">Your workspace is ready</p>
              <h2>Start with your first sale</h2>
              <p>Add a customer and product or service, then create an invoice to see your business activity here.</p>
            </div>
          </div>
          <div className="onboarding-actions">
            <Link className="btn btn-primary" to="/invoices?create=1"><Plus size={16} /> Create first invoice</Link>
            <Link className="btn btn-outline-primary" to="/customers">Add customer</Link>
            <Link className="btn btn-outline-secondary" to="/products">Add product</Link>
          </div>
        </section>
      )}

      <section className="dashboard-chart-grid">
        <article className="card chart-card dashboard-revenue-card">
          <div className="section-heading">
            <div><p className="eyebrow">Performance</p><h2>Revenue overview</h2></div>
            <span className="chart-period">Last 6 months</span>
          </div>
          {hasRevenue ? (
            <div className="dashboard-chart dashboard-chart-revenue">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyRevenue} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="billflowRevenueFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} tickFormatter={(value) => `${Number(value) >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`} width={48} />
                  <Tooltip content={<ChartTooltip currency />} cursor={{ stroke: 'var(--border)', strokeDasharray: '4 4' }} />
                  <Area type="monotone" dataKey="revenue" stroke="var(--primary)" strokeWidth={2.5} fill="url(#billflowRevenueFill)" activeDot={{ r: 5, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState icon={Wallet} title="Revenue will appear here" description="Once you record payments against invoices, your monthly revenue trend will be available." className="chart-empty-state" />
          )}
        </article>

        <article className="card chart-card dashboard-sales-card">
          <div className="section-heading">
            <div><p className="eyebrow">This week</p><h2>Daily sales</h2></div>
            <span className="metric-context">{hasDailySales ? formatCurrency(dailySales.reduce((sum, point) => sum + Number(point.sales || 0), 0)) : 'No sales yet'}</span>
          </div>
          {hasDailySales ? (
            <div className="dashboard-chart dashboard-chart-sales">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailySales} margin={{ top: 12, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} dy={8} />
                  <YAxis hide />
                  <Tooltip content={<ChartTooltip currency />} cursor={{ fill: 'var(--primary-soft)', opacity: 0.6 }} />
                  <Bar dataKey="sales" fill="var(--primary)" radius={[5, 5, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState icon={ShoppingBag} title="No sales this week" description="Your daily sales summary will update as invoices are created." className="chart-empty-state" />
          )}
        </article>
      </section>

      <section className="dashboard-lower-grid dashboard-data-grid">
        <article className="card dashboard-list-card">
          <div className="section-heading">
            <div><p className="eyebrow">Latest activity</p><h2>Recent invoices</h2></div>
            <Link className="text-action" to="/invoices">View all <ArrowRight size={15} /></Link>
          </div>
          {recentInvoices.length ? (
            <div className="dashboard-invoice-list">
              {recentInvoices.map((invoice) => (
                <div className="dashboard-invoice-row" key={invoice._id}>
                  <span className="invoice-list-icon"><ReceiptText size={17} /></span>
                  <span className="invoice-list-main">
                    <strong>{invoice.invoiceNumber}</strong>
                    <small>{invoice.customerId?.name || 'Unknown customer'} · {new Date(invoice.invoiceDate || invoice.createdAt).toLocaleDateString()}</small>
                  </span>
                  <span className="invoice-list-total">{formatCurrency(invoice.grandTotal)}</span>
                  <span className={`status-badge ${invoice.paymentStatus}`}>{invoice.paymentStatus}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={ReceiptText} title="No invoices yet" description="Your latest invoices will show up here." action={<Link className="btn btn-sm btn-outline-primary" to="/invoices?create=1">Create invoice</Link>} />
          )}
        </article>

        <article className="card dashboard-list-card">
          <div className="section-heading">
            <div><p className="eyebrow">Best performers</p><h2>Top-selling products</h2></div>
            <Link className="text-action" to="/products">Products <ArrowRight size={15} /></Link>
          </div>
          {topProducts.length ? (
            <div className="top-products-list">
              {topProducts.map((product, index) => (
                <div className="top-product-row" key={`${product.name}-${index}`}>
                  <span className="product-rank-number">{String(index + 1).padStart(2, '0')}</span>
                  <span className="top-product-copy"><strong>{product.name}</strong><small>{formatNumber(product.quantity)} sold</small></span>
                  <strong className="top-product-revenue">{formatCurrency(product.revenue)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Package} title="No product sales yet" description="Products sold on invoices will appear in this list." />
          )}
        </article>
      </section>

      {lowStock.length > 0 && (
        <section className="card low-stock-panel">
          <div className="section-heading">
            <div><p className="eyebrow">Inventory</p><h2>Low stock items</h2></div>
            <Link className="text-action" to="/products">Review inventory <ArrowRight size={15} /></Link>
          </div>
          <div className="low-stock-list">
            {lowStock.slice(0, 5).map((product) => (
              <div className="low-stock-row" key={product._id}>
                <span><Package size={16} />{product.name}</span>
                <strong>{formatNumber(product.stockQuantity)} {product.unit || 'units'} left</strong>
              </div>
            ))}
          </div>
        </section>
      )}

      {hasInvoices && Number(summary.pendingPayments || 0) > 0 && (
        <Link className="dashboard-payment-notice" to="/payments">
          <span className="metric-icon metric-icon-amber"><CreditCard size={18} /></span>
          <span><strong>{formatNumber(summary.pendingPayments)} invoices</strong> have an outstanding balance.</span>
          <span className="text-action">View payments <ArrowUpRight size={15} /></span>
        </Link>
      )}
    </div>
  );
}
