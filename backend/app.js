require('./config/env');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const { connectDB, getConnectionFailure } = require('./config/db');
const { getAllowedOrigins } = require('./config/cors');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/authRoutes');
const businessRoutes = require('./routes/businessRoutes');
const customerRoutes = require('./routes/customerRoutes');
const productRoutes = require('./routes/productRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const reportRoutes = require('./routes/reportRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const allowedOrigins = getAllowedOrigins();

app.set('trust proxy', 1);

app.use(
  cors({
    origin: (origin, callback) => callback(null, origin ? allowedOrigins.has(origin) : false),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    optionsSuccessStatus: 204,
  }),
);
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));

app.use(
  '/api',
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { forwardedHeader: false },
  }),
);

let vercelDatabaseConnection;
app.use('/api', async (req, res, next) => {
  if (process.env.VERCEL !== '1' || process.env.NODE_ENV === 'test' || mongoose.connection.readyState === 1) {
    return next();
  }

  try {
    if (!vercelDatabaseConnection) {
      vercelDatabaseConnection = connectDB()
        .catch((error) => {
          console.error(getConnectionFailure(error));
          throw error;
        })
        .finally(() => {
          vercelDatabaseConnection = null;
        });
    }
    await vercelDatabaseConnection;
    return next();
  } catch {
    return res.status(503).json({ success: false, status: 'unavailable', database: 'disconnected' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, status: 'unavailable', database: 'disconnected' });
  }
  try {
    await mongoose.connection.db.admin().ping();
    return res.json({ success: true, status: 'healthy', database: 'connected' });
  } catch (error) {
    console.error(`MongoDB health check failed: ${getConnectionFailure(error)}`);
    return res.status(503).json({ success: false, status: 'unavailable', database: 'unreachable' });
  }
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use(errorHandler);

module.exports = app;
