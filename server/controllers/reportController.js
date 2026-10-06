import Product from '../models/Product.js';
import Transaction from '../models/Transaction.js';
import asyncHandler from '../utils/asyncHandler.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const round2 = (n) => Math.round(n * 100) / 100;

const dayKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// @route  GET /api/reports/inventory?days=30&deadDays=90
// @access Private
//
// Everything here is derived from data the app already has: current
// product quantities and the transaction history.
//
// - valueOverTime is reconstructed by starting from today's stock and
//   undoing each day's transactions going backwards. It's valued at
//   CURRENT prices (the app doesn't store price history), and stock
//   created without a transaction (e.g. a product's initial quantity)
//   can't be reconstructed, so treat older points as an estimate.
// - turnoverRate = units sold (STOCK_OUT) in the period / average units on
//   hand across the period.
// - dead stock = products with stock on hand that haven't had a STOCK_OUT
//   in `deadDays` days (and are older than that themselves).
export const getInventoryReport = asyncHandler(async (req, res) => {
  const days = clamp(parseInt(req.query.days, 10) || 30, 7, 365);
  const deadDays = clamp(parseInt(req.query.deadDays, 10) || 90, 7, 730);

  const now = new Date();
  const rangeStart = new Date(now);
  rangeStart.setDate(rangeStart.getDate() - (days - 1));
  rangeStart.setHours(0, 0, 0, 0);

  const [products, transactions, lastOutRows] = await Promise.all([
    Product.find().select('name sku quantity price createdAt').lean(),
    Transaction.find({ createdAt: { $gte: rangeStart }, type: { $in: ['STOCK_IN', 'STOCK_OUT'] } })
      .select('product type quantity createdAt')
      .lean(),
    Transaction.aggregate([
      { $match: { type: 'STOCK_OUT' } },
      { $group: { _id: '$product', last: { $max: '$createdAt' } } },
    ]),
  ]);

  const qty = new Map(products.map((p) => [String(p._id), p.quantity]));
  const price = new Map(products.map((p) => [String(p._id), p.price]));

  // ---- Inventory value over time (walk backwards from today) ----
  const txByDay = new Map();
  transactions.forEach((t) => {
    const key = dayKey(t.createdAt);
    if (!txByDay.has(key)) txByDay.set(key, []);
    txByDay.get(key).push(t);
  });

  let value = products.reduce((sum, p) => sum + p.quantity * p.price, 0);
  let units = products.reduce((sum, p) => sum + p.quantity, 0);
  const series = [];

  for (let i = 0; i < days; i += 1) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    const key = dayKey(day);
    series.push({ date: key, value: round2(value), units });

    // Undo this day's movements to get the previous day's closing state.
    (txByDay.get(key) || []).forEach((t) => {
      const id = String(t.product);
      if (!qty.has(id)) return; // product since deleted — not part of current inventory
      const delta = t.type === 'STOCK_IN' ? -t.quantity : t.quantity;
      const before = qty.get(id);
      const after = Math.max(0, before + delta);
      qty.set(id, after);
      value += (after - before) * price.get(id);
      units += after - before;
    });
  }
  series.reverse();

  // ---- Movement totals & turnover ----
  const unitsIn = transactions.filter((t) => t.type === 'STOCK_IN').reduce((s, t) => s + t.quantity, 0);
  const unitsOut = transactions.filter((t) => t.type === 'STOCK_OUT').reduce((s, t) => s + t.quantity, 0);
  const averageUnits = (series[0].units + series[series.length - 1].units) / 2;
  const turnoverRate = averageUnits > 0 ? round2(unitsOut / averageUnits) : 0;

  // ---- Top moving products (by units out in the period) ----
  const outByProduct = new Map();
  transactions
    .filter((t) => t.type === 'STOCK_OUT')
    .forEach((t) => {
      const id = String(t.product);
      outByProduct.set(id, (outByProduct.get(id) || 0) + t.quantity);
    });
  const topIds = [...outByProduct.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topProducts = await Product.find({ _id: { $in: topIds.map(([id]) => id) } })
    .setOptions({ includeDeleted: true })
    .select('name sku price')
    .lean();
  const topById = new Map(topProducts.map((p) => [String(p._id), p]));
  const topMovers = topIds.map(([id, unitsSold]) => {
    const p = topById.get(id);
    return {
      productId: id,
      name: p?.name || 'Unknown product',
      sku: p?.sku || '',
      unitsOut: unitsSold,
      value: round2(unitsSold * (p?.price || 0)),
    };
  });

  // ---- Dead stock ----
  const cutoff = new Date(now.getTime() - deadDays * DAY_MS);
  const lastOut = new Map(lastOutRows.map((r) => [String(r._id), r.last]));
  const deadAll = products
    .filter((p) => {
      if (p.quantity <= 0 || new Date(p.createdAt) >= cutoff) return false;
      const last = lastOut.get(String(p._id));
      return !last || new Date(last) < cutoff;
    })
    .map((p) => {
      const last = lastOut.get(String(p._id)) || null;
      return {
        productId: p._id,
        name: p.name,
        sku: p.sku,
        quantity: p.quantity,
        value: round2(p.quantity * p.price),
        lastSoldAt: last,
        daysSinceSold: last ? Math.floor((now - new Date(last)) / DAY_MS) : null,
      };
    })
    .sort((a, b) => b.value - a.value);

  res.json({
    success: true,
    data: {
      range: { days, deadDays, from: rangeStart, to: now },
      kpis: {
        currentValue: series[series.length - 1].value,
        currentUnits: series[series.length - 1].units,
        valueChange: round2(series[series.length - 1].value - series[0].value),
        unitsIn,
        unitsOut,
        turnoverRate,
        deadStockCount: deadAll.length,
        deadStockValue: round2(deadAll.reduce((s, p) => s + p.value, 0)),
      },
      valueOverTime: series,
      topMovers,
      deadStock: deadAll.slice(0, 25),
    },
  });
});
