import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  BriefcaseBusiness,
  ChevronLeft,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ReceiptText,
  Settings,
  ShoppingCart,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';

const navItems = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Customers', to: '/customers', icon: Users },
  { label: 'Products', to: '/products', icon: Package },
  { label: 'Invoices', to: '/invoices', icon: ReceiptText },
  { label: 'Payments', to: '/payments', icon: CreditCard },
  { label: 'Reports', to: '/reports', icon: BarChart3 },
  { label: 'Subscriptions', to: '/subscriptions', icon: ShoppingCart },
];

const businessNavItems = [
  { label: 'Business settings', to: '/settings', icon: Settings },
  { label: 'Profile', to: '/profile', icon: UserRound },
];

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/customers': 'Customers',
  '/products': 'Products & services',
  '/invoices': 'Invoices',
  '/payments': 'Payments',
  '/reports': 'Reports',
  '/subscriptions': 'Subscriptions',
  '/settings': 'Business settings',
  '/profile': 'Profile',
};

function NavigationLinks({ items, collapsed, onNavigate }) {
  return items.map(({ label, to, icon: Icon }) => (
    <NavLink
      key={to}
      to={to}
      end={to === '/dashboard'}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      onClick={onNavigate}
      className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
    >
      <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
      <span>{label}</span>
    </NavLink>
  ));
}

export default function DashboardLayout() {
  const { user, business, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('billflow-sidebar') === 'collapsed');
  const [mobileOpen, setMobileOpen] = useState(false);

  const pageTitle = useMemo(() => pageTitles[location.pathname] || 'Workspace', [location.pathname]);

  useEffect(() => {
    localStorage.setItem('billflow-sidebar', collapsed ? 'collapsed' : 'expanded');
  }, [collapsed]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const initials = (user?.fullName || user?.email || 'B')
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

  return (
    <div className={`app-shell${collapsed ? ' sidebar-collapsed' : ''}${mobileOpen ? ' mobile-nav-open' : ''}`}>
      {mobileOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close navigation menu"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside className="sidebar" id="workspace-navigation">
        <div className="brand-wrap">
          <Link to="/dashboard" className="brand-link" aria-label="BillFlow dashboard" onClick={() => setMobileOpen(false)}>
            <span className="brand-mark"><BriefcaseBusiness size={19} strokeWidth={2} /></span>
            <span className="brand-copy"><strong>BillFlow</strong><small>Business workspace</small></span>
          </Link>
          <button
            type="button"
            className="sidebar-close mobile-only"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X size={19} />
          </button>
        </div>

        <div className="business-switcher">
          <span className="business-avatar" title={`${business?.name || 'Your business'} · ${business?.type || 'Business account'}`}><BriefcaseBusiness size={17} /></span>
          <span className="business-copy">
            <strong title={business?.name || 'Your business'}>{business?.name || 'Your business'}</strong>
            <small title={business?.type || 'Business account'}>{business?.type || 'Business account'}</small>
          </span>
        </div>

        <nav className="nav-menu" aria-label="Main navigation">
          <p className="nav-section-label">Workspace</p>
          <NavigationLinks items={navItems} collapsed={collapsed} onNavigate={() => setMobileOpen(false)} />
          <p className="nav-section-label nav-section-spaced">Manage</p>
          <NavigationLinks items={businessNavItems} collapsed={collapsed} onNavigate={() => setMobileOpen(false)} />
        </nav>

        <div className="sidebar-footer">
          <ThemeToggle compact />
          <div className="sidebar-account">
            <span className="account-avatar" aria-hidden="true">{initials}</span>
            <span className="account-copy"><strong>{user?.fullName || 'Account'}</strong><small>{user?.email}</small></span>
            <button type="button" className="account-logout" onClick={handleLogout} aria-label="Log out" title="Log out">
              <LogOut size={17} />
            </button>
          </div>
        </div>
        <button
          type="button"
          className="sidebar-collapse"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft size={17} />
        </button>
      </aside>

      <div className="workspace-main">
        <header className="workspace-header">
          <div className="workspace-header-leading">
            <button
              type="button"
              className="mobile-menu-toggle"
              aria-label="Open navigation menu"
              aria-expanded={mobileOpen}
              aria-controls="workspace-navigation"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div className="workspace-breadcrumb">
              <span>Workspace</span><span className="breadcrumb-divider">/</span><strong>{pageTitle}</strong>
            </div>
          </div>
          <div className="workspace-header-actions">
            {location.pathname !== '/invoices' && (
              <button type="button" className="btn btn-primary header-quick-action" aria-label="Create a new invoice" onClick={() => navigate('/invoices?create=1')}>
                <FileText size={16} /><span>New invoice</span>
              </button>
            )}
            <details className="header-account-menu">
              <summary aria-label={`Open account menu for ${user?.fullName || 'account'}`}>
                <span className="account-avatar" aria-hidden="true">{initials}</span>
              </summary>
              <div className="header-account-popover">
                <div className="header-account-identity"><strong>{user?.fullName || 'Account'}</strong><small>{user?.email}</small></div>
                <Link to="/profile" onClick={(event) => { event.currentTarget.closest('details').open = false; }}><UserRound size={16} /> Profile</Link>
                <button type="button" onClick={handleLogout}><LogOut size={16} /> Sign out</button>
              </div>
            </details>
          </div>
        </header>
        <main className="main-panel">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
