import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import connectDB from './config/db.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import productRoutes from './routes/productRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import locationRoutes from './routes/locationRoutes.js';
import purchaseOrderRoutes from './routes/purchaseOrderRoutes.js';
import reportRoutes from './routes/reportRoutes.js';

const app = express();

// The deployed API sits behind the hosting provider's proxy. Trusting it
// lets Express (and the rate limiter) see each visitor's real IP address
// instead of treating every visitor as the same one.
app.set('trust proxy', 1);

// Sets a standard set of protective HTTP response headers (X-Content-Type-Options,
// X-Frame-Options, etc.). Using the defaults here rather than hand-tuning
// individual headers, since this API serves JSON only (no HTML/inline
// scripts of its own) and doesn't need CSP customization.
app.use(helmet());

// Allow one or more frontend origins, comma-separated in CLIENT_URL.
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // No Origin header = non-browser clients (mobile apps, curl).
      // CORS only protects browsers, so these are let through.
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  })
);

// A generous but finite cap. Raised from the API's original 10kb to
// accommodate bulk CSV product imports (up to 500 rows), which is the
// only endpoint that legitimately needs a larger payload.
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Strips any request key starting with '$' or containing '.' from
// body/query/params, which is how MongoDB operator-injection attacks
// (e.g. sending {"email": {"$ne": null}} to bypass a query) work.
app.use(mongoSanitize());

// Health check — confirms the server is up and the database is reachable.
app.get('/api/health', async (req, res) => {
  try {
    await connectDB();
    res.json({ success: true, message: 'API is running', database: 'connected' });
  } catch {
    res.status(503).json({ success: false, message: 'Database is unreachable', database: 'disconnected' });
  }
});

// Make sure the database is connected before any route runs. The
// connection is cached (see config/db.js), so this is instant after the
// first request. Needed where the server is started on demand rather than
// through server.js.
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/reports', reportRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
