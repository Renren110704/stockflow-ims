import mongoose from 'mongoose';
import softDelete from '../utils/softDelete.js';

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

// Soft delete, with name uniqueness scoped to (name, deletedAt) so a
// deleted category's name can be reused. See utils/softDelete.js.
categorySchema.plugin(softDelete);
categorySchema.index({ name: 1, deletedAt: 1 }, { unique: true });

const Category = mongoose.model('Category', categorySchema);

export default Category;
