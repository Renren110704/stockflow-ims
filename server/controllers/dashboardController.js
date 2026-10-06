import Product from '../models/Product.js';
import Transaction from '../models/Transaction.js';
import asyncHandler from '../utils/asyncHandler.js';
import { runLowStockAlertCheck } from '../services/lowStockAlertService.js';

// @route  GET /api/dashboard/stats
// @access Private (both admin and staff can view the dashboard)
export const getDashboardStats = asyncHandler(async (req, res) => {
  const [totalProducts, totals, lowStockProducts, lowStockCount, outOfStockCount, recentTransactions, categoryBreakdown] =
    await Promise.all([
      Product.countDocuments(),

      // Single aggregation for both sums, rather than two separate queries.
      Product.aggregate([
        {
          $group: {
            _id: null,
            totalQuantity: { $sum: '$quantity' },
            totalValue: { $sum: { $multiply: ['$price', '$quantity'] } },
          },
        },
      ]),

      Product.find({ status: 'Low Stock' })
        .select('name sku quantity minimumStockLevel status')
        .sort({ quantity: 1 })
        .limit(10),

      // Separate count query: lowStockProducts above is capped at 10 for
      // display, so its .length can't be reused as the true total count.
      Product.countDocuments({ status: 'Low Stock' }),

      Product.countDocuments({ status: 'Out of Stock' }),

      Transaction.find()
        .populate({ path: 'product', select: 'name sku', options: { includeDeleted: true } })
        .populate('performedBy', 'name')
        .sort({ createdAt: -1 })
        .limit(10),

      // Powers the dashboard's inventory-distribution chart: total
      // quantity held per category.
      Product.aggregate([
        {
          $group: {
            _id: '$category',
            quantity: { $sum: '$quantity' },
          },
        },
        {
          $lookup: {
            from: 'categories',
            localField: '_id',
            foreignField: '_id',
            as: 'category',
          },
        },
        { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            name: { $ifNull: ['$category.name', 'Uncategorized'] },
            quantity: 1,
          },
        },
        { $sort: { quantity: -1 } },
      ]),
    ]);

  res.json({
    success: true,
    data: {
      totalProducts,
      totalInventoryQuantity: totals[0]?.totalQuantity || 0,
      totalInventoryValue: totals[0]?.totalValue || 0,
      lowStockCount,
      outOfStockCount,
      lowStockProducts,
      recentTransactions,
      categoryBreakdown,
    },
  });
});

// @route  POST /api/dashboard/low-stock-alert/send
// @access Private/Admin
// Fires the same low-stock digest email the cron job sends, on demand —
// lets an admin verify SMTP setup or notify the team immediately
// instead of waiting for the schedule.
export const sendLowStockAlertNow = asyncHandler(async (req, res) => {
  const result = await runLowStockAlertCheck();
  res.json({ success: true, message: result.sent ? 'Alert email sent' : (result.reason || 'No alert sent'), data: result });
});
