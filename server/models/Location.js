import mongoose from 'mongoose';
import softDelete from '../utils/softDelete.js';

const locationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Location name is required'],
      trim: true,
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

locationSchema.plugin(softDelete);
locationSchema.index({ name: 1, deletedAt: 1 }, { unique: true });

const Location = mongoose.model('Location', locationSchema);

export default Location;
