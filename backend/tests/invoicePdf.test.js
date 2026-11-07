jest.mock('../models/Invoice', () => ({
  findOne: jest.fn(),
}));

const Invoice = require('../models/Invoice');
const { downloadInvoicePdf } = require('../controllers/invoiceController');

describe('invoice PDF generation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a valid multi-page PDF with invoice data even when the optional logo is invalid', async () => {
    const invoice = {
      invoiceNumber: 'INV-1001',
      invoiceDate: new Date('2026-01-15T00:00:00.000Z'),
      dueDate: new Date('2026-01-30T00:00:00.000Z'),
      paymentStatus: 'partial',
      paymentMethod: 'Cash',
      subtotal: 1000,
      taxTotal: 50,
      discountTotal: 25,
      grandTotal: 1025,
      paidAmount: 400,
      remainingAmount: 625,
      notes: 'PDF generation test note',
      businessId: {
        name: 'Invoice Test Business',
        email: 'billing@example.com',
        phone: '555-0100',
        address: '100 Example Street',
        city: 'Test City',
        country: 'Pakistan',
        currency: 'PKR',
        logo: 'data:image/png;base64,not-valid-image-data',
      },
      customerId: {
        name: 'Invoice Test Customer',
        email: 'customer@example.com',
        phone: '555-0110',
        address: '200 Customer Road',
      },
      items: Array.from({ length: 40 }, (_, index) => ({
        productName: `Test Product ${index + 1}`,
        quantity: 1,
        unit: 'pcs',
        unitPrice: 25,
        lineTotal: 25,
        variantLabel: 'M / Blue',
        productDetails: { brand: 'BillFlow Test Brand' },
      })),
    };
    const query = {
      populate: jest.fn(),
    };
    query.populate.mockReturnValueOnce(query).mockResolvedValueOnce(invoice);
    Invoice.findOne.mockReturnValue(query);

    const responseHeaders = {};
    const res = {
      setHeader: jest.fn((name, value) => { responseHeaders[name] = value; }),
      send: jest.fn(),
    };
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await downloadInvoicePdf({ params: { id: 'invoice-1' }, businessId: 'business-1' }, res, jest.fn());

    const pdf = res.send.mock.calls[0][0];
    const pdfText = pdf.toString('latin1');
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdfText.startsWith('%PDF-')).toBe(true);
    expect(pdfText).toContain('Invoice Test Business');
    expect(pdfText).toContain('Invoice Test Customer');
    expect(pdfText).toContain('INV-1001');
    expect(pdfText).toContain('625.00');
    expect((pdfText.match(/\/Type \/Page\b/g) || []).length).toBeGreaterThan(1);
    expect(responseHeaders['Content-Type']).toBe('application/pdf');
    expect(responseHeaders['Content-Disposition']).toContain('invoice-INV-1001.pdf');
    expect(warn).toHaveBeenCalledWith('An invalid business logo was omitted from the invoice PDF.');
    warn.mockRestore();
  });
});
