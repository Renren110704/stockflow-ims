import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import Product from '../models/Product.js';
import asyncHandler from '../utils/asyncHandler.js';
import { validateTransactionInput } from '../validators/transactionValidators.js';
import { applyMovement, applyTransfer } from '../services/stockService.js';

// Products and locations can be soft-deleted; the history must still show
// their names, so every populate here opts back in to deleted records.
const TX_POPULATE = [
  { path: 'product', select: 'name sku deletedAt', options: { includeDeleted: true } },
  { path: 'performedBy', select: 'name email' },
  { path: 'location fromLocation toLocation', select: 'name', options: { includeDeleted: true } },
];

const emptyToNull = (value) => (value ? value : null);

// @route  POST /api/transactions
// @access Private (admin or staff — both roles can record stock movements)
//
// Every inventory movement must update the product's quantity AND be
// recorded as a Transaction, together, or not at all. That's what the
// MongoDB session below guarantees: if the product update fails after
// the transaction is written (or vice versa), the whole operation rolls
// back rather than leaving the two out of sync.
//
// An optional `location` ties the movement to a specific location's stock.
export const createTransaction = asyncHandler(async (req, res) => {
  const { product: productId, type, quantity, reason, supplier, referenceNumber, notes } = req.body;
  const location = emptyToNull(req.body.location);

  const errors = validateTransactionInput({ product: productId, type, quantity });
  if (location && !mongoose.Types.ObjectId.isValid(location)) errors.push('Location is not a valid id');
  if (errors.length > 0) {
    return res.status(422).json({ success: false, message: errors[0], errors });
  }

  const qty = Number(quantity);
  const session = await mongoose.startSession();

  try {
    let updatedProduct;
    let transaction;

    await session.withTransaction(async () => {
      const product = await Product.findById(productId).session(session);
      if (!product) {
        throw Object.assign(new Error('Product not found'), { statusCode: 404 });
      }

      await applyMovement({ product, type, qty, locationId: location, session });

      const [createdTransaction] = await Transaction.create(
        [
          {
            product: product._id,
            type,
            quantity: qty,
            reason: reason || '',
            supplier: supplier || '',
            referenceNumber: referenceNumber || '',
            notes: notes || '',
            performedBy: req.user._id,
            location,
          },
        ],
        { session }
      );

      updatedProduct = product;
      transaction = createdTransaction;
    });

    await transaction.populate(TX_POPULATE);

    res.status(201).json({
      success: true,
      message: `${type === 'STOCK_IN' ? 'Stock in' : 'Stock out'} recorded successfully`,
      data: { transaction, product: updatedProduct },
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    throw err; // falls through to the centralized error handler
  } finally {
    await session.endSession();
  }
});

// @route  POST /api/transactions/transfer
// @access Private
// Body: { product, from, to, quantity, notes } — `from`/`to` are location
// ids, or empty for "unassigned" stock. Total product quantity is unchanged;
// only its distribution across locations moves.
export const transferStock = asyncHandler(async (req, res) => {
  const { product: productId, quantity, notes } = req.body;
  const from = emptyToNull(req.body.from);
  const to = emptyToNull(req.body.to);

  const errors = [];
  if (!productId || !mongoose.Types.ObjectId.isValid(productId)) errors.push('A valid product is required');
  if (!Number.isInteger(Number(quantity)) || Number(quantity) <= 0) {
    errors.push('Quantity must be a positive whole number');
  }
  if (from && !mongoose.Types.ObjectId.isValid(from)) errors.push('Source location is not a valid id');
  if (to && !mongoose.Types.ObjectId.isValid(to)) errors.push('Destination location is not a valid id');
  if (errors.length > 0) {
    return res.status(422).json({ success: false, message: errors[0], errors });
  }

  const qty = Number(quantity);
  const session = await mongoose.startSession();

  try {
    let transaction;

    await session.withTransaction(async () => {
      const product = await Product.findById(productId).session(session);
      if (!product) {
        throw Object.assign(new Error('Product not found'), { statusCode: 404 });
      }

      await applyTransfer({ product, qty, fromId: from, toId: to, session });

      const [created] = await Transaction.create(
        [
          {
            product: product._id,
            type: 'TRANSFER',
            quantity: qty,
            notes: notes || '',
            performedBy: req.user._id,
            fromLocation: from,
            toLocation: to,
          },
        ],
        { session }
      );
      transaction = created;
    });

    await transaction.populate(TX_POPULATE);
    res.status(201).json({ success: true, message: 'Stock transferred successfully', data: { transaction } });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    throw err;
  } finally {
    await session.endSession();
  }
});

// @route  GET /api/transactions
// @access Private
// Supports ?page=&limit= pagination and optional ?startDate=&endDate=
// (ISO date strings, inclusive) filtering by createdAt, and ?type=
// (STOCK_IN|STOCK_OUT|TRANSFER), and ?search= (matches product name/SKU,
// reference number, supplier, reason or notes) — together these are what the
// Transactions page's audit-trail filter bar and CSV export use.
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const getTransactions = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);
  const skip = (page - 1) * limit;

  const { startDate, endDate, type } = req.query;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const filter = {};

  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    // Include soft-deleted products so history for them stays searchable.
    const matchingProducts = await Product.find({ $or: [{ name: regex }, { sku: regex }] })
      .setOptions({ includeDeleted: true })
      .select('_id');
    filter.$or = [
      { product: { $in: matchingProducts.map((p) => p._id) } },
      { referenceNumber: regex },
      { supplier: regex },
      { reason: regex },
      { notes: regex },
    ];
  }

  if (['STOCK_IN', 'STOCK_OUT', 'TRANSFER'].includes(type)) {
    filter.type = type;
  }

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) {
      const from = new Date(startDate);
      if (!Number.isNaN(from.getTime())) filter.createdAt.$gte = from;
    }
    if (endDate) {
      // Treat endDate as inclusive of the whole day, not just midnight.
      const to = new Date(endDate);
      if (!Number.isNaN(to.getTime())) {
        to.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = to;
      }
    }
    if (Object.keys(filter.createdAt).length === 0) delete filter.createdAt;
  }

  const [transactions, total] = await Promise.all([
    Transaction.find(filter).populate(TX_POPULATE).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Transaction.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: transactions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  });
});

// @route  GET /api/transactions/:id
// @access Private
export const getTransactionById = asyncHandler(async (req, res) => {
  const transaction = await Transaction.findById(req.params.id).populate(TX_POPULATE);

  if (!transaction) {
    return res.status(404).json({ success: false, message: 'Transaction not found' });
  }

  res.json({ success: true, data: transaction });
});
