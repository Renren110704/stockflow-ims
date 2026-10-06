import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import EmailChange from '../models/EmailChange.js';
import asyncHandler from '../utils/asyncHandler.js';
import { deleteAvatar } from '../services/cloudinaryService.js';

function toPublicUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar || '',
    archivedAt: user.archivedAt || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

// Counts admins who can actually log in. `archivedAt: null` also matches
// accounts created before the field existed.
const countActiveAdmins = () => User.countDocuments({ role: 'admin', archivedAt: null });

// @route  GET /api/users
// @access Private/Admin
// Default: active users. ?archived=true: archived (deactivated) users only.
export const getUsers = asyncHandler(async (req, res) => {
  const archived = req.query.archived === 'true';
  const filter = archived ? { archivedAt: { $ne: null } } : { archivedAt: null };
  const sort = archived ? { archivedAt: -1 } : { createdAt: -1 };
  const users = await User.find(filter).sort(sort);
  res.json({ success: true, data: users.map(toPublicUser) });
});

// @route  GET /api/users/:id
// @access Private (admin, or the user viewing their own record)
export const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const isSelf = req.user._id.equals(user._id);
  if (req.user.role !== 'admin' && !isSelf) {
    return res.status(403).json({ success: false, message: 'Forbidden: insufficient permissions' });
  }

  res.json({ success: true, data: toPublicUser(user) });
});

// @route  PUT /api/users/:id
// @access Private (admin, or the user updating their own profile)
// Admins may update name, email and role. Non-admins may only update
// their own name/email — role changes from a non-admin are rejected
// outright rather than silently ignored, so the client gets clear
// feedback instead of a confusing partial success.
// Exception: ANYONE changing their OWN email (admins included) must go
// through the OTP flow (POST /api/auth/email-change/*), which verifies
// both the current and the new address. Admins editing someone else's
// email can still do so here.
export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const isSelf = req.user._id.equals(user._id);
  const isAdmin = req.user.role === 'admin';

  if (!isAdmin && !isSelf) {
    return res.status(403).json({ success: false, message: 'Forbidden: insufficient permissions' });
  }

  if (user.archivedAt) {
    return res
      .status(409)
      .json({ success: false, message: 'This user is archived. Restore them before editing.' });
  }

  const { name, email, role } = req.body;

  if (role !== undefined) {
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'Only admins can change roles' });
    }
    if (!['admin', 'staff'].includes(role)) {
      return res.status(422).json({ success: false, message: 'Role must be admin or staff' });
    }
    // Safeguard: never allow the last remaining admin to be demoted,
    // or there would be no account left able to manage users/roles.
    if (user.role === 'admin' && role !== 'admin') {
      const adminCount = await countActiveAdmins();
      if (adminCount <= 1) {
        return res.status(409).json({
          success: false,
          message: 'Cannot change role: at least one admin account must remain',
        });
      }
    }
    user.role = role;
  }

  if (email !== undefined) {
    const normalizedEmail = email.toLowerCase();
    if (normalizedEmail !== user.email) {
      if (isSelf) {
        return res.status(403).json({
          success: false,
          code: 'EMAIL_VERIFICATION_REQUIRED',
          message:
            'Changing your own email requires verification codes sent to both your current and new email.',
        });
      }
      // Exclude the current user from the duplicate check — without this,
      // and without normalizing case before comparing, a same-email save
      // with different casing (e.g. from browser autofill) would match
      // the user's own record and incorrectly block as a duplicate.
      const existing = await User.findOne({ email: normalizedEmail, _id: { $ne: user._id } });
      if (existing) {
        return res.status(409).json({ success: false, message: 'Email is already in use' });
      }
      user.email = email;
    }
  }

  if (name !== undefined) user.name = name;

  await user.save();
  res.json({ success: true, message: 'User updated', data: toPublicUser(user) });
});

// @route  DELETE /api/users/:id
// @access Private/Admin
// ARCHIVE (deactivate): the account can no longer log in, but nothing is
// erased, so transactions and purchase orders still show who did what.
// Reversible via POST /api/users/:id/restore.
export const archiveUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  if (user.archivedAt) {
    return res.status(409).json({ success: false, message: 'User is already archived' });
  }
  if (req.user._id.equals(user._id)) {
    return res.status(409).json({ success: false, message: "You can't archive your own account" });
  }

  // Safeguard: never allow the last remaining active admin to be archived.
  if (user.role === 'admin') {
    const adminCount = await countActiveAdmins();
    if (adminCount <= 1) {
      return res.status(409).json({
        success: false,
        message: 'Cannot archive: at least one active admin account must remain',
      });
    }
  }

  user.archivedAt = new Date();
  await user.save();
  res.json({ success: true, message: 'User archived', data: toPublicUser(user) });
});

// @route  POST /api/users/:id/restore
// @access Private/Admin
export const restoreUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  if (!user.archivedAt) {
    return res.status(409).json({ success: false, message: 'User is not archived' });
  }

  user.archivedAt = null;
  await user.save();
  res.json({ success: true, message: 'User restored', data: toPublicUser(user) });
});

// @route  DELETE /api/users/:id/permanent
// @access Private/Admin
// Irreversibly removes an ARCHIVED user. Refused if the user has recorded
// activity, because deleting them would leave transactions / purchase orders
// pointing at a person who no longer exists — they stay archived instead.
export const permanentlyDeleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  if (!user.archivedAt) {
    return res
      .status(409)
      .json({ success: false, message: 'Archive this user first, then delete them permanently.' });
  }
  if (req.user._id.equals(user._id)) {
    return res.status(409).json({ success: false, message: "You can't delete your own account" });
  }

  const [hasTransactions, hasPurchaseOrders] = await Promise.all([
    Transaction.exists({ performedBy: user._id }),
    PurchaseOrder.exists({ $or: [{ createdBy: user._id }, { receivedBy: user._id }] }),
  ]);
  if (hasTransactions || hasPurchaseOrders) {
    return res.status(409).json({
      success: false,
      message:
        'Cannot delete permanently: this user has recorded transactions or purchase orders. They will stay archived so that history remains accurate.',
    });
  }

  // Clean up the profile picture in Cloudinary (best-effort, never throws)
  // and any half-finished email change.
  await deleteAvatar(user._id);
  await EmailChange.deleteMany({ userId: user._id });
  await user.deleteOne();
  res.json({ success: true, message: 'User permanently deleted' });
});
