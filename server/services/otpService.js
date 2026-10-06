import crypto from 'crypto';
import { sendEmail } from './emailService.js';

// ── Tunable settings ────────────────────────────────────────────────
export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 10 * 60 * 1000; // a code is valid for 10 minutes
export const OTP_MAX_ATTEMPTS = 5; // wrong guesses allowed per code
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // min gap between emails
export const PENDING_TTL_MS = 60 * 60 * 1000; // abandoned sign-ups are purged after 1h

// Cryptographically secure 6-digit code (leading zeros preserved).
export function generateOtp() {
  return crypto.randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, '0');
}

// HMAC (keyed with JWT_SECRET) bound to the email, so a code issued for one
// address can't be replayed against another and the DB never holds raw codes.
export function hashOtp(email, otp) {
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(`${email}:${otp}`)
    .digest('hex');
}

export function otpMatches(email, otp, storedHash) {
  const a = Buffer.from(hashOtp(email, otp), 'hex');
  const b = Buffer.from(String(storedHash), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c]);
}

// Wording for each kind of code we send.
const COPY = {
  signup: {
    heading: 'Verify your email',
    intro: (brand) => `use the code below to finish creating your ${brand} account.`,
    ignore: "If you didn't try to sign up, you can safely ignore this email.",
    subject: (otp, brand) => `${otp} is your ${brand} verification code`,
    textIntro: (brand) => `your ${brand} verification code is`,
  },
  reset: {
    heading: 'Reset your password',
    intro: (brand) => `use the code below to reset your ${brand} password.`,
    ignore:
      "If you didn't request a password reset, you can safely ignore this email - your password won't change.",
    subject: (otp, brand) => `${otp} is your ${brand} password reset code`,
    textIntro: (brand) => `your ${brand} password reset code is`,
  },
  // Email change: one code goes to the CURRENT address (proves the account
  // owner approves) and a different one to the NEW address (proves it's theirs).
  emailChangeCurrent: {
    heading: 'Confirm your email change',
    intro: (brand) =>
      `use the code below to approve changing the email address on your ${brand} account.`,
    ignore:
      "If you didn't request this, your email won't change unless the code is used. Consider changing your password.",
    subject: (otp, brand) => `${otp} is your ${brand} email change code`,
    textIntro: (brand) => `your ${brand} email change approval code is`,
  },
  emailChangeNew: {
    heading: 'Verify your new email',
    intro: (brand) => `use the code below to confirm this address for your ${brand} account.`,
    ignore: "If you didn't request this, you can safely ignore this email.",
    subject: (otp, brand) => `${otp} is your ${brand} new email verification code`,
    textIntro: (brand) => `your ${brand} new email verification code is`,
  },
};

// Sends a one-time code through Brevo (see emailService.js).
// purpose: 'signup' | 'reset' | 'emailChangeCurrent' | 'emailChangeNew'.
// note: optional extra sentence shown under the intro (HTML-escaped).
// Returns { sent: boolean } like sendEmail; throws if Brevo rejects the request.
export async function sendOtpEmail({ to, name, otp, purpose = 'signup', note = '' }) {
  const copy = COPY[purpose] || COPY.signup;
  const brand = process.env.BREVO_SENDER_NAME || 'StockFlow';
  const minutes = Math.round(OTP_TTL_MS / 60000);
  const safeName = escapeHtml(name || 'there');
  const safeBrand = escapeHtml(brand);

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1f2937;">
    <h2 style="margin:0 0 16px;font-size:20px;">${copy.heading}</h2>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">
      Hi ${safeName}, ${copy.intro(safeBrand)}
    </p>
    ${note ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;">${escapeHtml(note)}</p>` : ''}
    <div style="margin:24px 0;padding:16px;text-align:center;background:#f3f4f6;border-radius:10px;
                font-size:32px;font-weight:700;letter-spacing:8px;">
      ${otp}
    </div>
    <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">
      This code expires in ${minutes} minutes. Never share it with anyone.
    </p>
    <p style="margin:0;font-size:13px;color:#6b7280;">
      ${copy.ignore}
    </p>
  </div>`;

  const text =
    `Hi ${name || 'there'}, ${copy.textIntro(brand)} ${otp}. ` +
    `${note ? `${note} ` : ''}` +
    `It expires in ${minutes} minutes. ${copy.ignore}`;

  return sendEmail({
    to,
    subject: copy.subject(otp, brand),
    html,
    text,
  });
}
