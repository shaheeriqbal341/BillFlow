import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import ReceiptPreview from '../components/ReceiptPreview';
import api from '../services/api';

const printerMethods = ['bluetooth', 'usb', 'system'];
const testReceipt = {
  _id: 'local-printer-test',
  invoiceNumber: 'TEST-58MM',
  invoiceDate: new Date().toISOString(),
  customerId: { name: 'Printer test' },
  businessId: { name: 'BillFlow Printer Test', currency: 'PKR' },
  items: [{ _id: 'test-item', productName: '58mm receipt test', quantity: 1, unitPrice: 100, lineTotal: 100, unit: 'item' }],
  subtotal: 100,
  discountTotal: 0,
  taxTotal: 0,
  grandTotal: 100,
  paidAmount: 100,
  remainingAmount: 0,
  paymentStatus: 'paid',
  paymentMethod: 'Test only',
};

const businessTypes = [
  'Mobile Shop',
  'Clothing Shop',
  'Electric Shop',
  'Grocery Store',
  'General Retail Shop',
  'Freelancer / Service Business',
  'Other',
];

export default function SettingsPage() {
  const [connectionMethod, setConnectionMethod] = useState(() => {
    const savedMethod = localStorage.getItem('billflow-printer-connection');
    return printerMethods.includes(savedMethod) ? savedMethod : 'system';
  });
  const [testPrintOpen, setTestPrintOpen] = useState(false);
  const [business, setBusiness] = useState({
    name: '',
    type: 'General Retail Shop',
    currency: 'PKR',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: 'Pakistan',
    logo: '',
  });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/business/me');
        setBusiness({
          name: data.business?.name || '',
          type: data.business?.type || 'General Retail Shop',
          currency: data.business?.currency || 'PKR',
          email: data.business?.email || '',
          phone: data.business?.phone || '',
          address: data.business?.address || '',
          city: data.business?.city || '',
          country: data.business?.country || 'Pakistan',
          logo: data.business?.logo || '',
        });
      } catch (error) {
        console.error(error);
      }
    };
    load();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setBusiness((prev) => ({ ...prev, [name]: value }));
  };

  const handlePrinterMethodChange = (event) => {
    const method = event.target.value;
    if (!printerMethods.includes(method)) return;
    setConnectionMethod(method);
    localStorage.setItem('billflow-printer-connection', method);
  };

  const handleLogoFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 1_800_000) {
      setError('Choose a PNG or JPEG logo smaller than 1.8 MB.');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setBusiness((current) => ({ ...current, logo: String(reader.result || '') }));
      setError('');
    };
    reader.onerror = () => setError('Could not read the selected business logo.');
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await api.put('/business/me', business);
      setNotice('Business settings updated.');
    } catch (error) {
      setError(error.response?.data?.message || 'Business settings could not be saved');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-box">
      <div className="page-header">
        <div>
          <p className="eyebrow">Configuration</p>
          <h2>Business settings</h2>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}
      <div className="card" style={{ maxWidth: 700 }}>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Business name
            <input type="text" name="name" value={business.name} onChange={handleChange} />
          </label>
          <label>
            Business type
            <select name="type" value={business.type} onChange={handleChange} required>
              {businessTypes.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label>
            Currency
            <input type="text" name="currency" value={business.currency} onChange={handleChange} />
          </label>
          <label>
            Email
            <input type="email" name="email" value={business.email} onChange={handleChange} />
          </label>
          <label>
            Phone
            <input type="text" name="phone" value={business.phone} onChange={handleChange} />
          </label>
          <label>
            Address
            <input type="text" name="address" value={business.address} onChange={handleChange} />
          </label>
          <label>
            City
            <input type="text" name="city" value={business.city} onChange={handleChange} />
          </label>
          <label>
            Country
            <input type="text" name="country" value={business.country} onChange={handleChange} />
          </label>
          <label>
            Business logo (PNG/JPEG, max 1.8 MB)
            <input type="file" accept="image/png,image/jpeg" onChange={handleLogoFile} />
          </label>
          {business.logo && <img className="settings-logo-preview" src={business.logo} alt="Current business logo" />}
          <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save settings'}</button>
        </form>
      </div>

      <section className="card printer-settings" aria-labelledby="printer-settings-title">
        <div className="section-heading">
          <div><p className="eyebrow">Receipts</p><h2 id="printer-settings-title">Receipt printer</h2></div>
          <Printer size={20} aria-hidden="true" />
        </div>
        <p><strong>SpeedX BT-500M</strong> · 58 mm paper · approximately 48 mm printable width</p>
        <label className="printer-method-field">Preferred connection method
          <select value={connectionMethod} onChange={handlePrinterMethodChange}>
            <option value="bluetooth">Bluetooth via Windows print dialog</option>
            <option value="usb">USB via Windows print dialog</option>
            <option value="system">System Print</option>
          </select>
        </label>
        <p className="printer-status" role="status"><strong>Connection status:</strong> Not verified by BillFlow. The browser cannot confirm printer pairing, paper, or physical output.</p>
        <div className="receipt-settings-preview" aria-label="Receipt preview sample">
          <strong>BillFlow Printer Test</strong>
          <span>58mm roll · 48mm content</span>
          <span>Sample item × 1</span>
          <span>Total PKR 100.00</span>
        </div>
        <button type="button" className="btn btn-outline-primary printer-test-button" onClick={() => setTestPrintOpen(true)}>
          <Printer size={16} /> Preview / Test Print
        </button>
        <div className="printer-help">
          <p>Pair the printer in Windows Settings under Bluetooth &amp; devices. If Windows does not create a printer queue, install the model-compatible driver from the printer supplier, then confirm the queue appears in Printers &amp; scanners. Select that queue in the browser print dialog and set its paper size to 58 mm.</p>
          <p>Model listings confirm Bluetooth and USB, but do not identify Bluetooth Classic versus BLE or document an ESC/POS profile. BillFlow therefore uses Windows printing and does not connect to Bluetooth directly. If printing fails, check the selected Windows queue, driver, Bluetooth connection or USB cable, paper roll, and printer power.</p>
        </div>
      </section>
      <ReceiptPreview invoice={testPrintOpen ? testReceipt : null} onClose={() => setTestPrintOpen(false)} testMode />
    </div>
  );
}
