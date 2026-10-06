import jwt from 'jsonwebtoken';

// Signs a JWT carrying only the user's id. Everything else about the
// user (role, name, etc.) is looked up fresh from the DB on each
// authenticated request rather than trusted from the token payload.
export default function generateToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}
