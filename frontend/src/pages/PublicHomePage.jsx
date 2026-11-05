import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  CreditCard,
  FileText,
  Menu,
  Package,
  ShieldCheck,
  ShoppingBag,
  Users,
  X,
} from 'lucide-react';
import api from '../services/api';

const navigationLinks = [
  { label: 'Product', href: '#product' },
  { label: 'Solutions', href: '#solutions' },
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Resources', href: '#workflow' },
  { label: 'About', href: '#about' },
  { label: 'Contact', href: '#contact' },
];

const capabilities = [
  {
    icon: Users,
    title: 'Customer records',
    description: 'Keep customer details and billing history together, ready when your team needs them.',
  },
  {
    icon: Package,
    title: 'Products and services',
    description: 'Manage your catalog, pricing, and supported inventory details from one workspace.',
  },
  {
    icon: FileText,
    title: 'Invoices and receipts',
    description: 'Create invoices, track balances, and prepare clear PDF invoices and print-ready receipts.',
  },
  {
    icon: BarChart3,
    title: 'Business reporting',
    description: 'Review revenue, outstanding amounts, and sales activity using your business data.',
  },
];

const industries = [
  ['Retail shops', 'Connect customer records, a product catalog, invoicing, and payment tracking.'],
  ['Mobile and electronics', 'Keep product and service details organized alongside customer invoices.'],
  ['Clothing and grocery', 'Track supported product, variant, and stock details with everyday billing.'],
  ['Freelancers and services', 'Manage client records, service pricing, invoices, and payment balances.'],
];

const faqs = [
  {
    question: 'What can I manage in BillFlow?',
    answer: 'BillFlow includes customer and product management, invoices, payments, subscriptions, and business reports in one workspace.',
  },
  {
    question: 'Can I create invoices and receipts?',
    answer: 'Yes. The application supports invoice creation and PDF downloads. It also provides a 58mm receipt layout for browser printing.',
  },
  {
    question: 'How does pricing work?',
    answer: 'Available plans and prices are loaded from BillFlow subscription settings. Paid plan requests use the existing manual payment review workflow.',
  },
  {
    question: 'Can employees use the business workspace?',
    answer: 'Yes. Existing staff accounts can sign in to their business workspace. Access to individual actions follows the permissions enforced by BillFlow.',
  },
  {
    question: 'Is my business data separate?',
    answer: 'Business data access is scoped to the authenticated workspace by the existing server-side authorization rules.',
  },
];

const formatPrice = (value) => `PKR ${Number(value || 0).toLocaleString()}`;

function getPlanHighlights(plan) {
  const highlights = [];
  const limits = plan.limits || {};
  const features = plan.features || {};

  if (Number.isFinite(Number(limits.invoices))) highlights.push(`${Number(limits.invoices).toLocaleString()} invoices`);
  if (Number.isFinite(Number(limits.customers))) highlights.push(`${Number(limits.customers).toLocaleString()} customers`);
  if (Number.isFinite(Number(limits.products))) highlights.push(`${Number(limits.products).toLocaleString()} products`);
  if (features.pdfDownloads) highlights.push('PDF invoice downloads');
  if (features.basicReports) highlights.push('Business reports');
  if (features.advancedReports) highlights.push('Advanced reports');
  if (features.inventory) highlights.push('Inventory tracking');
  if (features.staffAccounts) highlights.push(`${Number(limits.staff || 0).toLocaleString()} staff accounts`);

  return highlights;
}

function DashboardPreview() {
  return (
    <div className="public-dashboard-preview" aria-label="Illustrative BillFlow dashboard preview">
      <div className="preview-window-bar">
        <div className="preview-window-dots"><i /><i /><i /></div>
        <span>BillFlow / Overview</span>
        <span className="preview-window-tag">Illustrative data</span>
      </div>
      <div className="preview-content">
        <div className="preview-heading">
          <div><small>BUSINESS OVERVIEW</small><strong>Good morning</strong></div>
          <span className="preview-date">Last 6 months</span>
        </div>
        <div className="preview-kpis">
          <div><span>Revenue</span><strong>PKR 540K</strong><small className="preview-positive"><ArrowDownRight size={13} /> Example</small></div>
          <div><span>Invoices</span><strong>184</strong><small>Example</small></div>
          <div><span>Customers</span><strong>92</strong><small>Example</small></div>
        </div>
        <div className="preview-chart-panel">
          <div className="preview-chart-title"><strong>Revenue overview</strong><span>Example values</span></div>
          <div className="preview-chart">
            {[36, 52, 43, 74, 58, 88, 66, 94, 72, 83, 61, 100].map((height, index) => (
              <i key={index} style={{ height: `${height}%` }} />
            ))}
          </div>
          <div className="preview-chart-labels"><span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span></div>
        </div>
        <div className="preview-activity">
          <div className="preview-activity-heading"><strong>Recent invoices</strong><span>Example activity</span></div>
          <div className="preview-activity-row"><span className="preview-invoice-icon"><FileText size={14} /></span><span><b>Invoice #1042</b><small>Example customer</small></span><strong>Paid</strong></div>
          <div className="preview-activity-row"><span className="preview-invoice-icon"><FileText size={14} /></span><span><b>Invoice #1041</b><small>Example customer</small></span><strong className="pending">Pending</strong></div>
        </div>
      </div>
    </div>
  );
}

export default function PublicHomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState('');

  useEffect(() => {
    let active = true;
    api.get('/subscriptions/plans')
      .then(({ data }) => {
        if (active) {
          setPlans(data.plans || []);
          setPlansError('');
        }
      })
      .catch(() => {
        if (active) setPlansError('Plan pricing is temporarily unavailable. Please try again later.');
      })
      .finally(() => {
        if (active) setPlansLoading(false);
      });

    return () => { active = false; };
  }, []);

  return (
    <div className="public-shell">
      <header className="public-header">
        <div className="container public-navbar">
          <Link to="/" className="public-brand" aria-label="BillFlow home">
            <span className="public-brand-mark"><BriefcaseBusiness size={18} /></span>
            <span className="public-brand-copy"><strong>BillFlow</strong><small>Business operations</small></span>
          </Link>

          <nav className="public-nav" aria-label="Public website navigation">
            {navigationLinks.map(({ label, href }) => <a key={href} href={href}>{label}</a>)}
          </nav>

          <div className="public-actions">
            <Link to="/login" className="public-link-btn">Log in</Link>
            <Link to="/login?mode=register" className="public-primary-btn">Get started <ArrowRight size={16} /></Link>
          </div>

          <button
            type="button"
            className="public-mobile-toggle"
            aria-label={mobileMenuOpen ? 'Close website navigation' : 'Open website navigation'}
            aria-expanded={mobileMenuOpen}
            aria-controls="public-mobile-menu"
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          {mobileMenuOpen && (
            <div className="public-mobile-menu" id="public-mobile-menu">
              <nav className="public-mobile-nav" aria-label="Mobile website navigation">
                {navigationLinks.map(({ label, href }) => (
                  <a key={href} href={href} onClick={() => setMobileMenuOpen(false)}>{label}</a>
                ))}
              </nav>
              <div className="public-mobile-actions">
                <Link to="/login" className="public-link-btn" onClick={() => setMobileMenuOpen(false)}>Log in</Link>
                <Link to="/login?mode=register" className="public-primary-btn" onClick={() => setMobileMenuOpen(false)}>Get started <ArrowRight size={16} /></Link>
              </div>
            </div>
          )}
        </div>
      </header>

      <main>
        <section className="public-hero" id="home">
          <div className="public-hero-glow" aria-hidden="true" />
          <div className="container public-hero-inner">
            <div className="public-hero-copy">
              <span className="public-kicker"><span className="public-kicker-dot" />Business operations, connected</span>
              <h1>Every part of your business.<br /><span>One clear view.</span></h1>
              <div className="public-hero-rule" />
              <p>Manage invoices, customers, products, payments and business reports in one connected workspace built for growing businesses.</p>
              <div className="public-hero-actions">
                <Link to="/login?mode=register" className="public-primary-btn large">Get started <ArrowRight size={17} /></Link>
                <a href="#product" className="public-secondary-btn">Explore BillFlow <ChevronRight size={17} /></a>
              </div>
              <div className="public-hero-assurance"><ShieldCheck size={16} /> Protected business workspaces with role-based access</div>
            </div>
            <DashboardPreview />
          </div>
          <div className="public-hero-bottom"><span>Customers</span><i /><span>Products</span><i /><span>Invoices</span><i /><span>Payments</span><i /><span>Reports</span></div>
        </section>

        <section className="public-section public-intro" id="about">
          <div className="container public-intro-grid">
            <div>
              <span className="public-kicker">A clearer way to work</span>
              <h2>Less time switching tools.<br />More time moving business forward.</h2>
            </div>
            <p>BillFlow brings the day-to-day essentials of business management into one practical workspace. Follow a connected workflow from customer and product records through invoicing, payments, and reporting.</p>
          </div>
        </section>

        <section className="public-section public-capabilities" id="features">
          <div className="container">
            <div className="section-heading">
              <span className="public-kicker">One connected workspace</span>
              <h2>The tools your operations rely on.</h2>
              <p>Purposeful features to keep your essential business information organized and accessible.</p>
            </div>
            <div className="features-grid">
              {capabilities.map(({ icon: Icon, title, description }, index) => (
                <article key={title} className="feature-card">
                  <div className="feature-card-top"><span className="feature-index">0{index + 1}</span><span className="feature-icon"><Icon size={20} /></span></div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                  <a href="#workflow" className="feature-detail-link">Explore workflow <ArrowRight size={14} /></a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section public-solutions" id="solutions">
          <div className="container solutions-layout">
            <div className="solutions-intro">
              <span className="public-kicker">Solutions</span>
              <h2>Built around the way businesses work.</h2>
              <p>From product-led shops to independent service providers, BillFlow supports a straightforward path from customer details to a settled invoice.</p>
              <Link to="/login?mode=register" className="public-text-link">Create a workspace <ArrowRight size={15} /></Link>
            </div>
            <div className="solutions-grid">
              {industries.map(([title, description], index) => (
                <article key={title} className="solution-card">
                  <span className="solution-number">0{index + 1}</span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section public-product" id="product">
          <div className="container public-product-grid">
            <div className="public-product-copy">
              <span className="public-kicker">Product overview</span>
              <h2>See the whole picture. Stay on top of the details.</h2>
              <p>Use a single workspace to review business performance and move between the records behind it.</p>
              <ul className="product-checklist">
                <li><Check size={16} /> Track invoice statuses and outstanding balances</li>
                <li><Check size={16} /> Review revenue trends and recent activity</li>
                <li><Check size={16} /> Keep customers, products, and payments connected</li>
              </ul>
              <Link to="/login?mode=register" className="public-primary-btn">Get started <ArrowRight size={16} /></Link>
            </div>
            <div className="product-module-list">
              <div><span className="module-icon"><ShoppingBag size={18} /></span><span><strong>Sales and products</strong><small>Manage products and service records</small></span><ChevronRight size={16} /></div>
              <div><span className="module-icon"><FileText size={18} /></span><span><strong>Invoicing</strong><small>Create invoices and review balances</small></span><ChevronRight size={16} /></div>
              <div><span className="module-icon"><CreditCard size={18} /></span><span><strong>Payments</strong><small>Record and review payment activity</small></span><ChevronRight size={16} /></div>
              <div><span className="module-icon"><BarChart3 size={18} /></span><span><strong>Reports</strong><small>Understand revenue and outstanding amounts</small></span><ChevronRight size={16} /></div>
            </div>
          </div>
        </section>

        <section className="public-section public-workflow" id="workflow">
          <div className="container workflow-content">
            <div className="section-heading">
              <span className="public-kicker">A practical workflow</span>
              <h2>From first customer to clear financial records.</h2>
            </div>
            <div className="workflow-steps">
              <article><span>01</span><Users size={20} /><h3>Organize</h3><p>Keep customer and product details ready for your next transaction.</p></article>
              <article><span>02</span><FileText size={20} /><h3>Invoice</h3><p>Create an invoice with the items, totals, and payment details you need.</p></article>
              <article><span>03</span><CreditCard size={20} /><h3>Reconcile</h3><p>Record payments and keep track of what remains outstanding.</p></article>
              <article><span>04</span><BarChart3 size={20} /><h3>Understand</h3><p>Review the resulting activity and performance in your reports.</p></article>
            </div>
          </div>
        </section>

        <section className="public-section public-pricing" id="pricing">
          <div className="container">
            <div className="section-heading pricing-heading">
              <span className="public-kicker">Subscription plans</span>
              <h2>Choose a plan that fits your business.</h2>
              <p>Current options are managed in BillFlow and shown here directly.</p>
            </div>
            {plansLoading ? (
              <div className="pricing-message" role="status">Loading available plans...</div>
            ) : plansError ? (
              <div className="pricing-message" role="alert">{plansError}</div>
            ) : plans.length === 0 ? (
              <div className="pricing-message">No plans are currently available. Contact your BillFlow administrator for plan information.</div>
            ) : (
              <div className="pricing-grid">
                {plans.map((plan) => (
                  <article key={plan._id || plan.key} className={`pricing-card${plan.key === 'FREE' ? ' featured' : ''}`}>
                    {plan.key === 'FREE' && <span className="pricing-badge">Start here</span>}
                    <span className="plan-key">{plan.key}</span>
                    <h3>{plan.name}</h3>
                    <div className="price-row"><strong>{Number(plan.monthlyPrice) === 0 ? 'Free' : formatPrice(plan.monthlyPrice)}</strong>{Number(plan.monthlyPrice) > 0 && <span>/ month</span>}</div>
                    {Number(plan.monthlyPrice) > 0 && <p className="annual-price">{formatPrice(plan.yearlyPrice)} billed yearly</p>}
                    <p className="plan-description">{plan.description || 'A BillFlow subscription plan.'}</p>
                    <ul>
                      {getPlanHighlights(plan).map((highlight) => <li key={highlight}><Check size={15} />{highlight}</li>)}
                    </ul>
                    <Link to="/login?mode=register" className={`public-plan-btn${plan.key === 'FREE' ? ' featured' : ''}`}>Get started <ArrowRight size={15} /></Link>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="public-section public-faq" id="contact">
          <div className="container faq-grid">
            <div className="faq-copy">
              <span className="public-kicker">Frequently asked questions</span>
              <h2>Helpful details before you get started.</h2>
              <p>Explore the essentials or create a workspace to see BillFlow in action.</p>
              <Link to="/login?mode=register" className="public-primary-btn">Create your workspace <ArrowRight size={16} /></Link>
            </div>
            <div className="faq-list">
              {faqs.map(({ question, answer }) => (
                <details key={question} className="faq-item">
                  <summary>{question}<ChevronRight size={16} /></summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="public-footer">
        <div className="container public-footer-inner">
          <Link to="/" className="public-brand" aria-label="BillFlow home">
            <span className="public-brand-mark"><BriefcaseBusiness size={18} /></span>
            <span className="public-brand-copy"><strong>BillFlow</strong><small>Business operations</small></span>
          </Link>
          <nav className="public-footer-links" aria-label="Footer navigation">
            {navigationLinks.map(({ label, href }) => <a key={href} href={href}>{label}</a>)}
          </nav>
          <Link to="/login" className="public-footer-login">Already have an account? Log in <ArrowRight size={14} /></Link>
        </div>
        <div className="container public-footer-bottom"><span>BillFlow business management</span><a href="#home">Back to top ↑</a></div>
      </footer>
    </div>
  );
}
