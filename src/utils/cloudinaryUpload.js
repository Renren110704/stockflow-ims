// Shared browser-side Cloudinary upload, used for profile pictures and
// product images. The signature comes from our server (which holds the API
// secret); the file itself goes straight from the browser to Cloudinary.

export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';

// Returns an error message if the file can't be used, otherwise ''.
export function validateImageFile(file, maxBytes) {
  if (!IMAGE_ACCEPT.split(',').includes(file.type)) {
    return 'Please choose a JPG, PNG or WebP image.';
  }
  if (file.size > maxBytes) {
    return `Image is too large. Maximum size is ${Math.round(maxBytes / (1024 * 1024))} MB.`;
  }
  return '';
}

// `sig` is the object returned by our server's signature endpoints:
// { cloudName, apiKey, params, signature }. Resolves with the image's
// https URL.
//
// Uses plain fetch on purpose — our axios instance would attach the app's
// login token and API base URL to a request that goes to Cloudinary.
export async function uploadToCloudinary(sig, file) {
  const body = new FormData();
  body.append('file', file);
  body.append('api_key', sig.apiKey);
  body.append('signature', sig.signature);
  Object.entries(sig.params).forEach(([key, value]) => body.append(key, value));

  const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, {
    method: 'POST',
    body,
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok || !result.secure_url) {
    throw new Error(result.error?.message || 'Upload failed. Please try again.');
  }
  return result.secure_url;
}
