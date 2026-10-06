import mongoose from 'mongoose';
import softDelete from '../utils/softDelete.js';

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
    },
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      trim: true,
      uppercase: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    quantity: {
      type: Number,
      required: true,
      min: [0, 'Quantity cannot be negative'],
      default: 0,
    },
    minimumStockLevel: {
      type: Number,
      required: true,
      min: [0, 'Minimum stock level cannot be negative'],
      default: 0,
    },
    supplier: {
      type: String,
      trim: true,
      default: '',
    },
    imageUrl: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['In Stock', 'Low Stock', 'Out of Stock', 'Discontinued'],
      default: 'In Stock',
    },
  },
  { timestamps: true }
);

// Soft delete: deleted products stay in the database (so historical
// transactions still resolve to a real name) but disappear from every
// normal query. SKU uniqueness is scoped to (sku, deletedAt) rather than
// sku alone, so an active SKU is still unique but a deleted product's SKU
// can be reused by a new one.
productSchema.plugin(softDelete);
productSchema.index({ sku: 1, deletedAt: 1 }, { unique: true });
// Stock status is derived from quantity vs. minimumStockLevel on every
// save, so it can never drift out of sync with the actual numbers.
// The one exception is 'Discontinued', which is a deliberate manual
// state set by an admin (a product can be discontinued regardless of
// how much stock remains) and is left alone here rather than overwritten.
productSchema.pre('save', function deriveStatus(next) {
  if (this.status !== 'Discontinued') {
    if (this.quantity <= 0) {
      this.status = 'Out of Stock';
    } else if (this.quantity <= this.minimumStockLevel) {
      this.status = 'Low Stock';
    } else {
      this.status = 'In Stock';
    }
  }
  next();
});

const Product = mongoose.model('Product', productSchema);

export default Product;
