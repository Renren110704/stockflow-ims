import mongoose from 'mongoose';

// How many units of a product are held at a specific location.
//
// Product.quantity remains the authoritative TOTAL for the product (so the
// dashboard, low-stock alerts and reports keep working unchanged). Stock
// levels describe how that total is distributed; whatever isn't allocated
// to any location is "unassigned" (total minus the sum of these rows).
const stockLevelSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [0, 'Stock at a location cannot be negative'],
      default: 0,
    },
  },
  { timestamps: true }
);

stockLevelSchema.index({ product: 1, location: 1 }, { unique: true });

const StockLevel = mongoose.model('StockLevel', stockLevelSchema);

export default StockLevel;
