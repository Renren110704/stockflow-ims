import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Verifies the JWT from the Authorization header, loads the corresponding
// user, and attaches it to req.user. Rejects missing/invalid/expired tokens.
// Any route that needs a logged-in user should use this middleware.
export async function protect(req, res, next) {
  let token;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
    }

    // An archived account is locked out even if its token is still valid.
    if (user.archivedAt) {
      return res
        .status(401)
        .json({ success: false, message: 'Not authorized, this account has been archived' });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Not authorized, invalid token' });
  }
}

// Restricts a route to specific roles. Must run after protect().
// Usage: router.delete('/:id', protect, authorize('admin'), handler)
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden: insufficient permissions' });
    }
    next();
  };
}
