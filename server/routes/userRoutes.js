import express from 'express';
import {
  getUsers,
  getUserById,
  updateUser,
  archiveUser,
  restoreUser,
  permanentlyDeleteUser,
} from '../controllers/userController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// All user routes require a logged-in user; listing is admin-only,
// while individual read/update also permit acting on your own record
// (enforced inside the controller, since it depends on comparing :id to req.user).
router.use(protect);

router.get('/', authorize('admin'), getUsers); // ?archived=true for archived users
router.get('/:id', getUserById);
router.put('/:id', updateUser);
// DELETE /:id archives (deactivates); /permanent erases an already-archived user.
router.delete('/:id', authorize('admin'), archiveUser);
router.post('/:id/restore', authorize('admin'), restoreUser);
router.delete('/:id/permanent', authorize('admin'), permanentlyDeleteUser);

export default router;
