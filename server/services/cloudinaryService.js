// Cloudinary helpers for profile pictures.
//
// Uploads are "signed direct uploads": the browser sends the image straight
// to Cloudinary, and this server only signs the request (so the API secret
// never leaves the server). No Cloudinary SDK or multer needed — signing is
// just a SHA-1 hash from Node's built-in crypto.
//
// Each user has exactly ONE avatar at a fixed public id
// (stockflow/avatars/<userId>); uploading again overwrites it, so old
// pictures never pile up in your Cloudinary storage.

import crypto from 'crypto';

const AVATAR_FOLDER = 'stockflow/avatars';
const ALLOWED_FORMATS = 'jpg,png,webp';
// Cloudinary crops/resizes on upload: 400x400 square, centered on a face
// when one is found. Keeps files tiny and avatars consistent.
const AVATAR_TRANSFORMATION = 'c_fill,g_face,h_400,w_400';

function getConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

export function isCloudinaryConfigured() {
  return getConfig() !== null;
}

// Cloudinary's signature: sort the params alphabetically, join as
// key=value&key=value, append the API secret, SHA-1 it.
function sign(params, apiSecret) {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return crypto.createHash('sha1').update(toSign + apiSecret).digest('hex');
}

function avatarPublicId(userId) {
  return `${AVATAR_FOLDER}/${userId}`;
}

// Everything the browser needs to upload one avatar for this user. The
// browser must send `params` exactly as given (plus file, api_key and
// signature) or Cloudinary rejects the signature.
export function createAvatarUploadSignature(userId) {
  const { cloudName, apiKey, apiSecret } = getConfig();
  const params = {
    allowed_formats: ALLOWED_FORMATS,
    invalidate: 'true',
    overwrite: 'true',
    public_id: avatarPublicId(userId),
    timestamp: String(Math.round(Date.now() / 1000)),
    transformation: AVATAR_TRANSFORMATION,
  };
  return { cloudName, apiKey, params, signature: sign(params, apiSecret) };
}

// The client tells us the URL Cloudinary gave back. Never trust it blindly:
// it must be an https://res.cloudinary.com URL on OUR cloud, pointing at
// THIS user's avatar, so nobody can save an arbitrary link (or someone
// else's picture) as their avatar.
export function isValidAvatarUrl(url, userId) {
  const config = getConfig();
  if (!config || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname === 'res.cloudinary.com' &&
      parsed.pathname.startsWith(`/${config.cloudName}/image/upload/`) &&
      parsed.pathname.includes(`/${avatarPublicId(userId)}.`)
    );
  } catch {
    return false;
  }
}

// Best-effort delete of an image from Cloudinary by public id. Never
// throws — if Cloudinary is unreachable the caller carries on regardless.
async function destroyImage(publicId) {
  const config = getConfig();
  if (!config) return;
  const params = {
    invalidate: 'true',
    public_id: publicId,
    timestamp: String(Math.round(Date.now() / 1000)),
  };
  const body = new URLSearchParams({
    ...params,
    api_key: config.apiKey,
    signature: sign(params, config.apiSecret),
  });
  try {
    await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/destroy`, {
      method: 'POST',
      body,
    });
  } catch {
    // ignore
  }
}

// Best-effort delete of the user's avatar from Cloudinary.
export async function deleteAvatar(userId) {
  await destroyImage(avatarPublicId(userId));
}

// ── Product images ────────────────────────────────────────────────────
// Unlike avatars (one fixed slot per user), a product image is uploaded
// BEFORE the product exists (Add Product form), so each upload gets a
// random public id instead. Images are capped at 1000px on the longest
// side (never cropped) to keep files small.
const PRODUCT_FOLDER = 'stockflow/products';
const PRODUCT_TRANSFORMATION = 'c_limit,h_1000,w_1000';

export function createProductImageUploadSignature() {
  const { cloudName, apiKey, apiSecret } = getConfig();
  const params = {
    allowed_formats: ALLOWED_FORMATS,
    public_id: `${PRODUCT_FOLDER}/${crypto.randomUUID()}`,
    timestamp: String(Math.round(Date.now() / 1000)),
    transformation: PRODUCT_TRANSFORMATION,
  };
  return { cloudName, apiKey, params, signature: sign(params, apiSecret) };
}

// If `url` is one of OUR uploaded product images, returns its Cloudinary
// public id; otherwise null (e.g. an external link typed in earlier or
// imported from a CSV). This guard means we only ever delete images this
// app uploaded itself.
function productPublicIdFromUrl(url) {
  const config = getConfig();
  if (!config || typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    const prefix = `/${config.cloudName}/image/upload/`;
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'res.cloudinary.com') return null;
    if (!parsed.pathname.startsWith(prefix)) return null;
    const match = parsed.pathname
      .slice(prefix.length)
      .match(/^(?:v\d+\/)?(stockflow\/products\/[A-Za-z0-9-]+)\.[A-Za-z0-9]+$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// Deletes a product image from Cloudinary if (and only if) it was uploaded
// by this app. No-op for any other URL.
export async function deleteProductImage(url) {
  const publicId = productPublicIdFromUrl(url);
  if (publicId) await destroyImage(publicId);
}
