import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
    },
    // Cost per unit paid to the supplier (optional; used for the PO total).
    unitCost: {
      type: Number,
      min: [0, 'Unit cost cannot be negative'],
      default: 0,
    },
  },
  { _id: false }
);

const purchaseOrderSchema = new mongoose.Schema(
  {
    poNumber: {
      type: String,
      required: true,
      unique: true,
    },
    supplier: {
      type: String,
      required: [true, 'Supplier is required'],
      trim: true,
    },
    // Draft -> Ordered -> Received, or Cancelled from Draft/Ordered.
    status: {
      type: String,
      enum: ['Draft', 'Ordered', 'Received', 'Cancelled'],
      default: 'Draft',
    },
    items: {
      type: [itemSchema],
      validate: [(items) => items.length > 0, 'A purchase order needs at least one item'],
    },
    notes: { type: String, trim: true, default: '' },
    expectedDate: { type: Date, default: null },
    // Where received stock should be put away (optional).
    location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    orderedAt: { type: Date, default: null },
    receivedAt: { type: Date, default: null },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

const PurchaseOrder = mongoose.model('PurchaseOrder', purchaseOrderSchema);

export default PurchaseOrder;
