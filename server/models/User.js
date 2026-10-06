import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      // Accounts created through Google sign-in have no password.
      required: [
        function passwordRequired() {
          return !this.googleId;
        },
        'Password is required',
      ],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // never returned by default on find queries
    },
    // Google account id ("sub"), set when the user signs in with Google.
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    // Profile picture URL (Cloudinary). Empty string = no picture.
    avatar: {
      type: String,
      default: '',
    },
    role: {
      type: String,
      enum: ['admin', 'staff'],
      default: 'staff',
    },
    // Archived = deactivated: the account can't log in or use the API, and is
    // hidden from the Users list's default view, but all its history is kept.
    // null (or missing, for accounts created before this field existed) = active.
    archivedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Hash the password before saving, but only if it was actually changed
// (avoids re-hashing an already-hashed password on unrelated updates).
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  // Set by the OTP sign-up flow, where the password was already bcrypt-hashed
  // when the pending registration was created. Never set this from user input.
  if (this.$locals.passwordAlreadyHashed) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Instance method to compare a plaintext candidate against the stored hash.
userSchema.methods.comparePassword = function comparePassword(candidate) {
  // Google-only accounts have no password, so password login always fails.
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(candidate, this.password);
};

const User = mongoose.model('User', userSchema);

export default User;
