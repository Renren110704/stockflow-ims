import productService from '../services/productService';
import { IMAGE_ACCEPT, validateImageFile, uploadToCloudinary } from './cloudinaryUpload';

export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const PRODUCT_IMAGE_ACCEPT = IMAGE_ACCEPT;

// Returns an error message if the file can't be used, otherwise ''.
export function validateProductImageFile(file) {
  return validateImageFile(file, PRODUCT_IMAGE_MAX_BYTES);
}

// Uploads a product image to Cloudinary and resolves with its URL. The
// caller stores that URL in the product's imageUrl field when saving.
export async function uploadProductImage(file) {
  const { data: sig } = await productService.getProductImageSignature();
  return uploadToCloudinary(sig, file);
}
