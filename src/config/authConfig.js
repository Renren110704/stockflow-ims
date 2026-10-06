// ─────────────────────────────────────────────────────────────────────────
// Login / Register page configuration.
//
// TO CHANGE THE RIGHT-HAND IMAGE:
//   1. Put your image (svg / png / jpg / webp) in  src/assets/auth/
//   2. Change the import below to point at it, e.g.
//        import authIllustration from '../assets/auth/my-image.png';
//   That's all — the layout sizes it automatically.
//
// AUTH_ILLUSTRATION_FIT controls how a replacement image fills its frame:
//   'contain' – whole image always visible, never cropped (default; best
//               for illustrations / UI mock-ups on the dark panel)
//   'cover'   – fills the frame edge to edge, cropping if the aspect
//               ratio differs (best for photos)
// ─────────────────────────────────────────────────────────────────────────
import authIllustration from '../assets/auth/auth-illustration.svg';

export const AUTH_ILLUSTRATION = authIllustration;
export const AUTH_ILLUSTRATION_ALT = 'Inventory analytics preview';
export const AUTH_ILLUSTRATION_FIT = 'contain'; // 'contain' | 'cover'

// Text shown under the illustration on the right-hand panel.
export const AUTH_HEADLINE = 'Very simple way you can engage';
export const AUTH_DESCRIPTION =
  'Welcome to StockFlow Inventory Management System! Efficiently track and manage your inventory with ease.';

export const AUTH_BRAND_NAME = 'StockFlow';

// Google button under the form. Set to false to hide the whole "Or"
// section. Google sign-in only works once VITE_GOOGLE_CLIENT_ID is set
// (see .env.example); until then the button shows a setup notice.
export const AUTH_SHOW_SOCIAL_LOGIN = true;
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

// Register page: show the "I agree to all the Terms & Conditions" checkbox
// from the reference design and require it before submitting. Set to false
// to remove the checkbox and the requirement entirely.
export const AUTH_REQUIRE_TERMS = true;
