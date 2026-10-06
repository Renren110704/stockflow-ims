import authService from '../services/authService';
import { IMAGE_ACCEPT, validateImageFile, uploadToCloudinary } from './cloudinaryUpload';

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
export const AVATAR_ACCEPT = IMAGE_ACCEPT;

// Returns an error message if the file can't be used, otherwise ''.
export function validateAvatarFile(file) {
  return validateImageFile(file, AVATAR_MAX_BYTES);
}

// Uploads the file to Cloudinary (using a signature from our server) and
// saves the resulting URL on the user. Resolves with the updated user.
export async function uploadAvatar(file) {
  const { data: sig } = await authService.getAvatarUploadSignature();
  const url = await uploadToCloudinary(sig, file);
  const saved = await authService.updateAvatar(url);
  return saved.data;
}
