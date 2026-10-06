import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    type: {
      type: String,
      enum: ['STOCK_IN', 'STOCK_OUT', 'TRANSFER'],
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
    },
    // Used for STOCK_OUT (why stock left, e.g. "Sold", "Damaged", "Returned to supplier").
    reason: {
      type: String,
      trim: true,
      default: '',
    },
    // Used for STOCK_IN (where the stock came from).
    supplier: {
      type: String,
      trim: true,
      default: '',
    },
    referenceNumber: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Where a STOCK_IN / STOCK_OUT happened (null = not tied to a location).
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      default: null,
    },
    // For TRANSFER only. null on either side means "unassigned stock".
    fromLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      default: null,
    },
    toLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      default: null,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;
