import mongoose from 'mongoose';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import asyncHandler from '../utils/asyncHandler.js';

// Update, delete, and the "prevent deleting a category still in use by
// products" safeguard below complete the Category CRUD started in Phase 6
// (create/list existed early only because Product creation needed
// categories to reference).

// @route  POST /api/categories
// @access Private/Admin
export const createCategory = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  if (!name || !name.trim()) {
    return res.status(422).json({ success: false, message: 'Category name is required' });
  }

  const existing = await Category.findOne({ name: name.trim() });
  if (existing) {
    return res.status(409).json({ success: false, message: 'Category already exists' });
  }

  const category = await Category.create({ name: name.trim(), description });
  res.status(201).json({ success: true, message: 'Category created', data: category });
});

// @route  GET /api/categories
// @access Private
// ?archived=true returns archived categories instead (admin only).
export const getCategories = asyncHandler(async (req, res) => {
  if (req.query.archived === 'true') {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden: insufficient permissions' });
    }
    // Putting `deletedAt` in the filter switches off the soft-delete auto-hide.
    const archived = await Category.find({ deletedAt: { $ne: null } }).sort({ deletedAt: -1 });
    return res.json({ success: true, data: archived });
  }

  const categories = await Category.find().sort({ name: 1 });
  res.json({ success: true, data: categories });
});

// @route  GET /api/categories/:id
// @access Private
export const getCategoryById = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    return res.status(404).json({ success: false, message: 'Category not found' });
  }
  res.json({ success: true, data: category });
});

// @route  PUT /api/categories/:id
// @access Private/Admin
export const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    return res.status(404).json({ success: false, message: 'Category not found' });
  }

  const { name, description } = req.body;

  if (name !== undefined) {
    if (!name.trim()) {
      return res.status(422).json({ success: false, message: 'Category name cannot be empty' });
    }
    const existing = await Category.findOne({ name: name.trim(), _id: { $ne: category._id } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Category already exists' });
    }
    category.name = name.trim();
  }

  if (description !== undefined) category.description = description;

  await category.save();
  res.json({ success: true, message: 'Category updated', data: category });
});

// @route  DELETE /api/categories/:id
// @access Private/Admin
// Safe-deletion strategy: a category still referenced by products cannot
// simply be deleted, since that would orphan those products' category
// field. Instead, the caller can optionally pass ?reassignTo=<categoryId>
// to move all of that category's products to another category first;
// without it, deletion is blocked with a clear count of affected products.
export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    return res.status(404).json({ success: false, message: 'Category not found' });
  }

  const productCount = await Product.countDocuments({ category: category._id });

  if (productCount > 0) {
    const { reassignTo } = req.query;

    if (!reassignTo) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete: ${productCount} product(s) are still assigned to this category. Reassign them first, or retry with ?reassignTo=<categoryId>.`,
      });
    }

    if (!mongoose.Types.ObjectId.isValid(reassignTo)) {
      return res.status(422).json({ success: false, message: 'reassignTo is not a valid category id' });
    }
    if (reassignTo === String(category._id)) {
      return res.status(422).json({ success: false, message: 'reassignTo must be a different category' });
    }

    const targetCategory = await Category.findById(reassignTo);
    if (!targetCategory) {
      return res.status(404).json({ success: false, message: 'Target category (reassignTo) not found' });
    }

    await Product.updateMany({ category: category._id }, { category: reassignTo });
  }

  // ARCHIVE (soft delete): keeps the row so historical records referencing
  // this category still resolve, while hiding it from all normal queries.
  // Reversible with POST /:id/restore.
  category.deletedAt = new Date();
  await category.save();
  res.json({ success: true, message: 'Category archived' });
});

// @route  POST /api/categories/:id/restore
// @access Private/Admin
export const restoreCategory = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ _id: req.params.id, deletedAt: { $ne: null } });
  if (!category) {
    return res.status(404).json({ success: false, message: 'Archived category not found' });
  }

  // An active category may have taken this name while it was archived.
  const nameTaken = await Category.findOne({ name: category.name });
  if (nameTaken) {
    return res.status(409).json({
      success: false,
      message: `Cannot restore: an active category named "${category.name}" already exists. Rename or archive it first.`,
    });
  }

  category.deletedAt = null;
  await category.save();
  res.json({ success: true, message: 'Category restored', data: category });
});

// @route  DELETE /api/categories/:id/permanent
// @access Private/Admin
// Irreversibly removes an ARCHIVED category. Refused while ANY product
// (archived ones included) still belongs to it, so no product is left
// pointing at a category that no longer exists.
export const permanentlyDeleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ _id: req.params.id, deletedAt: { $ne: null } });
  if (!category) {
    return res.status(404).json({
      success: false,
      message: 'Archived category not found. Only archived categories can be deleted permanently.',
    });
  }

  const productCount = await Product.countDocuments({ category: category._id }).setOptions({
    includeDeleted: true,
  });
  if (productCount > 0) {
    return res.status(409).json({
      success: false,
      message: `Cannot delete permanently: ${productCount} product(s) (archived ones included) still belong to this category. Move or permanently delete them first.`,
    });
  }

  await category.deleteOne();
  res.json({ success: true, message: 'Category permanently deleted' });
});
