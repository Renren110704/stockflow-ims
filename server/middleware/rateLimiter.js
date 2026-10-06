import rateLimit from 'express-rate-limit';

// Login and registration are brute-force/credential-stuffing targets,
// so they get a tighter limit than the rest of the API. Other routes
// are already protected by JWT auth + role checks, so a global limiter
// isn't necessary on top of that for this project's scope.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many attempts from this IP. Please try again in 15 minutes.',
  },
});

// OTP verification gets its own, roomier bucket: each code is already capped
// at a few wrong guesses server-side, and sharing authLimiter would let a
// normal register -> verify -> resend flow eat into the login allowance.
export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many verification attempts from this IP. Please try again in 15 minutes.',
  },
});
