import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import EmptyState from '../components/EmptyState';
import { ChartNoAxesCombined } from 'lucide-react';
import api from '../services/api';

function toCsvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

export default function ReportsPage() {
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const revenueByDay = useMemo(() => {
    const daily = new Map();
    for (const invoice of report?.invoices || []) {
      const date = new Date(invoice.invoiceDate);
      if (!Number.isFinite(date.getTime())) continue;
      const key = date.toISOString().slice(0, 10);
      const current = daily.get(key) || { date, paid: 0, invoiced: 0 };
      current.paid += Number(invoice.paidAmount || 0);
      current.invoiced += Number(invoice.grandTotal || 0);
      daily.set(key, current);
    }
    return [...daily.entries()]
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([, values]) => ({
        day: values.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        paid: values.paid,
        invoiced: values.invoiced,
      }));
  }, [report]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/reports', { params: { startDate, endDate } });
      setReport(data);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const exportCsv = () => {
    if (!report) return;
    const rows = [
      ['Invoice', 'Date', 'Customer', 'Status', 'Subtotal', 'Tax', 'Total', 'Paid', 'Balance'],
      ...report.invoices.map((invoice) => [
        invoice.invoiceNumber,
        new Date(invoice.invoiceDate).toLocaleDateString(),
        invoice.customerId?.name || '',
        invoice.paymentStatus,
        invoice.subtotal,
        invoice.taxTotal,
        invoice.grandTotal,
        invoice.paidAmount,
        invoice.remainingAmount,
      ]),
    ];
    const blob = new Blob([rows.map((row) => row.map(toCsvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `billflow-report-${startDate}-${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-box">
      <div className="page-header">
        <div><p className="eyebrow">Analytics</p><h2>Sales report</h2></div>
        <button className="btn btn-outline-primary" disabled={!report} onClick={exportCsv}>Export CSV</button>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      <form className="report-filters" onSubmit={(event) => { event.preventDefault(); load(); }}>
        <label>From<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required /></label>
        <label>To<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required /></label>
        <button className="btn btn-primary" disabled={loading}>{loading ? 'Loading...' : 'Apply range'}</button>
      </form>

      {loading ? <div className="card">Loading report...</div> : report && (
        <>
          <div className="stats-grid report-summary">
            <div className="stat-card"><span>Paid revenue</span><strong>PKR {Number(report.totalRevenue || 0).toLocaleString()}</strong></div>
            <div className="stat-card"><span>Outstanding</span><strong>PKR {Number(report.outstanding || 0).toLocaleString()}</strong></div>
            <div className="stat-card"><span>Estimated profit</span><strong>PKR {Number(report.profitEstimate || 0).toLocaleString()}</strong></div>
            <div className="stat-card"><span>Invoices</span><strong>{report.invoices.length}</strong></div>
          </div>
          <section className="card report-chart-card">
            <div className="section-heading">
              <div><p className="eyebrow">Selected period</p><h2>Daily paid revenue</h2></div>
              <span className="chart-period">{startDate} – {endDate}</span>
            </div>
            {revenueByDay.some((entry) => entry.paid > 0) ? (
              <div className="report-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueByDay} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="reportRevenueFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} dy={8} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} tickFormatter={(value) => `${Number(value) >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`} width={48} />
                    <Tooltip formatter={(value) => [`PKR ${Number(value).toLocaleString()}`, 'Paid revenue']} />
                    <Area type="monotone" dataKey="paid" stroke="var(--primary)" strokeWidth={2.5} fill="url(#reportRevenueFill)" activeDot={{ r: 5, strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState icon={ChartNoAxesCombined} title="No paid revenue in this period" description="Revenue appears after payment is recorded against an invoice." className="chart-empty-state" />
            )}
          </section>
          <div className="table-card">
            <table>
            
              <thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Status</th><th>Total</th><th>Paid</th><th>Balance</th></tr></thead>
              <tbody>
                {report.invoices.map((invoice) => (
                  <tr key={invoice._id}>
                    <td>{invoice.invoiceNumber}</td><td>{new Date(invoice.invoiceDate).toLocaleDateString()}</td>
                    <td>{invoice.customerId?.name || 'Unknown'}</td><td>{invoice.paymentStatus}</td>
                    <td>PKR {Number(invoice.grandTotal).toLocaleString()}</td><td>PKR {Number(invoice.paidAmount).toLocaleString()}</td><td>PKR {Number(invoice.remainingAmount).toLocaleString()}</td>
                  </tr>
                ))}
                {!report.invoices.length && <tr><td colSpan="7">No invoice activity in this date range.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="report-disclaimer">Profit is estimated from invoice line items with stored purchase-price snapshots. Older invoices created before snapshots were stored are excluded from profit estimates.</p>
        </>
      )}
    </div>
  );
}
