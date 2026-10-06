import crypto from 'crypto';
import mongoose from 'mongoose';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Product from '../models/Product.js';
import Location from '../models/Location.js';
import Transaction from '../models/Transaction.js';
import asyncHandler from '../utils/asyncHandler.js';
import { applyMovement } from '../services/stockService.js';

const PO_POPULATE = [
  { path: 'items.product', select: 'name sku quantity deletedAt', options: { includeDeleted: true } },
  { path: 'createdBy', select: 'name' },
  { path: 'receivedBy', select: 'name' },
  { path: 'location', select: 'name', options: { includeDeleted: true } },
];

const generatePoNumber = () => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `PO-${date}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
};

const withTotal = (po) => {
  const plain = typeof po.toObject === 'function' ? po.toObject() : po;
  return {
    ...plain,
    total: (plain.items || []).reduce((sum, i) => sum + i.quantity * (i.unitCost || 0), 0),
  };
};

const fail = (res, status, message) => res.status(status).json({ success: false, message });

// Validates line items and confirms every product exists (and is active).
// Returns an error message, or null when valid.
async function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) return 'Add at least one item';

  const seen = new Set();
  for (const item of items) {
    if (!item.product || !mongoose.Types.ObjectId.isValid(item.product)) return 'Every item needs a valid product';
    if (seen.has(String(item.product))) return 'Each product can only appear once per order';
    seen.add(String(item.product));
    if (!Number.isInteger(Number(item.quantity)) || Number(item.quantity) <= 0) {
      return 'Item quantities must be positive whole numbers';
    }
    if (item.unitCost !== undefined && item.unitCost !== '' && Number(item.unitCost) < 0) {
      return 'Unit cost cannot be negative';
    }
  }

  const found = await Product.countDocuments({ _id: { $in: [...seen] } });
  if (found !== seen.size) return 'One or more products no longer exist';
  return null;
}

const normalizeItems = (items) =>
  items.map((i) => ({ product: i.product, quantity: Number(i.quantity), unitCost: Number(i.unitCost) || 0 }));

// @route  GET /api/purchase-orders
// @access Private
export const getPurchaseOrders = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);
  const filter = {};
  if (['Draft', 'Ordered', 'Received', 'Cancelled'].includes(req.query.status)) {
    filter.status = req.query.status;
  }

  const [orders, total] = await Promise.all([
    PurchaseOrder.find(filter)
      .populate(PO_POPULATE)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    PurchaseOrder.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: orders.map(withTotal),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  });
});

// @route  GET /api/purchase-orders/reorder-suggestions
// @access Private
// Low / out-of-stock products grouped by supplier, with a suggested order
// quantity (enough to reach twice the minimum level). Products already on
// an open (Draft/Ordered) purchase order are left out so they aren't
// ordered twice.
export const getReorderSuggestions = asyncHandler(async (req, res) => {
  const [products, openOrders] = await Promise.all([
    Product.find({ status: { $in: ['Low Stock', 'Out of Stock'] } })
      .select('name sku quantity minimumStockLevel supplier')
      .sort({ name: 1 })
      .lean(),
    PurchaseOrder.find({ status: { $in: ['Draft', 'Ordered'] } }).select('items.product').lean(),
  ]);

  const onOrder = new Set(openOrders.flatMap((po) => po.items.map((i) => String(i.product))));

  const groups = new Map();
  products
    .filter((p) => !onOrder.has(String(p._id)))
    .forEach((p) => {
      const key = p.supplier || '';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({
        product: { _id: p._id, name: p.name, sku: p.sku, quantity: p.quantity, minimumStockLevel: p.minimumStockLevel },
        suggestedQuantity: Math.max(p.minimumStockLevel * 2 - p.quantity, 1),
      });
    });

  res.json({
    success: true,
    data: [...groups.entries()].map(([supplier, items]) => ({ supplier, items })),
  });
});

// @route  GET /api/purchase-orders/:id
// @access Private
export const getPurchaseOrderById = asyncHandler(async (req, res) => {
  const po = await PurchaseOrder.findById(req.params.id).populate(PO_POPULATE);
  if (!po) return fail(res, 404, 'Purchase order not found');
  res.json({ success: true, data: withTotal(po) });
});

// @route  POST /api/purchase-orders
// @access Private/Admin
export const createPurchaseOrder = asyncHandler(async (req, res) => {
  const { supplier, items, notes, expectedDate } = req.body;
  const location = req.body.location || null;

  if (!supplier || !String(supplier).trim()) return fail(res, 422, 'Supplier is required');
  const itemsError = await validateItems(items);
  if (itemsError) return fail(res, 422, itemsError);
  if (location && !(await Location.findById(location))) return fail(res, 404, 'Location not found');

  const po = await PurchaseOrder.create({
    poNumber: generatePoNumber(),
    supplier: String(supplier).trim(),
    items: normalizeItems(items),
    notes: notes || '',
    expectedDate: expectedDate || null,
    location,
    createdBy: req.user._id,
  });

  await po.populate(PO_POPULATE);
  res.status(201).json({ success: true, message: `Purchase order ${po.poNumber} created`, data: withTotal(po) });
});

// @route  PUT /api/purchase-orders/:id
// @access Private/Admin — only drafts can be edited.
export const updatePurchaseOrder = asyncHandler(async (req, res) => {
  const po = await PurchaseOrder.findById(req.params.id);
  if (!po) return fail(res, 404, 'Purchase order not found');
  if (po.status !== 'Draft') return fail(res, 409, 'Only draft purchase orders can be edited');

  const { supplier, items, notes, expectedDate } = req.body;

  if (supplier !== undefined) {
    if (!String(supplier).trim()) return fail(res, 422, 'Supplier is required');
    po.supplier = String(supplier).trim();
  }
  if (items !== undefined) {
    const itemsError = await validateItems(items);
    if (itemsError) return fail(res, 422, itemsError);
    po.items = normalizeItems(items);
  }
  if (notes !== undefined) po.notes = notes;
  if (expectedDate !== undefined) po.expectedDate = expectedDate || null;
  if (req.body.location !== undefined) {
    const location = req.body.location || null;
    if (location && !(await Location.findById(location))) return fail(res, 404, 'Location not found');
    po.location = location;
  }

  await po.save();
  await po.populate(PO_POPULATE);
  res.json({ success: true, message: 'Purchase order updated', data: withTotal(po) });
});

// @route  POST /api/purchase-orders/:id/order
// @access Private/Admin — Draft -> Ordered
export const markOrdered = asyncHandler(async (req, res) => {
  const po = await PurchaseOrder.findById(req.params.id);
  if (!po) return fail(res, 404, 'Purchase order not found');
  if (po.status !== 'Draft') return fail(res, 409, `Cannot place an order that is already ${po.status}`);

  po.status = 'Ordered';
  po.orderedAt = new Date();
  await po.save();
  await po.populate(PO_POPULATE);
  res.json({ success: true, message: `${po.poNumber} marked as ordered`, data: withTotal(po) });
});

// @route  POST /api/purchase-orders/:id/cancel
// @access Private/Admin — Draft/Ordered -> Cancelled
export const cancelPurchaseOrder = asyncHandler(async (req, res) => {
  const po = await PurchaseOrder.findById(req.params.id);
  if (!po) return fail(res, 404, 'Purchase order not found');
  if (!['Draft', 'Ordered'].includes(po.status)) return fail(res, 409, `Cannot cancel a ${po.status} order`);

  po.status = 'Cancelled';
  await po.save();
  await po.populate(PO_POPULATE);
  res.json({ success: true, message: `${po.poNumber} cancelled`, data: withTotal(po) });
});

// @route  POST /api/purchase-orders/:id/receive
// @access Private (admin or staff)
// Body (optional): { location } — where to put the stock away, overriding
// the order's default.
//
// Receiving a PO does what a person would otherwise do by hand: for every
// line item it adds the stock, updates the location's stock level, and
// writes a STOCK_IN transaction referencing the PO number. All of it runs
// in one MongoDB transaction, so a failure part-way leaves nothing behind.
export const receivePurchaseOrder = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  let receivedId;

  try {
    await session.withTransaction(async () => {
      const po = await PurchaseOrder.findById(req.params.id).session(session);
      if (!po) throw Object.assign(new Error('Purchase order not found'), { statusCode: 404 });
      // Checked inside the transaction so two simultaneous "receive"
      // clicks can't both add the stock.
      if (po.status !== 'Ordered') {
        throw Object.assign(
          new Error(po.status === 'Draft' ? 'Mark the order as ordered before receiving it' : `Order is already ${po.status}`),
          { statusCode: 409 }
        );
      }

      const locationId = req.body.location || po.location || null;

      for (const item of po.items) {
        const product = await Product.findById(item.product).session(session);
        if (!product) {
          throw Object.assign(new Error('A product on this order has since been deleted'), { statusCode: 409 });
        }

        await applyMovement({ product, type: 'STOCK_IN', qty: item.quantity, locationId, session });

        await Transaction.create(
          [
            {
              product: product._id,
              type: 'STOCK_IN',
              quantity: item.quantity,
              supplier: po.supplier,
              referenceNumber: po.poNumber,
              notes: `Received via ${po.poNumber}`,
              performedBy: req.user._id,
              location: locationId,
            },
          ],
          { session }
        );
      }

      po.status = 'Received';
      po.receivedAt = new Date();
      po.receivedBy = req.user._id;
      if (locationId) po.location = locationId;
      await po.save({ session });
      receivedId = po._id;
    });

    const po = await PurchaseOrder.findById(receivedId).populate(PO_POPULATE);
    res.json({ success: true, message: `${po.poNumber} received — stock updated`, data: withTotal(po) });
  } catch (err) {
    if (err.statusCode) return fail(res, err.statusCode, err.message);
    throw err;
  } finally {
    await session.endSession();
  }
});

// @route  DELETE /api/purchase-orders/:id
// @access Private/Admin — drafts and cancelled orders only; orders that
// were placed or received are part of the audit trail and are kept.
export const deletePurchaseOrder = asyncHandler(async (req, res) => {
  const po = await PurchaseOrder.findById(req.params.id);
  if (!po) return fail(res, 404, 'Purchase order not found');
  if (!['Draft', 'Cancelled'].includes(po.status)) {
    return fail(res, 409, 'Only draft or cancelled purchase orders can be deleted');
  }

  await po.deleteOne();
  res.json({ success: true, message: 'Purchase order deleted' });
});
