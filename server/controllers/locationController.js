import Location from '../models/Location.js';
import StockLevel from '../models/StockLevel.js';
import Transaction from '../models/Transaction.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import asyncHandler from '../utils/asyncHandler.js';

// @route  GET /api/locations
// @access Private
// Returns each location with how many units / distinct products it holds.
// ?archived=true returns archived locations instead (admin only).
export const getLocations = asyncHandler(async (req, res) => {
  const archived = req.query.archived === 'true';
  if (archived && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden: insufficient permissions' });
  }
  // Putting `deletedAt` in the filter switches off the soft-delete auto-hide.
  const filter = archived ? { deletedAt: { $ne: null } } : {};
  const sort = archived ? { deletedAt: -1 } : { name: 1 };

  const [locations, totals] = await Promise.all([
    Location.find(filter).sort(sort).lean(),
    StockLevel.aggregate([
      { $match: { quantity: { $gt: 0 } } },
      { $group: { _id: '$location', units: { $sum: '$quantity' }, products: { $sum: 1 } } },
    ]),
  ]);

  const totalsByLocation = new Map(totals.map((t) => [String(t._id), t]));
  const data = locations.map((l) => ({
    ...l,
    totalUnits: totalsByLocation.get(String(l._id))?.units || 0,
    productCount: totalsByLocation.get(String(l._id))?.products || 0,
  }));

  res.json({ success: true, data });
});

// @route  POST /api/locations
// @access Private/Admin
export const createLocation = asyncHandler(async (req, res) => {
  const { name, code, description } = req.body;

  if (!name || !name.trim()) {
    return res.status(422).json({ success: false, message: 'Location name is required' });
  }

  const existing = await Location.findOne({ name: name.trim() });
  if (existing) {
    return res.status(409).json({ success: false, message: 'A location with that name already exists' });
  }

  const location = await Location.create({ name: name.trim(), code, description });
  res.status(201).json({ success: true, message: 'Location created', data: location });
});

// @route  PUT /api/locations/:id
// @access Private/Admin
export const updateLocation = asyncHandler(async (req, res) => {
  const location = await Location.findById(req.params.id);
  if (!location) {
    return res.status(404).json({ success: false, message: 'Location not found' });
  }

  const { name, code, description } = req.body;

  if (name !== undefined) {
    if (!name.trim()) {
      return res.status(422).json({ success: false, message: 'Location name cannot be empty' });
    }
    const existing = await Location.findOne({ name: name.trim(), _id: { $ne: location._id } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'A location with that name already exists' });
    }
    location.name = name.trim();
  }
  if (code !== undefined) location.code = code;
  if (description !== undefined) location.description = description;

  await location.save();
  res.json({ success: true, message: 'Location updated', data: location });
});

// @route  DELETE /api/locations/:id
// @access Private/Admin
// A location still holding stock can't be removed — transfer the stock
// out first, otherwise those units would silently become "unassigned".
export const deleteLocation = asyncHandler(async (req, res) => {
  const location = await Location.findById(req.params.id);
  if (!location) {
    return res.status(404).json({ success: false, message: 'Location not found' });
  }

  const [held] = await StockLevel.aggregate([
    { $match: { location: location._id, quantity: { $gt: 0 } } },
    { $group: { _id: null, units: { $sum: '$quantity' } } },
  ]);
  if (held?.units > 0) {
    return res.status(409).json({
      success: false,
      message: `Cannot archive: this location still holds ${held.units} unit(s). Transfer the stock elsewhere first.`,
    });
  }

  await StockLevel.deleteMany({ location: location._id }); // empty rows only
  // ARCHIVE (soft delete). Reversible with POST /:id/restore.
  location.deletedAt = new Date();
  await location.save();
  res.json({ success: true, message: 'Location archived' });
});

// @route  POST /api/locations/:id/restore
// @access Private/Admin
export const restoreLocation = asyncHandler(async (req, res) => {
  const location = await Location.findOne({ _id: req.params.id, deletedAt: { $ne: null } });
  if (!location) {
    return res.status(404).json({ success: false, message: 'Archived location not found' });
  }

  // An active location may have taken this name while it was archived.
  const nameTaken = await Location.findOne({ name: location.name });
  if (nameTaken) {
    return res.status(409).json({
      success: false,
      message: `Cannot restore: an active location named "${location.name}" already exists. Rename or archive it first.`,
    });
  }

  location.deletedAt = null;
  await location.save();
  res.json({ success: true, message: 'Location restored', data: location });
});

// @route  DELETE /api/locations/:id/permanent
// @access Private/Admin
// Irreversibly removes an ARCHIVED location. Refused if any transaction or
// purchase order mentions it, since that history would be left pointing at
// a place that no longer exists.
export const permanentlyDeleteLocation = asyncHandler(async (req, res) => {
  const location = await Location.findOne({ _id: req.params.id, deletedAt: { $ne: null } });
  if (!location) {
    return res.status(404).json({
      success: false,
      message: 'Archived location not found. Only archived locations can be deleted permanently.',
    });
  }

  const [hasTransactions, onPurchaseOrder] = await Promise.all([
    Transaction.exists({
      $or: [{ location: location._id }, { fromLocation: location._id }, { toLocation: location._id }],
    }),
    PurchaseOrder.exists({ location: location._id }),
  ]);
  if (hasTransactions || onPurchaseOrder) {
    return res.status(409).json({
      success: false,
      message:
        'Cannot delete permanently: this location appears in stock transactions or purchase orders. It will stay archived so your history remains accurate.',
    });
  }

  await StockLevel.deleteMany({ location: location._id }); // empty rows only
  await location.deleteOne();
  res.json({ success: true, message: 'Location permanently deleted' });
});
