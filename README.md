# BillFlow

BillFlow is a multi-tenant SaaS for billing, invoicing, inventory, customer management, reporting, and subscription administration.

## Features

- Business registration with a business type and tenant-isolated customer, product/service, invoice, and payment records
- Product details for mobile, clothing, electrical, grocery, and service businesses; size/color variants and variant stock
- A4 invoice PDF downloads, saved invoice details, payment history, and 58mm receipt preview/browser printing
- Real dashboard and reports, responsive business workspace, light/dark theme, and reusable password visibility control
- Super Admin business management, configurable subscription plans and limits, audit log, manual payment instructions, and approval/rejection workflow
- Subscription expiry/history and server-side enforcement of invoice, customer, product, and staff limits

No payment gateway or automatic charge processing is integrated. Admin approval of a manual payment request is the only way to activate a paid plan.

## Technology and folders

- Frontend: React, Vite, Bootstrap, Recharts, Lucide icons (`frontend/`)
- Backend: Node.js, Express, MongoDB, Mongoose (`backend/`)
- Authentication: JWT in HttpOnly cookies, bcryptjs
- Tests: Jest, Supertest, standalone in-memory MongoDB integration verification

## Install

Use `npm.cmd` from Windows PowerShell to avoid the `npm.ps1` execution policy issue:

```powershell
Set-Location frontend
npm.cmd install
Set-Location ..\backend
npm.cmd install
```

Configure `backend/.env` (copy from `backend/.env.example`) with:

- `MONGODB_URI`: MongoDB Atlas URI or another MongoDB URI for the `billflow` database
- `JWT_SECRET`: long, private random signing key
- `CLIENT_URL`: allowed frontend origin, normally `http://localhost:5173`
- `PORT`: optional API port; defaults to `5000`
- `NODE_ENV`: `development` or `production` for a normal server

`MONGODB_URI` is the standard name. A legacy `MONGO_URI` is temporarily accepted with a deprecation warning, but if both variables are set they must match. The backend loads `backend/.env` relative to its own directory; an inherited empty environment variable will not mask a non-empty value from that file. The server connects to the configured MongoDB before listening and never falls back to in-memory MongoDB in server mode. Only the dedicated test integration script opts into its temporary in-memory database. Startup errors do not print the URI or credentials.

If startup reports an SRV DNS lookup failure, verify that the Atlas-generated hostname is correct and that the current network's DNS resolver supports SRV records. On Windows, test with `Resolve-DnsName -Type SRV _mongodb._tcp.<cluster-host>`; do not share the full connection URI when troubleshooting.

For Atlas, create a database user with only the required application database permissions and add the development machine/server network address to Atlas Network Access. Keep the URI and JWT secret private; do not commit `.env`.

The frontend Vite development server proxies `/api` to `http://localhost:5000`. Optionally set `VITE_BACKEND_URL` for another local backend address, or `VITE_API_URL` to use a fully qualified API base URL.

## Start the application

Run each command in its own PowerShell terminal:

```powershell
Set-Location backend
npm.cmd run dev
```

```powershell
Set-Location frontend
npm.cmd run dev
```

The backend listens on port 5000 unless `PORT` is configured. Check `GET http://localhost:5000/api/health`; it returns success only when MongoDB is connected. If the API is unavailable, the frontend reports the connection problem instead of substituting fake data.

## Deploy the backend to Vercel

Set the Vercel project's Root Directory to `backend` and deploy the Express app exported from `app.js`. Add `MONGODB_URI`, `JWT_SECRET`, and `CLIENT_URL` to the Vercel environment for each deployment target you use (Production, Preview, or Development). `MONGODB_URI` must be available to the function at runtime; add the deployment's outbound network access to MongoDB Atlas Network Access as required by the cluster.

Vercel supplies `VERCEL=1`. The Express app trusts one proxy hop for `X-Forwarded-For` and initializes MongoDB on the first API request, including `/api/health`. After deployment, request `https://<deployment-host>/api/health`; expect HTTP 200 with `database: "connected"`. A 503 indicates the database connection is missing or unavailable; use the sanitized Vercel function logs to distinguish missing configuration, URI format, authentication, DNS, timeout, or network-access failures. Never put the URI or credentials in logs or support messages.

## Initial setup: plans and Super Admin

Seed Free, Starter, and Professional plans. The command is idempotent and preserves existing plan settings:

```powershell
Set-Location backend
npm.cmd run seed:plans
```

Create the first Super Admin with environment variables. Set `MONGODB_URI` and `JWT_SECRET` in `backend/.env` first; the seed command loads that file.

```powershell
$env:SUPER_ADMIN_EMAIL = "admin@example.com"
$env:SUPER_ADMIN_NAME = "BillFlow Administrator"
$env:SUPER_ADMIN_PASSWORD = Read-Host "Enter a unique password (14+ characters)"
npm.cmd run seed:admin
```

The password is hashed, must be at least 14 characters, and is never printed. The seed command refuses to promote an existing non-admin account and makes no duplicate admin if the account already exists. Sign in at `/super-admin/login`; business registration cannot create a Super Admin. Admin APIs are role-protected and separate from business tenant APIs.

If upgrading a database created before invoice numbers were scoped by business, back up the database and run `npm.cmd run migrate:invoice-index` from `backend`. It drops only the legacy global invoice-number index and creates the compound `(businessId, invoiceNumber)` index; it does not delete or rewrite invoice documents.

## Manual subscription request and review

1. A business owner chooses a configured paid plan and monthly or yearly term.
2. The owner follows Super Admin-configured manual payment instructions and submits the method, reference, payment date, exact plan amount, notes, and optional PNG/JPEG/WebP proof image.
3. The request remains pending; a frontend success message alone never activates a subscription.
4. A Super Admin reviews it in the Payment Requests section and approves or rejects it. Approval activates the matching plan and term; rejection leaves the existing subscription unchanged and can provide a reason visible to the owner.
5. The business sees request/rejection history in Subscriptions. Admin-only review notes are not returned to business APIs.

Never submit full card numbers, CVV/security codes, PINs, passwords, or other payment credentials. Payment proof images are limited to 1.8 MB and stored with the payment request in MongoDB. Configure only appropriate public payment instructions; do not enter private administrator account credentials.

## Product and invoice workflows

Business type is saved on the business and controls relevant product fields: mobile model/serial/warranty, clothing fabric and size/color variants with per-variant stock, electrical specifications, grocery batch/expiry/units, or service pricing/duration without inventory. Product and service details are stored with each saved invoice item so later edits do not rewrite historical invoice lines.

From Invoices, use **A4 PDF** for the saved invoice PDF or **Receipt** to preview a narrow 58mm thermal-style receipt. The receipt's Print button uses the browser printer adapter and opens the browser print dialog; choose a connected printer there. Browser printing works as the fallback without Bluetooth. No Bluetooth printer compatibility or device communication is claimed until an exact printer model is tested; a future device adapter must use the manufacturer's supported protocol/SDK.

## Verification commands

```powershell
Set-Location backend
npm.cmd test
npm.cmd run test:integration
Set-Location ..\frontend
npm.cmd run build
npm.cmd run lint
```

The backend integration script uses an isolated in-memory MongoDB and verifies health, registration/auth, role boundaries, tenant isolation, customer/product operations, variant stock, service invoicing, PDF generation, payment request review, payment settings, plan limits, and reporting. It does not connect to Atlas or alter production records. The actual configured Atlas connection must be checked by starting the backend in development and requesting `/api/health`.
