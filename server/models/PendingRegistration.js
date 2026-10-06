import mongoose from 'mongoose';

// Holds a sign-up that has not been email-verified yet. The real User is
// only created once the correct OTP is submitted, so unverified (or
// mistyped / someone else's) email addresses never occupy a User record.
//
// The password is stored already hashed (bcrypt), and the OTP is stored as
// an HMAC — neither is ever kept in plaintext.
const pendingRegistrationSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    otpHash: { type: String, required: true },
    otpExpiresAt: { type: Date, required: true },
    // Wrong guesses against the current code; reset whenever a new code is issued.
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Date, default: Date.now },
    // MongoDB deletes the document automatically after this time (TTL index).
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

pendingRegistrationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PendingRegistration = mongoose.model('PendingRegistration', pendingRegistrationSchema);

export default PendingRegistration;
