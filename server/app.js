import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
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

// Sets a standard set of protective HTTP response headers (X-Content-Type-Options,
// X-Frame-Options, etc.). Using the defaults here rather than hand-tuning
// individual headers, since this API serves JSON only (no HTML/inline
// scripts of its own) and doesn't need CSP customization.
app.use(helmet());

// Only allow the configured frontend origin to make credentialed requests.
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
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

// Simple health check — useful for confirming the server + DB are up.
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'API is running' });
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
