import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import DashboardLayout from './layouts/DashboardLayout';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import CustomersPage from './pages/CustomersPage';
import ProductsPage from './pages/ProductsPage';
import InvoicesPage from './pages/InvoicesPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import SubscriptionsPage from './pages/SubscriptionsPage';
import ProfilePage from './pages/ProfilePage';
import PaymentsPage from './pages/PaymentsPage';
import SuperAdminPage from './pages/SuperAdminPage';
import PublicHomePage from './pages/PublicHomePage';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="page-box">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'super_admin') return <Navigate to="/super-admin" replace />;
  return children;
}

function GuestRoute({ children, redirectTo = '/dashboard' }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="page-box">Loading...</div>;
  if (user) {
    return <Navigate to={user.role === 'super_admin' ? '/super-admin' : redirectTo} replace />;
  }
  return children;
}

function SuperAdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-box">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'super_admin') return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  useEffect(() => {
    document.documentElement.dataset.theme = localStorage.getItem('billflow-theme') || 'light';
  }, []);

  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<PublicHomePage />} />
        <Route path="/login" element={<GuestRoute><AuthPage /></GuestRoute>} />
        <Route path="/super-admin/login" element={<Navigate to="/login" replace />} />
        <Route path="/super-admin" element={<SuperAdminRoute><SuperAdminPage /></SuperAdminRoute>} />

        <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/payments" element={<PaymentsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/subscriptions" element={<SubscriptionsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
