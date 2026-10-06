import express from 'express';
import {
  register,
  verifyRegistrationOtp,
  resendRegistrationOtp,
  forgotPassword,
  resetPassword,
  requestEmailChange,
  confirmEmailChange,
  login,
  googleLogin,
  logout,
  getMe,
  changePassword,
  getAvatarUploadSignature,
  updateAvatar,
  removeAvatar,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authLimiter, otpLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/register', authLimiter, register);
router.post('/verify-otp', otpLimiter, verifyRegistrationOtp);
router.post('/resend-otp', otpLimiter, resendRegistrationOtp);
router.post('/forgot-password', otpLimiter, forgotPassword);
router.post('/reset-password', otpLimiter, resetPassword);
router.post('/email-change/request', protect, otpLimiter, requestEmailChange);
router.post('/email-change/confirm', protect, otpLimiter, confirmEmailChange);
router.post('/login', authLimiter, login);
router.post('/google', authLimiter, googleLogin);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/change-password', protect, authLimiter, changePassword);
router.post('/avatar/signature', protect, getAvatarUploadSignature);
router.put('/avatar', protect, updateAvatar);
router.delete('/avatar', protect, removeAvatar);

export default router;
