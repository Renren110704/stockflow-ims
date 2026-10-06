import mongoose from 'mongoose';

export function validateTransactionInput({ product, type, quantity }) {
  const errors = [];

  if (!product) errors.push('Product is required');
  else if (!mongoose.Types.ObjectId.isValid(product)) errors.push('Product is not a valid id');

  if (!type || !['STOCK_IN', 'STOCK_OUT'].includes(type)) {
    errors.push('Type must be STOCK_IN or STOCK_OUT');
  }

  if (quantity === undefined || quantity === null || quantity === '') {
    errors.push('Quantity is required');
  } else if (!Number.isInteger(Number(quantity)) || Number(quantity) <= 0) {
    errors.push('Quantity must be a positive whole number');
  }

  return errors;
}
