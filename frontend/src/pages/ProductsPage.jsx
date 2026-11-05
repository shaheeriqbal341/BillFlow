import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Package, Wrench } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import api from '../services/api';
import NumberInput from '../components/NumberInput';

const blankProduct = {
  name: '', sku: '', barcode: '', category: 'General', brand: '', description: '', imageUrl: '',
  purchasePrice: 0, sellingPrice: 0, stockQuantity: 0, unit: 'pcs', lowStockThreshold: 5,
  variants: [], industryDetails: {},
};

const textFields = {
  'Mobile Shop': [
    ['model', 'Model'], ['serialNumber', 'IMEI / Serial number'], ['warranty', 'Warranty'],
    ['condition', 'Device condition'], ['accessories', 'Accessories'],
  ],
  'Electric Shop': [
    ['voltage', 'Voltage'], ['wattage', 'Wattage'], ['unitType', 'Unit type'],
    ['warranty', 'Warranty'], ['model', 'Model'],
  ],
  'Grocery Store': [
    ['batchNumber', 'Batch number'], ['purchaseUnit', 'Purchase unit'], ['saleUnit', 'Sale unit'],
  ],
};

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [businessType, setBusinessType] = useState('General Retail Shop');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState(blankProduct);
  const [editingId, setEditingId] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const [productsResponse, businessResponse] = await Promise.all([
        api.get('/products', { params: { search, category: categoryFilter || undefined, page, limit: 20 } }),
        api.get('/business/me'),
      ]);
      setProducts(productsResponse.data.products || []);
      setPages(productsResponse.data.pages || 1);
      setTotal(productsResponse.data.total ?? productsResponse.data.products?.length ?? 0);
      setCategoryOptions((current) => [...new Set([...current, ...(productsResponse.data.products || []).map((product) => product.category).filter(Boolean)])].sort());
      setBusinessType(businessResponse.data.business?.type || 'General Retail Shop');
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not load products');
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, page, search]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const startCreate = () => {
    setEditingId(null);
    setForm({ ...blankProduct, industryDetails: {}, variants: [] });
    setOpen(true);
    setError('');
  };

  const startEdit = (product) => {
    setEditingId(product._id);
    setForm({ ...blankProduct, ...product, industryDetails: product.industryDetails || {}, variants: product.variants || [] });
    setOpen(true);
    setError('');
  };

  const setDetails = (key, value) => {
    setForm((current) => ({ ...current, industryDetails: { ...current.industryDetails, [key]: value } }));
  };

  const setVariant = (index, key, value) => {
    setForm((current) => ({
      ...current,
      variants: current.variants.map((variant, variantIndex) => variantIndex === index
        ? { ...variant, [key]: value }
        : variant),
    }));
  };

  const chooseImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 1_800_000) {
      setError('Choose a PNG, JPEG, or WebP product image smaller than 1.8 MB.');
      setForm((current) => ({ ...current, imageUrl: '' }));
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) => ({ ...current, imageUrl: String(reader.result || '') }));
      setError('');
    };
    reader.onerror = () => setError('Could not read the selected product image.');
    reader.readAsDataURL(file);
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = {
        ...form,
        purchasePrice: Number(form.purchasePrice),
        sellingPrice: Number(form.sellingPrice),
        stockQuantity: Number(form.stockQuantity),
        lowStockThreshold: Number(form.lowStockThreshold),
        serviceDuration: Number(form.industryDetails?.duration || 0),
        pricingType: form.industryDetails?.pricingType || 'fixed',
        industryDetails: {
          ...form.industryDetails,
          repairCharges: Number(form.industryDetails?.repairCharges || 0),
          duration: Number(form.industryDetails?.duration || 0),
        },
        variants: form.variants.map((variant) => ({
          ...variant,
          stockQuantity: Number(variant.stockQuantity || 0),
          sellingPrice: variant.sellingPrice === '' || variant.sellingPrice === undefined ? undefined : Number(variant.sellingPrice),
        })),
      };
      if (editingId) await api.put(`/products/${editingId}`, payload);
      else await api.post('/products', payload);
      setOpen(false);
      setNotice(editingId ? 'Product updated.' : 'Product added.');
      await loadProducts();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not save product');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (product) => {
    if (!window.confirm(`Delete ${product.name}?`)) return;
    setError('');
    try {
      await api.delete(`/products/${product._id}`);
      setNotice('Product deleted.');
      await loadProducts();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not delete product');
    }
  };

  const isService = businessType === 'Freelancer / Service Business';
  const isClothing = businessType === 'Clothing Shop';
  const dynamicTextFields = textFields[businessType] || [];
  const lowStockProducts = products.filter((product) => !product.isService && Number(product.stockQuantity) <= Number(product.lowStockThreshold));

  return (
    <div className="page-box">
      <div className="page-header">
        <div><p className="eyebrow">{businessType}</p><h2>{isService ? 'Services' : 'Products & inventory'}</h2><p className="page-subtitle">{total} {isService ? 'services' : 'catalog items'}{search || categoryFilter ? ' match your filters' : ' in your catalog'}</p></div>
        <button className="btn btn-primary" onClick={startCreate}>{isService ? 'Add service' : 'Add product'}</button>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}
      {!isService && lowStockProducts.length > 0 && <div className="inventory-notice"><AlertTriangle size={17} /><span><strong>{lowStockProducts.length} low-stock {lowStockProducts.length === 1 ? 'item' : 'items'} on this page</strong> need attention based on their configured stock thresholds.</span></div>}
      <div className="customer-toolbar product-toolbar">
        <input aria-label="Search products" placeholder="Search name, SKU, or barcode" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        <select aria-label="Filter products by category" value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(1); }}>
          <option value="">All categories</option>
          {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
      </div>

      {open && (
        <div className="card entity-form-card">
          <div className="entity-form-heading"><h3>{editingId ? 'Edit' : 'Add'} {isService ? 'service' : 'product'}</h3><button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => setOpen(false)}>Close</button></div>
          <form className="entity-form-grid" onSubmit={submit}>
            <label>Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
            <label>SKU<input value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} required /></label>
            {!isService && <label>Barcode<input value={form.barcode || ''} onChange={(event) => setForm({ ...form, barcode: event.target.value })} /></label>}
            <label>Category<input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label>
            <label>Brand<input value={form.brand || ''} onChange={(event) => setForm({ ...form, brand: event.target.value })} /></label>
            <label>Unit<input value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} /></label>
            <label>Purchase price<NumberInput min="0" step="0.01" value={form.purchasePrice} onChange={(event) => setForm({ ...form, purchasePrice: event.target.value })} required /></label>
            <label>Sale price<NumberInput min="0" step="0.01" value={form.sellingPrice} onChange={(event) => setForm({ ...form, sellingPrice: event.target.value })} required /></label>
            {isService ? (
              <>
                <label>Pricing type<select value={form.industryDetails?.pricingType || 'fixed'} onChange={(event) => setDetails('pricingType', event.target.value)}><option value="fixed">Fixed</option><option value="hourly">Hourly</option></select></label>
                <label>Duration (minutes)<NumberInput min="0" value={form.industryDetails?.duration ?? 0} onChange={(event) => setDetails('duration', event.target.value)} /></label>
                <label className="wide-field">Service description<textarea rows="2" value={form.industryDetails?.serviceDescription || form.description || ''} onChange={(event) => { setDetails('serviceDescription', event.target.value); setForm((current) => ({ ...current, description: event.target.value })); }} /></label>
              </>
            ) : (
              <>
                <label>Quantity<NumberInput min="0" step="1" value={form.stockQuantity} disabled={isClothing && form.variants.length > 0} onChange={(event) => setForm({ ...form, stockQuantity: event.target.value })} required /></label>
                <label>Low-stock threshold<NumberInput min="0" step="1" value={form.lowStockThreshold} onChange={(event) => setForm({ ...form, lowStockThreshold: event.target.value })} /></label>
              </>
            )}
            {businessType === 'Mobile Shop' && (
              <>
                {dynamicTextFields.map(([key, title]) => <label key={key}>{title}<input value={form.industryDetails?.[key] || ''} onChange={(event) => setDetails(key, event.target.value)} /></label>)}
                <label>Repair charges<NumberInput min="0" step="0.01" value={form.industryDetails?.repairCharges ?? 0} onChange={(event) => setDetails('repairCharges', event.target.value)} /></label>
              </>
            )}
            {businessType === 'Electric Shop' && dynamicTextFields.map(([key, title]) => <label key={key}>{title}<input value={form.industryDetails?.[key] || ''} onChange={(event) => setDetails(key, event.target.value)} /></label>)}
            {businessType === 'Grocery Store' && (
              <>
                {dynamicTextFields.map(([key, title]) => <label key={key}>{title}<input value={form.industryDetails?.[key] || ''} onChange={(event) => setDetails(key, event.target.value)} /></label>)}
                <label>Expiry date<input type="date" value={form.industryDetails?.expiryDate ? String(form.industryDetails.expiryDate).slice(0, 10) : ''} onChange={(event) => setDetails('expiryDate', event.target.value)} /></label>
              </>
            )}
            {businessType === 'Clothing Shop' && (
              <div className="wide-field">
                <h4>Clothing details and size/color stock</h4>
                <div className="entity-form-grid">
                  <label>Fabric<input value={form.industryDetails?.fabric || ''} onChange={(event) => setDetails('fabric', event.target.value)} /></label>
                  <label>Design<input value={form.industryDetails?.design || ''} onChange={(event) => setDetails('design', event.target.value)} /></label>
                </div>
                {form.variants.map((variant, index) => (
                  <div className="variant-edit-row" key={variant._id || `variant-${index}`}>
                    {['size', 'color', 'design', 'sku', 'stockQuantity', 'sellingPrice'].map((key) => (
                      <input
                        key={key}
                        aria-label={`Variant ${key}`}
                        placeholder={key === 'sellingPrice' ? 'Sale price override' : key}
                        type={['stockQuantity', 'sellingPrice'].includes(key) ? 'number' : 'text'}
                        min={['stockQuantity', 'sellingPrice'].includes(key) ? '0' : undefined}
                        value={variant[key] ?? ''}
                        onChange={(event) => setVariant(index, key, event.target.value)}
                      />
                    ))}
                    <button className="btn btn-sm btn-outline-danger" type="button" onClick={() => setForm((current) => ({ ...current, variants: current.variants.filter((_, row) => row !== index) }))}>Remove</button>
                  </div>
                ))}
                <button className="btn btn-sm btn-outline-primary" type="button" onClick={() => setForm((current) => ({ ...current, variants: [...current.variants, { size: '', color: '', design: '', sku: '', stockQuantity: 0, sellingPrice: '' }] }))}>Add size/color variant</button>
              </div>
            )}
            <label className="wide-field">Product image (PNG/JPEG/WebP, max 1.8 MB)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseImage} /></label>
            {form.imageUrl && <img className="settings-logo-preview" src={form.imageUrl} alt="Product image preview" />}
            <label className="wide-field">Description<textarea rows="2" value={form.description || ''} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
            <div className="wide-field entity-form-actions"><button className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button></div>
          </form>
        </div>
      )}

      {loading ? <div className="card loading-card" aria-busy="true">Loading {isService ? 'services' : 'products'}...</div> : products.length ? (
        <>
          <div className="table-card product-table-view">
            <table>
              <thead><tr><th>{isService ? 'Service' : 'Product'}</th><th>SKU / Brand</th><th>Category</th><th>{isService ? 'Pricing' : 'Stock status'}</th><th>Price</th><th>Actions</th></tr></thead>
              <tbody>
                {products.map((product) => {
                  const lowStock = !product.isService && Number(product.stockQuantity) <= Number(product.lowStockThreshold);
                  return (
                    <tr key={product._id}>
                      <td><span className="table-primary-cell">{product.imageUrl ? <img className="product-table-image" src={product.imageUrl} alt="" /> : <span className="table-avatar">{product.isService ? <Wrench size={16} /> : <Package size={16} />}</span>}<strong>{product.name}</strong></span></td>
                      <td>{product.sku}<small>{product.brand || '—'}</small></td><td>{product.category || 'General'}</td>
                      <td>{product.isService ? `${product.pricingType}${product.serviceDuration ? ` · ${product.serviceDuration} min` : ''}` : <span className={`stock-label${lowStock ? ' stock-label-low' : ''}`}>{lowStock && <AlertTriangle size={13} />}{Number(product.stockQuantity || 0).toLocaleString()} {product.unit || 'units'}</span>}</td>
                      <td>PKR {Number(product.sellingPrice || 0).toLocaleString()}</td>
                      <td className="action-cell"><button className="btn btn-sm btn-outline-primary" onClick={() => startEdit(product)}>Edit</button><button className="btn btn-sm btn-outline-danger" onClick={() => remove(product)}>Delete</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="product-mobile-list">
            {products.map((product) => {
              const lowStock = !product.isService && Number(product.stockQuantity) <= Number(product.lowStockThreshold);
              return (
                <article className="card product-mobile-card" key={product._id}>
                  <div className="product-mobile-heading">
                    {product.imageUrl ? <img className="product-table-image" src={product.imageUrl} alt="" /> : <span className="table-avatar">{product.isService ? <Wrench size={16} /> : <Package size={16} />}</span>}
                    <span><strong>{product.name}</strong><small>{product.category || 'General'} · {product.sku}</small></span>
                    <strong className="product-mobile-price">PKR {Number(product.sellingPrice || 0).toLocaleString()}</strong>
                  </div>
                  <Pagination page={page} pages={pages} total={total} onChange={setPage} />
                  <div className="product-mobile-meta">{product.isService ? <span>Service · {product.pricingType || 'fixed'}</span> : <span className={`stock-label${lowStock ? ' stock-label-low' : ''}`}>{lowStock && <AlertTriangle size={13} />}{Number(product.stockQuantity || 0).toLocaleString()} {product.unit || 'units'} in stock</span>}</div>
                  <div className="action-cell"><button className="btn btn-sm btn-outline-primary" onClick={() => startEdit(product)}>Edit</button><button className="btn btn-sm btn-outline-danger" onClick={() => remove(product)}>Delete</button></div>
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <div className="card">
          <EmptyState icon={isService ? Wrench : Package} title={search || categoryFilter ? 'No matching items' : `No ${isService ? 'services' : 'products'} yet`} description={search || categoryFilter ? 'Try another search or clear the selected category.' : `Add your first ${isService ? 'service' : 'product'} to your catalog. It will be available when you create invoices.`} action={!search && !categoryFilter && <button className="btn btn-primary" onClick={startCreate}>Add your first {isService ? 'service' : 'product'}</button>} />
        </div>
      )}
    </div>
  );
}
