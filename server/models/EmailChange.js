import mongoose from 'mongoose';

// An in-progress "change my email" request. One per user; starting another
// overwrites it. Two separate codes are issued: one emailed to the user's
// CURRENT address and one to the NEW address, and BOTH must be entered.
// Codes are stored only as HMACs. Deleted on success, or automatically by
// MongoDB (TTL index) once expired.
const emailChangeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    newEmail: { type: String, required: true, lowercase: true, trim: true },
    currentOtpHash: { type: String, required: true },
    newOtpHash: { type: String, required: true },
    otpExpiresAt: { type: Date, required: true },
    // Failed confirmations against the current pair of codes.
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

emailChangeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const EmailChange = mongoose.model('EmailChange', emailChangeSchema);

export default EmailChange;
