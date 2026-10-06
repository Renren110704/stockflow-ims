import mongoose from 'mongoose';

// Used for both create and update; `isUpdate` relaxes "required" checks
// since a PUT request may only send the fields that changed.
export function validateProductInput(data, { isUpdate = false } = {}) {
  const errors = [];
  const { name, sku, category, price, quantity, minimumStockLevel } = data;

  if (!isUpdate || name !== undefined) {
    if (!name || !name.trim()) errors.push('Product name is required');
  }

  if (!isUpdate || sku !== undefined) {
    if (!sku || !sku.trim()) errors.push('SKU is required');
  }

  if (!isUpdate || category !== undefined) {
    if (!category) errors.push('Category is required');
    else if (!mongoose.Types.ObjectId.isValid(category)) errors.push('Category is not a valid id');
  }

  if (!isUpdate || price !== undefined) {
    if (price === undefined || price === null || price === '') errors.push('Price is required');
    else if (Number.isNaN(Number(price)) || Number(price) < 0) errors.push('Price must be a non-negative number');
  }

  if (quantity !== undefined) {
    if (Number.isNaN(Number(quantity)) || Number(quantity) < 0) errors.push('Quantity must be a non-negative number');
  }

  if (minimumStockLevel !== undefined) {
    if (Number.isNaN(Number(minimumStockLevel)) || Number(minimumStockLevel) < 0) {
      errors.push('Minimum stock level must be a non-negative number');
    }
  }

  return errors;
}
