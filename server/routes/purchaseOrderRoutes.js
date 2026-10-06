import express from 'express';
import {
  getPurchaseOrders,
  getReorderSuggestions,
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrder,
  markOrdered,
  cancelPurchaseOrder,
  receivePurchaseOrder,
  deletePurchaseOrder,
} from '../controllers/purchaseOrderController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

// Fixed paths before '/:id'. Receiving is open to staff too (they're the
// ones physically checking deliveries in); everything that creates or
// changes the order itself is admin-only.
router.get('/', getPurchaseOrders);
router.get('/reorder-suggestions', getReorderSuggestions);
router.post('/', authorize('admin'), createPurchaseOrder);
router.get('/:id', getPurchaseOrderById);
router.put('/:id', authorize('admin'), updatePurchaseOrder);
router.post('/:id/order', authorize('admin'), markOrdered);
router.post('/:id/cancel', authorize('admin'), cancelPurchaseOrder);
router.post('/:id/receive', receivePurchaseOrder);
router.delete('/:id', authorize('admin'), deletePurchaseOrder);

export default router;
