import express from 'express';
import {
  getLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  restoreLocation,
  permanentlyDeleteLocation,
} from '../controllers/locationController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/', getLocations); // ?archived=true (admin) lists archived locations
router.post('/', authorize('admin'), createLocation);
router.put('/:id', authorize('admin'), updateLocation);
// DELETE /:id archives; /permanent erases an already-archived location.
router.delete('/:id', authorize('admin'), deleteLocation);
router.post('/:id/restore', authorize('admin'), restoreLocation);
router.delete('/:id/permanent', authorize('admin'), permanentlyDeleteLocation);

export default router;
