import { useCallback, useEffect, useState } from 'react';
import { Mail, Phone, UserRound, UsersRound } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import api from '../services/api';

const blankCustomer = { name: '', email: '', phone: '', address: '', notes: '' };

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState(blankCustomer);
  const [editingId, setEditingId] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/customers', { params: { search, page, limit: 20 } });
      setCustomers(data.customers || []);
      setPages(data.pages || 1);
      setTotal(data.total ?? data.customers?.length ?? 0);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not load customers');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const startCreate = () => {
    setEditingId(null);
    setForm(blankCustomer);
    setOpen(true);
    setError('');
  };

  const startEdit = (customer) => {
    setEditingId(customer._id);
    setForm({ ...blankCustomer, ...customer });
    setOpen(true);
    setError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      if (editingId) await api.put(`/customers/${editingId}`, form);
      else await api.post('/customers', form);
      setOpen(false);
      setNotice(editingId ? 'Customer updated.' : 'Customer added.');
      await loadCustomers();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not save customer');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (customer) => {
    if (!window.confirm(`Delete ${customer.name}?`)) return;
    setError('');
    try {
      await api.delete(`/customers/${customer._id}`);
      setNotice('Customer deleted.');
      await loadCustomers();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not delete customer');
    }
  };

  return (
    <div className="page-box">
      <div className="page-header">
        <div><p className="eyebrow">Management</p><h2>Customers</h2><p className="page-subtitle">{total} {total === 1 ? 'customer' : 'customers'}{search ? ' match your search' : ' in your business'}</p></div>
        <button className="btn btn-primary" onClick={startCreate}>Add customer</button>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}
      <div className="customer-toolbar"><input aria-label="Search customers" placeholder="Search name, email or phone" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></div>

      {open && (
        <div className="card entity-form-card">
          <div className="entity-form-heading"><h3>{editingId ? 'Edit customer' : 'Add customer'}</h3><button className="btn btn-sm btn-outline-secondary" onClick={() => setOpen(false)}>Close</button></div>
          <form className="entity-form-grid" onSubmit={submit}>
            <label>Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
            <label>Email<input type="email" value={form.email || ''} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
            <label>Phone<input value={form.phone || ''} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
            <label>Address<input value={form.address || ''} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
            <label className="wide-field">Notes<textarea value={form.notes || ''} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows="2" /></label>
            <div className="wide-field entity-form-actions"><button className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save customer'}</button></div>
          </form>
        </div>
      )}

      {loading ? <div className="card loading-card" aria-busy="true">Loading customers...</div> : customers.length ? (
        <>
          <div className="table-card customer-table-view">
            <table>
              <thead><tr><th>Customer</th><th>Email</th><th>Phone</th><th>Address</th><th>Actions</th></tr></thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer._id}>
                    <td><span className="table-primary-cell"><span className="table-avatar"><UserRound size={16} /></span><strong>{customer.name}</strong></span></td>
                    <td>{customer.email || '—'}</td><td>{customer.phone || '—'}</td><td>{customer.address || '—'}</td>
                    <td className="action-cell"><button className="btn btn-sm btn-outline-primary" onClick={() => startEdit(customer)}>Edit</button><button className="btn btn-sm btn-outline-danger" onClick={() => remove(customer)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="customer-mobile-list">
            {customers.map((customer) => (
              <article className="card customer-mobile-card" key={customer._id}>
                <div className="customer-mobile-heading"><span className="table-avatar"><UserRound size={17} /></span><strong>{customer.name}</strong></div>
                {customer.email && <p><Mail size={14} />{customer.email}</p>}
                {customer.phone && <p><Phone size={14} />{customer.phone}</p>}
                {customer.address && <p className="customer-mobile-address">{customer.address}</p>}
                <div className="action-cell"><button className="btn btn-sm btn-outline-primary" onClick={() => startEdit(customer)}>Edit</button><button className="btn btn-sm btn-outline-danger" onClick={() => remove(customer)}>Delete</button></div>
              </article>
            ))}
          </div>
          <Pagination page={page} pages={pages} total={total} onChange={setPage} />
        </>
      ) : (
        <div className="card">
          <EmptyState icon={UsersRound} title={search ? 'No matching customers' : 'No customers yet'} description={search ? 'Try another name, email, or phone number.' : 'Add your customers to make invoice creation faster and keep their details in one place.'} action={!search && <button className="btn btn-primary" onClick={startCreate}>Add your first customer</button>} />
        </div>
      )}
    </div>
  );
}
