import express from 'express';
import {
  createTransaction,
  transferStock,
  getTransactions,
  getTransactionById,
} from '../controllers/transactionController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// No role restriction here: both admin and staff can view transaction
// history and record stock movements, per the role spec's "perform
// permitted inventory operations" / "view inventory transactions" for staff.
router.use(protect);

router.get('/', getTransactions);
router.post('/transfer', transferStock);
router.get('/:id', getTransactionById);
router.post('/', createTransaction);

export default router;
