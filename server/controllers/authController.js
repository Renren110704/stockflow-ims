import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import PendingRegistration from '../models/PendingRegistration.js';
import PasswordReset from '../models/PasswordReset.js';
import EmailChange from '../models/EmailChange.js';
import generateToken from '../utils/generateToken.js';
import asyncHandler from '../utils/asyncHandler.js';
import {
  validateRegisterInput,
  validateLoginInput,
  validateOtpInput,
  validateResendInput,
  validateResetInput,
  getPasswordError,
} from '../validators/authValidators.js';
import {
  OTP_TTL_MS,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  PENDING_TTL_MS,
  generateOtp,
  hashOtp,
  otpMatches,
  sendOtpEmail,
} from '../services/otpService.js';
import { verifyGoogleAccessToken } from '../services/googleAuthService.js';
import {
  isCloudinaryConfigured,
  createAvatarUploadSignature,
  isValidAvatarUrl,
  deleteAvatar,
} from '../services/cloudinaryService.js';

// Strips fields that should never go back to the client, even though
// the schema already excludes password via `select: false` on find queries.
function toPublicUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar || '',
    createdAt: user.createdAt,
  };
}

// Emails the OTP through Brevo. Returns true if it was delivered.
// In development, when Brevo isn't configured, the code is printed to the
// server console instead so sign-up can still be tested end to end.
async function deliverOtp({ email, name, otp, purpose = 'signup', note = '' }) {
  try {
    const result = await sendOtpEmail({ to: email, name, otp, purpose, note });
    if (result.sent) return true;
    if (process.env.NODE_ENV === 'production') return false;
    console.log(
      `[otp] DEV ONLY - Brevo not configured. ${purpose} code for ${email}: ${otp}`
    );
    return true;
  } catch (err) {
    console.error('[otp] Failed to send email:', err.message);
    return false;
  }
}

const EMAIL_SEND_FAILED =
  'We could not send the verification email. Please check your email address and try again shortly.';
const PENDING_MISSING = 'Verification expired. Please sign up again.';

// @route  POST /api/auth/register
// @access Public
// Step 1 of sign-up. Validates the form, stores a *pending* registration and
// emails a 6-digit code. No User is created until /verify-otp succeeds.
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, confirmPassword } = req.body;

  const errors = validateRegisterInput({ name, email, password, confirmPassword });
  if (errors.length > 0) {
    return res.status(422).json({ success: false, message: errors[0], errors });
  }

  const normalizedEmail = email.toLowerCase().trim();

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    return res.status(409).json({ success: false, message: 'Email is already registered' });
  }

  let pending = await PendingRegistration.findOne({ email: normalizedEmail });
  // If a code was emailed very recently, keep it valid instead of sending
  // another one (prevents using this endpoint to spam an inbox).
  const shouldSend =
    !pending || Date.now() - pending.lastSentAt.getTime() >= OTP_RESEND_COOLDOWN_MS;
  if (!pending) pending = new PendingRegistration({ email: normalizedEmail });

  pending.name = name.trim();
  pending.passwordHash = await bcrypt.hash(password, 10);
  pending.expiresAt = new Date(Date.now() + PENDING_TTL_MS);

  let otp = null;
  if (shouldSend) {
    otp = generateOtp();
    pending.otpHash = hashOtp(normalizedEmail, otp);
    pending.otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
    pending.attempts = 0;
    pending.lastSentAt = new Date();
  }
  await pending.save();

  if (otp) {
    const delivered = await deliverOtp({ email: normalizedEmail, name: pending.name, otp });
    if (!delivered) {
      return res.status(503).json({ success: false, message: EMAIL_SEND_FAILED });
    }
  }

  const resendAfterMs = Math.max(
    0,
    OTP_RESEND_COOLDOWN_MS - (Date.now() - pending.lastSentAt.getTime())
  );
  res.status(200).json({
    success: true,
    message: 'Verification code sent. Check your email.',
    data: {
      email: normalizedEmail,
      expiresInSeconds: Math.round(OTP_TTL_MS / 1000),
      resendAfterSeconds: Math.ceil(resendAfterMs / 1000),
    },
  });
});

// @route  POST /api/auth/verify-otp
// @access Public
// Step 2 of sign-up. Body: { email, otp }. On success the real account is
// created (role is always 'staff', never taken from the request).
// Failures use 400/429 (not 401) so the frontend's global 401 handler
// doesn't redirect the user away mid-verification.
export const verifyRegistrationOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  const errors = validateOtpInput({ email, otp });
  if (errors.length > 0) {
    return res.status(422).json({ success: false, message: errors[0], errors });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Count the attempt atomically *before* checking the code, so parallel
  // guesses can't get around the attempt limit.
  const pending = await PendingRegistration.findOneAndUpdate(
    { email: normalizedEmail },
    { $inc: { attempts: 1 } },
    { new: true }
  );
  if (!pending) {
    return res.status(400).json({ success: false, message: PENDING_MISSING });
  }

  if (pending.attempts > OTP_MAX_ATTEMPTS) {
    await pending.deleteOne();
    return res.status(429).json({
      success: false,
      message: 'Too many incorrect attempts. Please sign up again.',
    });
  }

  if (pending.otpExpiresAt.getTime() < Date.now()) {
    return res
      .status(400)
      .json({ success: false, message: 'This code has expired. Request a new one.' });
  }

  if (!otpMatches(normalizedEmail, otp, pending.otpHash)) {
    const remaining = OTP_MAX_ATTEMPTS - pending.attempts;
    return res.status(400).json({
      success: false,
      message:
        remaining > 0
          ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`
          : 'Incorrect code. No attempts left - please sign up again.',
    });
  }

  // Code is correct. Guard against the email having been registered
  // in the meantime (e.g. via Google sign-in).
  if (await User.findOne({ email: normalizedEmail })) {
    await pending.deleteOne();
    return res.status(409).json({ success: false, message: 'Email is already registered' });
  }

  const user = new User({
    name: pending.name,
    email: pending.email,
    password: pending.passwordHash,
    role: 'staff',
  });
  user.$locals.passwordAlreadyHashed = true; // already bcrypt-hashed at /register
  try {
    await user.save();
  } catch (err) {
    if (err.code === 11000) {
      await pending.deleteOne();
      return res.status(409).json({ success: false, message: 'Email is already registered' });
    }
    throw err;
  }

  await pending.deleteOne();

  res.status(201).json({
    success: true,
    message: 'Email verified. Your account is ready.',
    data: toPublicUser(user),
  });
});

// @route  POST /api/auth/resend-otp
// @access Public
// Body: { email }. Issues a fresh code for a pending sign-up, subject to a
// cooldown between emails.
export const resendRegistrationOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const errors = validateResendInput({ email });
  if (errors.length > 0) {
    return res.status(422).json({ success: false, message: errors[0], errors });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const pending = await PendingRegistration.findOne({ email: normalizedEmail });
  if (!pending) {
    return res.status(400).json({ success: false, message: PENDING_MISSING });
  }

  const waitMs = OTP_RESEND_COOLDOWN_MS - (Date.now() - pending.lastSentAt.getTime());
  if (waitMs > 0) {
    const retryAfter = Math.ceil(waitMs / 1000);
    return res.status(429).json({
      success: false,
      message: `Please wait ${retryAfter}s before requesting a new code.`,
      retryAfter,
    });
  }

  const otp = generateOtp();
  pending.otpHash = hashOtp(normalizedEmail, otp);
  pending.otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
  pending.attempts = 0;
  pending.lastSentAt = new Date();
  pending.expiresAt = new Date(Date.now() + PENDING_TTL_MS);
  await pending.save();

  const delivered = await deliverOtp({ email: normalizedEmail, name: pending.name, otp });
  if (!delivered) {
    return res.status(503).json({ success: false, message: EMAIL_SEND_FAILED });
  }

  res.json({
    success: true,
    message: 'A new verification code has been sent.',
    data: { resendAfterSeconds: Math.ceil(OTP_RESEND_COOLDOWN_MS / 1000) },
  });
});

// @route  POST /api/auth/forgot-password
// @access Public
// Body: { email }. Emails a 6-digit reset code if an account exists.
// The response is deliberately identical whether or not the email is
// registered (and whether or not an email was actually sent), so this
// endpoint can't be used to discover who has an account.
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const errors = validateResendInput({ email });
  if (errors.length > 0) {
    return res.status(422).json({ success: false, message: errors[0], errors });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const respond = () =>
    res.json({
      success: true,
      message: 'If an account exists for that email, a reset code has been sent.',
      data: { resendAfterSeconds: Math.ceil(OTP_RESEND_COOLDOWN_MS / 1000) },
    });

  const user = await User.findOne({ email: normalizedEmail });
  if (!user || user.archivedAt) return respond();

  // Within the cooldown, keep the code that was already sent.
  const existing = await PasswordReset.findOne({ email: normalizedEmail });
  if (existing && Date.now() - existing.lastSentAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
    return respond();
  }

  const otp = generateOtp();
  await PasswordReset.findOneAndUpdate(
    { email: normalizedEmail },
    {
      otpHash: hashOtp(normalizedEmail, otp),
      otpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
      attempts: 0,
      lastSentAt: new Date(),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // A delivery failure is logged inside deliverOtp but not reported to the
  // client, to keep the response identical for existing/non-existing emails.
  await deliverOtp({ email: normalizedEmail, name: user.name, otp, purpose: 'reset' });
  respond();
});

// @route  POST /api/auth/reset-password
// @access Public
// Body: { email, otp, newPassword, confirmNewPassword }. Checks the code and
// sets the new password in one step. Every code failure returns the same
// generic message (and 400, not 401) so nothing is revealed about whether
// the account exists.
export const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword, confirmNewPassword } = req.body;

  const errors = validateResetInput({ email, otp, newPassword, confirmNewPassword });
  if (errors.length > 0) {
    return res.status(422).json({ success: false, message: errors[0], errors });
  }

  const BAD_CODE = 'Invalid or expired code. Please request a new one.';
  const normalizedEmail = email.toLowerCase().trim();

  // Count the attempt atomically before checking, so parallel guesses
  // can't get around the attempt limit.
  const record = await PasswordReset.findOneAndUpdate(
    { email: normalizedEmail },
    { $inc: { attempts: 1 } },
    { new: true }
  );
  if (!record) {
    return res.status(400).json({ success: false, message: BAD_CODE });
  }

  if (record.attempts > OTP_MAX_ATTEMPTS) {
    await record.deleteOne();
    return res.status(400).json({ success: false, message: BAD_CODE });
  }
  if (record.otpExpiresAt.getTime() < Date.now()) {
    return res.status(400).json({ success: false, message: BAD_CODE });
  }
  if (!otpMatches(normalizedEmail, otp, record.otpHash)) {
    return res.status(400).json({ success: false, message: BAD_CODE });
  }

  const user = await User.findOne({ email: normalizedEmail }).select('+password');
  if (!user) {
    await record.deleteOne();
    return res.status(400).json({ success: false, message: BAD_CODE });
  }

  user.password = newPassword; // pre-save hook hashes it
  await user.save();
  await record.deleteOne();

  res.json({ success: true, message: 'Password reset successful. You can now log in.' });
});

// Hides most of the local part: jane.doe@gmail.com -> j***@gmail.com
function maskEmail(email) {
  const [local, domain] = email.split('@');
  return `${local[0]}${'*'.repeat(Math.max(local.length - 1, 2))}@${domain}`;
}

// @route  POST /api/auth/email-change/request
// @access Private
// Body: { newEmail }. Emails a code to the CURRENT address and a different
// code to the NEW address. The email only changes once both are confirmed
// via /email-change/confirm. Also used to resend (subject to a cooldown).
export const requestEmailChange = asyncHandler(async (req, res) => {
  const { newEmail } = req.body;

  const errors = validateResendInput({ email: newEmail });
  if (errors.length > 0) {
    return res.status(422).json({ success: false, message: errors[0], errors });
  }

  const normalizedNew = newEmail.toLowerCase().trim();
  const currentEmail = req.user.email;

  if (normalizedNew === currentEmail) {
    return res
      .status(422)
      .json({ success: false, message: 'That is already your email address' });
  }
  if (await User.findOne({ email: normalizedNew })) {
    return res.status(409).json({ success: false, message: 'Email is already in use' });
  }

  const existing = await EmailChange.findOne({ userId: req.user._id });
  if (existing) {
    const waitMs = OTP_RESEND_COOLDOWN_MS - (Date.now() - existing.lastSentAt.getTime());
    if (waitMs > 0) {
      const retryAfter = Math.ceil(waitMs / 1000);
      return res.status(429).json({
        success: false,
        message: `Please wait ${retryAfter}s before requesting new codes.`,
        retryAfter,
      });
    }
  }

  // Two independent codes (never identical, so they can't be swapped).
  const currentOtp = generateOtp();
  let newOtp = generateOtp();
  while (newOtp === currentOtp) newOtp = generateOtp();

  await EmailChange.findOneAndUpdate(
    { userId: req.user._id },
    {
      newEmail: normalizedNew,
      currentOtpHash: hashOtp(`current:${currentEmail}`, currentOtp),
      newOtpHash: hashOtp(`new:${normalizedNew}`, newOtp),
      otpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
      attempts: 0,
      lastSentAt: new Date(),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const [sentToCurrent, sentToNew] = await Promise.all([
    deliverOtp({
      email: currentEmail,
      name: req.user.name,
      otp: currentOtp,
      purpose: 'emailChangeCurrent',
      note: `Requested new email address: ${normalizedNew}.`,
    }),
    deliverOtp({
      email: normalizedNew,
      name: req.user.name,
      otp: newOtp,
      purpose: 'emailChangeNew',
    }),
  ]);
  if (!sentToCurrent || !sentToNew) {
    // Clear the record so the user can retry immediately instead of
    // waiting out the cooldown for emails that never arrived.
    await EmailChange.deleteOne({ userId: req.user._id });
    return res.status(503).json({ success: false, message: EMAIL_SEND_FAILED });
  }

  res.json({
    success: true,
    message: 'Verification codes sent to your current and new email.',
    data: {
      newEmail: normalizedNew,
      currentEmailMasked: maskEmail(currentEmail),
      expiresInSeconds: Math.round(OTP_TTL_MS / 1000),
      resendAfterSeconds: Math.ceil(OTP_RESEND_COOLDOWN_MS / 1000),
    },
  });
});

// @route  POST /api/auth/email-change/confirm
// @access Private
// Body: { currentOtp, newOtp }. Both codes must be correct. Failures use
// 400/429 (not 401) so the frontend's global 401 handler doesn't log the
// user out mid-flow.
export const confirmEmailChange = asyncHandler(async (req, res) => {
  const { currentOtp, newOtp } = req.body;

  if (typeof currentOtp !== 'string' || !/^\d{6}$/.test(currentOtp)) {
    return res
      .status(422)
      .json({ success: false, message: 'Enter the 6-digit code sent to your current email' });
  }
  if (typeof newOtp !== 'string' || !/^\d{6}$/.test(newOtp)) {
    return res
      .status(422)
      .json({ success: false, message: 'Enter the 6-digit code sent to your new email' });
  }

  // Count the attempt atomically before checking, so parallel guesses
  // can't get around the attempt limit.
  const record = await EmailChange.findOneAndUpdate(
    { userId: req.user._id },
    { $inc: { attempts: 1 } },
    { new: true }
  );
  if (!record) {
    return res.status(400).json({
      success: false,
      message: 'No email change in progress, or it has expired. Please start again.',
    });
  }

  if (record.attempts > OTP_MAX_ATTEMPTS) {
    await record.deleteOne();
    return res.status(429).json({
      success: false,
      message: 'Too many incorrect attempts. Please start the email change again.',
    });
  }
  if (record.otpExpiresAt.getTime() < Date.now()) {
    return res
      .status(400)
      .json({ success: false, message: 'These codes have expired. Request new ones.' });
  }

  // Evaluate both before branching so timing doesn't reveal which was wrong.
  const currentOk = otpMatches(`current:${req.user.email}`, currentOtp, record.currentOtpHash);
  const newOk = otpMatches(`new:${record.newEmail}`, newOtp, record.newOtpHash);
  if (!currentOk || !newOk) {
    const remaining = OTP_MAX_ATTEMPTS - record.attempts;
    return res.status(400).json({
      success: false,
      message:
        remaining > 0
          ? `One or both codes are incorrect. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`
          : 'One or both codes are incorrect. No attempts left - please start again.',
    });
  }

  // Both codes correct. Re-check the address is still free.
  if (await User.findOne({ email: record.newEmail, _id: { $ne: req.user._id } })) {
    await record.deleteOne();
    return res.status(409).json({ success: false, message: 'Email is already in use' });
  }

  const user = await User.findById(req.user._id);
  user.email = record.newEmail;
  try {
    await user.save();
  } catch (err) {
    if (err.code === 11000) {
      await record.deleteOne();
      return res.status(409).json({ success: false, message: 'Email is already in use' });
    }
    throw err;
  }
  await record.deleteOne();

  res.json({
    success: true,
    message: 'Email updated successfully.',
    data: toPublicUser(user),
  });
});

// @route  POST /api/auth/login
// @access Public
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const errors = validateLoginInput({ email, password });
  if (errors.length > 0) {
    return res.status(422).json({ success: false, message: errors[0], errors });
  }

  // .select('+password') because the schema excludes it by default.
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

  // Deliberately generic message for both "no such user" and "wrong
  // password" so login can't be used to enumerate registered emails.
  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  }

  // Checked only AFTER the password is verified, so an outsider can't use
  // this message to learn that an archived account exists. 403 (not 401)
  // so the frontend's global 401 handler doesn't swallow the message.
  if (user.archivedAt) {
    return res.status(403).json({
      success: false,
      message: 'This account has been archived. Please contact an administrator.',
    });
  }

  const token = generateToken(user._id);
  res.json({
    success: true,
    message: 'Login successful',
    token,
    data: toPublicUser(user),
  });
});

// @route  POST /api/auth/google
// @access Public
// Body: { accessToken } — a Google OAuth access token from the browser.
// Signs in the matching user, linking an existing account with the same
// (Google-verified) email, or creating a new 'staff' account.
// Invalid tokens return 400 rather than 401 on purpose: the frontend's
// global 401 handler would otherwise bounce the user away from the page
// before they could see the error.
export const googleLogin = asyncHandler(async (req, res) => {
  const { accessToken } = req.body;
  if (!accessToken || typeof accessToken !== 'string') {
    return res.status(422).json({ success: false, message: 'Google access token is required' });
  }

  let profile;
  try {
    profile = await verifyGoogleAccessToken(accessToken);
  } catch (err) {
    return res.status(err.status || 400).json({ success: false, message: err.message });
  }

  let user = await User.findOne({ googleId: profile.googleId });
  if (!user) {
    user = await User.findOne({ email: profile.email });
    if (user) {
      if (user.archivedAt) {
        return res.status(403).json({
          success: false,
          message: 'This account has been archived. Please contact an administrator.',
        });
      }
      user.googleId = profile.googleId;
      await user.save();
    } else {
      // Role is never taken from the client — same rule as /register.
      user = await User.create({
        name: profile.name,
        email: profile.email,
        googleId: profile.googleId,
        role: 'staff',
      });
    }
  }

  if (user.archivedAt) {
    return res.status(403).json({
      success: false,
      message: 'This account has been archived. Please contact an administrator.',
    });
  }

  const token = generateToken(user._id);
  res.json({
    success: true,
    message: 'Login successful',
    token,
    data: toPublicUser(user),
  });
});

// @route  POST /api/auth/avatar/signature
// @access Private
// Step 1 of a profile-picture upload: returns a short-lived signature the
// browser uses to upload straight to Cloudinary.
export const getAvatarUploadSignature = asyncHandler(async (req, res) => {
  if (!isCloudinaryConfigured()) {
    return res
      .status(503)
      .json({ success: false, message: 'Image uploads are not configured on the server.' });
  }
  res.json({ success: true, data: createAvatarUploadSignature(req.user._id) });
});

// @route  PUT /api/auth/avatar
// @access Private
// Step 2: after the browser uploaded to Cloudinary, save the resulting URL.
export const updateAvatar = asyncHandler(async (req, res) => {
  const { avatar } = req.body;
  if (!isValidAvatarUrl(avatar, req.user._id)) {
    return res.status(422).json({ success: false, message: 'Invalid avatar image URL' });
  }
  req.user.avatar = avatar;
  await req.user.save();
  res.json({ success: true, message: 'Profile picture updated', data: toPublicUser(req.user) });
});

// @route  DELETE /api/auth/avatar
// @access Private
export const removeAvatar = asyncHandler(async (req, res) => {
  await deleteAvatar(req.user._id);
  req.user.avatar = '';
  await req.user.save();
  res.json({ success: true, message: 'Profile picture removed', data: toPublicUser(req.user) });
});

// @route  POST /api/auth/logout
// @access Private
// JWTs are stateless, so "logout" here is really just an explicit
// endpoint the client can call; the real logout action (discarding the
// token) happens client-side in AuthContext.
export const logout = asyncHandler(async (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

// @route  GET /api/auth/me
// @access Private
export const getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, data: toPublicUser(req.user) });
});

// @route  PUT /api/auth/change-password
// @access Private
// Separate from the generic user-update endpoint because changing a
// password has different rules: it requires proving you know the
// current password, regardless of admin status.
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword, confirmNewPassword } = req.body;

  if (!currentPassword || !newPassword || !confirmNewPassword) {
    return res.status(422).json({ success: false, message: 'All fields are required' });
  }
  const newPasswordError = getPasswordError(newPassword);
  if (newPasswordError) {
    return res.status(422).json({
      success: false,
      message: newPasswordError.replace(/^Password/, 'New password'),
    });
  }
  if (newPassword !== confirmNewPassword) {
    return res.status(422).json({ success: false, message: 'New passwords do not match' });
  }

  const user = await User.findById(req.user._id).select('+password');
  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Current password is incorrect' });
  }

  user.password = newPassword; // pre-save hook re-hashes it
  await user.save();

  res.json({ success: true, message: 'Password changed successfully' });
});
