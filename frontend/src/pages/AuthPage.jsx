import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PasswordInput from '../components/PasswordInput';
import ThemeToggle from '../components/ThemeToggle';

const businessTypes = [
  'Mobile Shop',
  'Clothing Shop',
  'Electric Shop',
  'Grocery Store',
  'General Retail Shop',
  'Freelancer / Service Business',
  'Other',
];

const initialForm = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  businessName: '',
  businessType: '',
};

export default function AuthPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isLogin = searchParams.get('mode') !== 'register';
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register, connectionError } = useAuth();
  const navigate = useNavigate();

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      let result;
      if (isLogin) {
        result = await login({ email: form.email, password: form.password });
      } else {
        if (form.password !== form.confirmPassword) {
          setError('Passwords do not match');
          return;
        }
        result = await register({
          fullName: form.fullName,
          email: form.email,
          password: form.password,
          businessName: form.businessName,
          businessType: form.businessType,
        });
      }

      if (result.user?.role === 'super_admin') {
        navigate('/super-admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reach the BillFlow API. Check that the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <ThemeToggle />
      <div className="auth-card">
        <div className="auth-header">
          <h1>BillFlow</h1>
          <p>{isLogin ? 'Welcome back' : 'Create your business workspace'}</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <>
              <label>
                Full name
                <input type="text" name="fullName" value={form.fullName} onChange={handleChange} required />
              </label>
              <label>
                Business name
                <input type="text" name="businessName" value={form.businessName} onChange={handleChange} required />
              </label>
              <label>
                Business type
                <select name="businessType" value={form.businessType} onChange={handleChange} required>
                  <option value="">Select business type</option>
                  {businessTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
            </>
          )}

          <label>
            Email
            <input type="email" name="email" value={form.email} onChange={handleChange} required />
          </label>

          <label>
            Password
            <PasswordInput name="password" autoComplete={isLogin ? 'current-password' : 'new-password'} value={form.password} onChange={handleChange} required minLength={8} />
          </label>

          {!isLogin && (
            <label>
              Confirm password
              <PasswordInput name="confirmPassword" autoComplete="new-password" value={form.confirmPassword} onChange={handleChange} required minLength={8} />
            </label>
          )}

          {connectionError && <div className="alert alert-warning">{connectionError}</div>}
          {error && <div className="alert alert-danger">{error}</div>}

          <button className="btn btn-primary w-100" type="submit" disabled={loading}>
            {loading ? 'Please wait...' : isLogin ? 'Login' : 'Create account'}
          </button>
        </form>

        <button
          className="link-toggle"
          type="button"
          onClick={() => setSearchParams(isLogin ? { mode: 'register' } : {})}
        >
          {isLogin ? 'Need an account? Register' : 'Already have an account? Login'}
        </button>
        <Link className="back-home-link" to="/">Return to website</Link>
      </div>
    </div>
  );
}
