import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';
import connectDB from './config/db.js';
import Product from './models/Product.js';
import Category from './models/Category.js';
import Location from './models/Location.js';
import StockLevel from './models/StockLevel.js';
import PurchaseOrder from './models/PurchaseOrder.js';
import { startLowStockAlertJob } from './services/lowStockAlertJob.js';

const PORT = process.env.PORT || 5000;

// Fail fast with a clear message instead of crashing later (e.g. jwt.sign
// throwing on the first login) when server/.env is incomplete.
const REQUIRED_ENV = ['MONGO_URI', 'JWT_SECRET'];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(
    `Missing required environment variable(s): ${missingEnv.join(', ')}. Copy server/.env.example to server/.env and fill them in.`
  );
  process.exit(1);
}

// Makes the database's indexes match the schemas. This matters for soft
// deletes: Product/Category used to have a plain unique index on sku/name,
// which would stop a deleted item's SKU/name being reused. syncIndexes()
// drops that old index and builds the (field, deletedAt) one instead. It
// also creates the new collections up front, which MongoDB needs before
// they can be written to inside a multi-document transaction.
async function syncIndexes() {
  try {
    await Promise.all([Product, Category, Location, StockLevel, PurchaseOrder].map((m) => m.syncIndexes()));
    console.log('Database indexes synced');
  } catch (err) {
    console.error(`Index sync failed: ${err.message}`);
  }
}

connectDB()
  .then(async () => {
    await syncIndexes();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
    startLowStockAlertJob();
  })
  // The error is already logged in config/db.js; without a database the
  // server can't do anything useful, so stop here (same as before).
  .catch(() => process.exit(1));
