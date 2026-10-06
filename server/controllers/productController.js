import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import StockLevel from '../models/StockLevel.js';
import Transaction from '../models/Transaction.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import asyncHandler from '../utils/asyncHandler.js';
import { validateProductInput } from '../validators/productValidators.js';
import {
  isCloudinaryConfigured,
  createProductImageUploadSignature,
  deleteProductImage,
} from '../services/cloudinaryService.js';

// @route  POST /api/products/image/signature
// @access Private/Admin
// Signature for uploading one product image straight to Cloudinary.
export const getProductImageSignature = asyncHandler(async (req, res) => {
  if (!isCloudinaryConfigured()) {
    return res
      .status(503)
      .json({ success: false, message: 'Image uploads are not configured on the server.' });
  }
  res.json({ success: true, data: createProductImageUploadSignature() });
});

// @route  POST /api/products
// @access Private/Admin
export const createProduct = asyncHandler(async (req, res) => {
  const errors = validateProductInput(req.body);
  if (errors.length > 0) {
    return res.status(422).json({ success: false, message: errors[0], errors });
  }

  const { name, sku, description, category, price, quantity, minimumStockLevel, supplier, imageUrl } = req.body;

  const categoryExists = await Category.findById(category);
  if (!categoryExists) {
    return res.status(422).json({ success: false, message: 'Category does not exist' });
  }

  const existingSku = await Product.findOne({ sku: sku.trim().toUpperCase() });
  if (existingSku) {
    return res.status(409).json({ success: false, message: 'A product with this SKU already exists' });
  }

  const product = new Product({
    name,
    sku,
    description,
    category,
    price,
    quantity: quantity ?? 0,
    minimumStockLevel: minimumStockLevel ?? 0,
    supplier,
    imageUrl,
  });

  await product.save(); // triggers the pre-save stock-status derivation
  await product.populate('category', 'name');

  res.status(201).json({ success: true, message: 'Product created successfully', data: product });
});

// @route  GET /api/products
// @access Private
// Supports ?page=&limit= pagination, ?search= (matches name, SKU, or
// category name), ?category=&status=&supplier= filters (combinable),
// and ?sortBy=&sortOrder= (name|price|quantity|createdAt, asc|desc).
export const getProducts = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);
  const skip = (page - 1) * limit;

  const { search, category, status, supplier, sortBy, sortOrder, archived } = req.query;
  const filter = {};

  // ?archived=true lists ARCHIVED products instead (admin only). Putting
  // `deletedAt` in the filter is what switches off the soft-delete plugin's
  // automatic "hide deleted" rule.
  if (archived === 'true') {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden: insufficient permissions' });
    }
    filter.deletedAt = { $ne: null };
  }

  if (category) filter.category = category;
  if (status) filter.status = status;
  if (supplier) filter.supplier = { $regex: supplier, $options: 'i' };

  if (search) {
    // Category is a separate collection, so "search by category" means
    // resolving matching category ids first, then OR-ing them in
    // alongside the direct name/SKU regex match.
    const matchingCategories = await Category.find({ name: { $regex: search, $options: 'i' } }).select('_id');
    const categoryIds = matchingCategories.map((c) => c._id);

    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { sku: { $regex: search, $options: 'i' } },
      ...(categoryIds.length ? [{ category: { $in: categoryIds } }] : []),
    ];
  }

  const allowedSortFields = ['name', 'price', 'quantity', 'createdAt', 'deletedAt'];
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
  const sortDirection = sortOrder === 'asc' ? 1 : -1;

  const [products, total] = await Promise.all([
    Product.find(filter)
      // includeDeleted: an archived product's category may be archived too.
      .populate({ path: 'category', select: 'name', options: { includeDeleted: true } })
      .sort({ [sortField]: sortDirection })
      .skip(skip)
      .limit(limit),
    Product.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: products,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  });
});

// @route  GET /api/products/:id
// @access Private
export const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate('category', 'name');
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }
  res.json({ success: true, data: product });
});

// @route  PUT /api/products/:id
// @access Private/Admin
export const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const errors = validateProductInput(req.body, { isUpdate: true });
  if (errors.length > 0) {
    return res.status(422).json({ success: false, message: errors[0], errors });
  }

  const { name, sku, description, category, price, quantity, minimumStockLevel, supplier, imageUrl, status } = req.body;

  if (category !== undefined) {
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(422).json({ success: false, message: 'Category does not exist' });
    }
    product.category = category;
  }

  if (sku !== undefined && sku.trim().toUpperCase() !== product.sku) {
    const existingSku = await Product.findOne({ sku: sku.trim().toUpperCase() });
    if (existingSku) {
      return res.status(409).json({ success: false, message: 'A product with this SKU already exists' });
    }
    product.sku = sku;
  }

  if (name !== undefined) product.name = name;
  if (description !== undefined) product.description = description;
  if (price !== undefined) product.price = price;
  if (supplier !== undefined) product.supplier = supplier;
  const previousImageUrl = product.imageUrl;
  if (imageUrl !== undefined) product.imageUrl = imageUrl;

  // Quantity updates here are direct corrections (e.g. fixing a data
  // entry mistake), not inventory movements — those go through the
  // Transaction endpoints in Phase 8, which are the only place stock
  // changes get recorded as an auditable event.
  if (quantity !== undefined) product.quantity = quantity;
  if (minimumStockLevel !== undefined) product.minimumStockLevel = minimumStockLevel;

  // 'Discontinued' is the one status value clients may set directly;
  // any other value is ignored and left to the pre-save hook to derive.
  if (status === 'Discontinued' || (product.status === 'Discontinued' && status === undefined)) {
    product.status = 'Discontinued';
  } else if (status !== undefined && status !== 'Discontinued') {
    product.status = 'In Stock'; // placeholder; pre-save hook recalculates immediately
  }

  await product.save();
  await product.populate('category', 'name');

  // The image was replaced or removed: delete the old file from Cloudinary
  // so it doesn't sit there unused (unless another product still uses it;
  // external URLs are never touched — see deleteProductImage).
  if (previousImageUrl && previousImageUrl !== product.imageUrl) {
    const stillUsed = await Product.exists({ imageUrl: previousImageUrl });
    if (!stillUsed) await deleteProductImage(previousImageUrl);
  }

  res.json({ success: true, message: 'Product updated successfully', data: product });
});

// @route  DELETE /api/products/:id
// @access Private/Admin
export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  // ARCHIVE (soft delete): the product stays in the database so past
  // transactions and purchase orders still show its name, but it disappears
  // from lists, stock alerts, and reports. Reversible with POST /:id/restore;
  // DELETE /:id/permanent erases it for good.
  product.deletedAt = new Date();
  await product.save();
  res.json({ success: true, message: 'Product archived' });
});

// @route  POST /api/products/:id/restore
// @access Private/Admin
export const restoreProduct = asyncHandler(async (req, res) => {
  // Putting `deletedAt` in the filter switches off the plugin's auto-hide.
  const product = await Product.findOne({ _id: req.params.id, deletedAt: { $ne: null } });
  if (!product) {
    return res.status(404).json({ success: false, message: 'Archived product not found' });
  }

  // Another active product may have taken this SKU while this one was archived.
  const skuTaken = await Product.findOne({ sku: product.sku });
  if (skuTaken) {
    return res.status(409).json({
      success: false,
      message: `Cannot restore: an active product already uses the SKU "${product.sku}". Change or archive that product first.`,
    });
  }

  // If its category was archived too, the product would reappear with no category.
  const category = await Category.findById(product.category);
  if (!category) {
    return res.status(409).json({
      success: false,
      message: "Cannot restore: this product's category is archived. Restore the category first.",
    });
  }

  product.deletedAt = null;
  await product.save();
  await product.populate('category', 'name');
  res.json({ success: true, message: 'Product restored', data: product });
});

// @route  DELETE /api/products/:id/permanent
// @access Private/Admin
// Irreversibly removes an ARCHIVED product. Refused if it appears in any
// transaction or purchase order, since that history would be left pointing
// at a product that no longer exists.
export const permanentlyDeleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, deletedAt: { $ne: null } });
  if (!product) {
    return res.status(404).json({
      success: false,
      message: 'Archived product not found. Only archived products can be deleted permanently.',
    });
  }

  const [hasTransactions, onPurchaseOrder] = await Promise.all([
    Transaction.exists({ product: product._id }),
    PurchaseOrder.exists({ 'items.product': product._id }),
  ]);
  if (hasTransactions || onPurchaseOrder) {
    return res.status(409).json({
      success: false,
      message:
        'Cannot delete permanently: this product appears in stock transactions or purchase orders. It will stay archived so your history remains accurate.',
    });
  }

  await StockLevel.deleteMany({ product: product._id });
  const { imageUrl } = product;
  await product.deleteOne();

  // Remove the image from Cloudinary unless another product (archived ones
  // included) still uses it; external URLs are never touched.
  if (imageUrl) {
    const stillUsed = await Product.exists({ imageUrl }).setOptions({ includeDeleted: true });
    if (!stillUsed) await deleteProductImage(imageUrl);
  }

  res.json({ success: true, message: 'Product permanently deleted' });
});

// @route  GET /api/products/sku/:sku
// @access Private
// Exact SKU lookup used by the barcode/QR scanner. SKUs are stored
// uppercase, so the lookup is case-insensitive from the caller's side.
export const getProductBySku = asyncHandler(async (req, res) => {
  const sku = String(req.params.sku || '').trim().toUpperCase();
  const product = await Product.findOne({ sku }).populate('category', 'name');
  if (!product) {
    return res.status(404).json({ success: false, message: `No product found with SKU "${sku}"` });
  }
  res.json({ success: true, data: product });
});

// @route  GET /api/products/:id/stock
// @access Private
// How a product's total quantity is distributed across locations, plus the
// remainder that hasn't been assigned to any location.
export const getProductStock = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const levels = await StockLevel.find({ product: product._id, quantity: { $gt: 0 } })
    .populate({ path: 'location', select: 'name code', options: { includeDeleted: true } })
    .sort({ quantity: -1 });

  const allocated = levels.reduce((sum, l) => sum + l.quantity, 0);
  res.json({
    success: true,
    data: {
      total: product.quantity,
      unassigned: Math.max(product.quantity - allocated, 0),
      levels: levels.map((l) => ({ location: l.location, quantity: l.quantity })),
    },
  });
});

// @route  POST /api/products/bulk-delete
// @access Private/Admin
// Body: { ids: [productId, ...] }
export const bulkArchiveProducts = asyncHandler(async (req, res) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(422).json({ success: false, message: 'ids must be a non-empty array' });
  }

  const invalidId = ids.find((id) => !mongoose.Types.ObjectId.isValid(id));
  if (invalidId) {
    return res.status(422).json({ success: false, message: `"${invalidId}" is not a valid product id` });
  }

  // Archives (soft deletes). The plugin's hook limits this to active products.
  const result = await Product.updateMany({ _id: { $in: ids } }, { deletedAt: new Date() });
  res.json({
    success: true,
    message: `${result.modifiedCount} product(s) archived`,
    data: { archivedCount: result.modifiedCount, deletedCount: result.modifiedCount },
  });
});

// @route  POST /api/products/bulk-reassign-category
// @access Private/Admin
// Body: { ids: [productId, ...], category: categoryId }
// Moves every listed product to a single target category in one request —
// the bulk counterpart to editing each product's category individually.
export const bulkReassignCategory = asyncHandler(async (req, res) => {
  const { ids, category } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(422).json({ success: false, message: 'ids must be a non-empty array' });
  }
  if (!category || !mongoose.Types.ObjectId.isValid(category)) {
    return res.status(422).json({ success: false, message: 'A valid target category is required' });
  }

  const categoryExists = await Category.findById(category);
  if (!categoryExists) {
    return res.status(404).json({ success: false, message: 'Target category not found' });
  }

  const result = await Product.updateMany({ _id: { $in: ids } }, { category });
  res.json({
    success: true,
    message: `${result.modifiedCount} product(s) moved to "${categoryExists.name}"`,
    data: { modifiedCount: result.modifiedCount },
  });
});

// @route  POST /api/products/bulk-import
// @access Private/Admin
// Body: { products: [{ name, sku, category, price, quantity, minimumStockLevel, supplier, description, imageUrl }, ...] }
// Designed for CSV-parsed rows from the client. Each row is processed
// independently and failures are collected rather than aborting the whole
// batch, so a typo in row 40 doesn't cost the other 199 valid rows.
// `category` may be either an existing category's name or id; an unknown
// name creates that category on the fly, since seeding a catalog from a
// spreadsheet is exactly the case where categories won't exist yet.
const MAX_BULK_IMPORT_ROWS = 500;

export const bulkImportProducts = asyncHandler(async (req, res) => {
  const { products: rows } = req.body;

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(422).json({ success: false, message: 'products must be a non-empty array' });
  }
  if (rows.length > MAX_BULK_IMPORT_ROWS) {
    return res.status(422).json({
      success: false,
      message: `Cannot import more than ${MAX_BULK_IMPORT_ROWS} products at once`,
    });
  }

  const categoryCache = new Map(); // lowercased name -> category doc, avoids a query per row
  const created = [];
  const errors = [];

  for (let i = 0; i < rows.length; i += 1) {
    const rowNumber = i + 2; // +1 for 0-index, +1 for the CSV header row
    const row = rows[i] || {};

    try {
      const { name, sku, description, category, price, quantity, minimumStockLevel, supplier, imageUrl } = row;

      if (!category || !String(category).trim()) {
        throw new Error('Category is required');
      }

      let categoryDoc;
      const categoryKey = String(category).trim().toLowerCase();
      if (categoryCache.has(categoryKey)) {
        categoryDoc = categoryCache.get(categoryKey);
      } else if (mongoose.Types.ObjectId.isValid(category)) {
        categoryDoc = await Category.findById(category);
      } else {
        categoryDoc = await Category.findOne({ name: { $regex: `^${categoryKey}$`, $options: 'i' } });
        if (!categoryDoc) {
          categoryDoc = await Category.create({ name: String(category).trim() });
        }
      }
      if (!categoryDoc) throw new Error('Category does not exist');
      categoryCache.set(categoryKey, categoryDoc);

      const errorsForRow = validateProductInput({ name, sku, category: categoryDoc._id, price, quantity, minimumStockLevel });
      if (errorsForRow.length > 0) throw new Error(errorsForRow[0]);

      const normalizedSku = String(sku).trim().toUpperCase();
      const existingSku = await Product.findOne({ sku: normalizedSku });
      if (existingSku) throw new Error(`SKU "${normalizedSku}" already exists`);

      const product = new Product({
        name,
        sku,
        description: description || '',
        category: categoryDoc._id,
        price: Number(price),
        quantity: Number(quantity) || 0,
        minimumStockLevel: Number(minimumStockLevel) || 0,
        supplier: supplier || '',
        imageUrl: imageUrl || '',
      });
      await product.save();
      created.push(product);
    } catch (err) {
      errors.push({ row: rowNumber, name: row.name || '(unnamed)', message: err.message });
    }
  }

  res.status(errors.length > 0 && created.length === 0 ? 422 : 201).json({
    success: created.length > 0,
    message: `${created.length} product(s) imported${errors.length ? `, ${errors.length} row(s) failed` : ''}`,
    data: { createdCount: created.length, errors },
  });
});
