// One-time CLI utility to promote an already-registered user to admin.
// Needed because the API intentionally has no "register as admin" path —
// this script is the sanctioned way to create your first admin account.
//
// Usage (from the server/ directory):
//   node scripts/promoteAdmin.js someone@example.com

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import User from '../models/User.js';

const email = process.argv[2];

if (!email) {
  console.error('Usage: node scripts/promoteAdmin.js <email>');
  process.exit(1);
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  user.role = 'admin';
  await user.save();

  console.log(`${user.email} is now an admin.`);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
