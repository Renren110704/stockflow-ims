import express from 'express';
import {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  restoreCategory,
  permanentlyDeleteCategory,
} from '../controllers/categoryController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/', getCategories); // ?archived=true (admin) lists archived categories
router.get('/:id', getCategoryById);
router.post('/', authorize('admin'), createCategory);
router.put('/:id', authorize('admin'), updateCategory);
// DELETE /:id archives; /permanent erases an already-archived category.
router.delete('/:id', authorize('admin'), deleteCategory);
router.post('/:id/restore', authorize('admin'), restoreCategory);
router.delete('/:id/permanent', authorize('admin'), permanentlyDeleteCategory);

export default router;
