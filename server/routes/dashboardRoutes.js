import express from 'express';
import { getDashboardStats, sendLowStockAlertNow } from '../controllers/dashboardController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/stats', protect, getDashboardStats);
router.post('/low-stock-alert/send', protect, authorize('admin'), sendLowStockAlertNow);

export default router;
