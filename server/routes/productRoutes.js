import express from 'express';
import {
  createProduct,
  getProducts,
  getProductById,
  getProductBySku,
  getProductStock,
  updateProduct,
  deleteProduct,
  restoreProduct,
  permanentlyDeleteProduct,
  bulkArchiveProducts,
  bulkReassignCategory,
  bulkImportProducts,
  getProductImageSignature,
} from '../controllers/productController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

// Fixed-path routes are registered before '/:id' so 'bulk-delete', 'sku/...'
// etc. can never be mistaken for an id param.
// 'bulk-delete' is kept as an alias of 'bulk-archive' so older clients keep working.
router.post('/bulk-archive', authorize('admin'), bulkArchiveProducts);
router.post('/bulk-delete', authorize('admin'), bulkArchiveProducts);
router.post('/bulk-reassign-category', authorize('admin'), bulkReassignCategory);
router.post('/bulk-import', authorize('admin'), bulkImportProducts);
router.post('/image/signature', authorize('admin'), getProductImageSignature);
router.get('/sku/:sku', getProductBySku);

router.get('/', getProducts);
router.get('/:id/stock', getProductStock);
router.get('/:id', getProductById);
router.post('/', authorize('admin'), createProduct);
router.put('/:id', authorize('admin'), updateProduct);
// DELETE /:id archives; /permanent erases an already-archived product.
router.delete('/:id', authorize('admin'), deleteProduct);
router.post('/:id/restore', authorize('admin'), restoreProduct);
router.delete('/:id/permanent', authorize('admin'), permanentlyDeleteProduct);

export default router;
