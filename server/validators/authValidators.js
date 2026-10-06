const EMAIL_REGEX = /^\S+@\S+\.\S+$/;
// Letters (any language), spaces, periods, apostrophes, hyphens - no digits.
// Keep in sync with NAME_VALID in src/pages/auth/Register.jsx.
const NAME_REGEX = /^[\p{L}\p{M}][\p{L}\p{M}\s.'’-]*$/u;

// Strong-password policy for NEW passwords (sign-up, reset, change-password).
// Deliberately NOT applied to login, so existing accounts with older, weaker
// passwords can still sign in. Keep in sync with PASSWORD_RULES in
// src/utils/passwordStrength.js. Returns an error message, or null if OK.
export function getPasswordError(password) {
  if (typeof password !== 'string' || !password) return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/\p{Lu}/u.test(password)) return 'Password must contain an uppercase letter';
  if (!/\p{Ll}/u.test(password)) return 'Password must contain a lowercase letter';
  if (!/\d/.test(password)) return 'Password must contain a number';
  if (!/[^\p{L}\p{N}\s]/u.test(password)) return 'Password must contain a special character';
  return null;
}

// Backend validation must never trust the frontend. These run independently
// of whatever validation React did on the form. Explicit typeof checks
// matter here specifically: a crafted payload like {"email": {"$ne": null}}
// should fail cleanly with a validation error, not reach a query or throw
// an unhandled exception when the controller calls a string method on it.
export function validateRegisterInput({ name, email, password, confirmPassword }) {
  const errors = [];

  if (typeof name !== 'string' || !name.trim()) errors.push('Name is required');
  else if (!NAME_REGEX.test(name.trim())) {
    errors.push('Name can only contain letters, spaces, apostrophes, periods and hyphens');
  }

  if (typeof email !== 'string' || !email.trim()) errors.push('Email is required');
  else if (!EMAIL_REGEX.test(email)) errors.push('Please provide a valid email');

  const passwordError = getPasswordError(password);
  if (passwordError) errors.push(passwordError);

  if (password !== confirmPassword) errors.push('Passwords do not match');

  return errors;
}

export function validateOtpInput({ email, otp }) {
  const errors = [];
  if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) errors.push('A valid email is required');
  if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) errors.push('Enter the 6-digit code');
  return errors;
}

export function validateResendInput({ email }) {
  const errors = [];
  if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) errors.push('A valid email is required');
  return errors;
}

export function validateResetInput({ email, otp, newPassword, confirmNewPassword }) {
  const errors = [];
  if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) errors.push('A valid email is required');
  if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) errors.push('Enter the 6-digit code');
  const newPasswordError = getPasswordError(newPassword);
  if (newPasswordError) errors.push(newPasswordError.replace(/^Password/, 'New password'));
  if (newPassword !== confirmNewPassword) errors.push('Passwords do not match');
  return errors;
}

export function validateLoginInput({ email, password }) {
  const errors = [];
  if (typeof email !== 'string' || !email) errors.push('Email is required');
  if (typeof password !== 'string' || !password) errors.push('Password is required');
  return errors;
}
