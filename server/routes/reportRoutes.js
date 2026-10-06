import express from 'express';
import { getInventoryReport } from '../controllers/reportController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/inventory', protect, getInventoryReport);

export default router;
