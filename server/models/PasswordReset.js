import mongoose from 'mongoose';

// An outstanding "forgot password" code. One per email; requesting another
// code overwrites the previous one. Deleted on success, or automatically
// by MongoDB (TTL index) once it expires. The code is stored as an HMAC.
const passwordResetSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    otpHash: { type: String, required: true },
    otpExpiresAt: { type: Date, required: true },
    // Wrong guesses against the current code; reset when a new code is issued.
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PasswordReset = mongoose.model('PasswordReset', passwordResetSchema);

export default PasswordReset;
