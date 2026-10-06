import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Button,
  Alert,
  Box,
  FormControlLabel,
  Switch,
  Typography,
  CircularProgress,
} from '@mui/material';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import productService from '../../services/productService';
import {
  PRODUCT_IMAGE_ACCEPT,
  validateProductImageFile,
  uploadProductImage,
} from '../../utils/productImageUpload';

const EMPTY_FORM = {
  name: '',
  sku: '',
  description: '',
  category: '',
  price: '',
  quantity: '',
  minimumStockLevel: '',
  supplier: '',
  imageUrl: '',
};

/**
 * Add / Edit product modal. Mirrors CategoryFormDialog: the parent owns the
 * actual create/update call (onSave), this component owns form state,
 * validation and inline error display.
 *
 * `product` = null  -> Add mode
 * `product` = {...} -> Edit mode (fresh copy is fetched on open so the form
 *                      never depends on which fields the list endpoint returns)
 */
export default function ProductFormDialog({ open, product, categories = [], onClose, onSave }) {
  const isEdit = Boolean(product);

  const [form, setForm] = useState(EMPTY_FORM);
  const [discontinued, setDiscontinued] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Image chosen in this dialog but not uploaded yet. It is uploaded to
  // Cloudinary when the user clicks Save, so cancelling never leaves an
  // unused file behind.
  const fileInputRef = useRef(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    if (!open) return;

    setError('');
    setForm(EMPTY_FORM);
    setDiscontinued(false);
    setPendingFile(null);

    if (!product) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    productService
      .getProduct(product._id)
      .then((res) => {
        if (cancelled) return;
        const p = res.data;
        setForm({
          name: p.name,
          sku: p.sku,
          description: p.description || '',
          category: p.category?._id || p.category || '',
          price: p.price,
          quantity: p.quantity,
          minimumStockLevel: p.minimumStockLevel,
          supplier: p.supplier || '',
          imageUrl: p.imageUrl || '',
        });
        setDiscontinued(p.status === 'Discontinued');
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || 'Failed to load product.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, product]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Local preview of the chosen file (revoked when it changes/unmounts).
  useEffect(() => {
    if (!pendingFile) {
      setPreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(pendingFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  const shownImage = previewUrl || form.imageUrl;

  const openFilePicker = () => {
    if (!submitting) fileInputRef.current?.click();
  };

  const handleImageSelected = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // lets the user pick the same file again later
    if (!file) return;
    const problem = validateProductImageFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setPendingFile(file);
  };

  const handleImageRemove = () => {
    setPendingFile(null);
    setForm((prev) => ({ ...prev, imageUrl: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name.trim() || !form.sku.trim() || !form.category) {
      setError('Product name, SKU and category are required');
      return;
    }
    if (form.price === '' || form.quantity === '' || form.minimumStockLevel === '') {
      setError('Price, quantity and minimum stock level are required');
      return;
    }

    setSubmitting(true);
    setError('');

    // Upload a newly chosen image first. If saving the product then fails
    // (e.g. duplicate SKU), the uploaded URL is kept in the form so a retry
    // reuses it instead of uploading the same file again.
    let imageUrl = form.imageUrl;
    if (pendingFile) {
      try {
        imageUrl = await uploadProductImage(pendingFile);
        setForm((prev) => ({ ...prev, imageUrl }));
        setPendingFile(null);
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to upload image');
        setSubmitting(false);
        return;
      }
    }

    const payload = {
      ...form,
      imageUrl,
      price: Number(form.price),
      quantity: Number(form.quantity),
      minimumStockLevel: Number(form.minimumStockLevel),
      status: discontinued ? 'Discontinued' : 'In Stock', // backend re-derives unless Discontinued
    };

    try {
      await onSave(payload);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save product');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle className="font-semibold">{isEdit ? 'Edit Product' : 'Add Product'}</DialogTitle>

      {loading ? (
        <DialogContent className="flex justify-center py-10">
          <CircularProgress />
        </DialogContent>
      ) : (
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <DialogContent className="flex flex-col gap-1">
            {error && <Alert severity="error">{error}</Alert>}

            <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-12">
              <div className="sm:col-span-8">
                <TextField
                  label="Product name"
                  name="name"
                  fullWidth
                  required
                  autoFocus
                  margin="dense"
                  value={form.name}
                  onChange={handleChange}
                />
              </div>
              <div className="sm:col-span-4">
                <TextField
                  label="SKU"
                  name="sku"
                  fullWidth
                  required
                  margin="dense"
                  value={form.sku}
                  onChange={handleChange}
                />
              </div>

              <div className="sm:col-span-12">
                <TextField
                  label="Description"
                  name="description"
                  fullWidth
                  multiline
                  minRows={2}
                  margin="dense"
                  value={form.description}
                  onChange={handleChange}
                />
              </div>

              <div className="sm:col-span-6">
                <TextField
                  select
                  label="Category"
                  name="category"
                  fullWidth
                  required
                  margin="dense"
                  value={form.category}
                  onChange={handleChange}
                >
                  {categories.map((c) => (
                    <MenuItem key={c._id} value={c._id}>
                      {c.name}
                    </MenuItem>
                  ))}
                </TextField>
              </div>
              <div className="sm:col-span-6">
                <TextField
                  label="Supplier"
                  name="supplier"
                  fullWidth
                  margin="dense"
                  value={form.supplier}
                  onChange={handleChange}
                />
              </div>

              <div className="sm:col-span-4">
                <TextField
                  label="Price (₱)"
                  name="price"
                  type="number"
                  fullWidth
                  required
                  margin="dense"
                  inputProps={{ min: 0, step: '0.01' }}
                  value={form.price}
                  onChange={handleChange}
                />
              </div>
              <div className="sm:col-span-4">
                <TextField
                  label="Quantity"
                  name="quantity"
                  type="number"
                  fullWidth
                  required
                  margin="dense"
                  inputProps={{ min: 0 }}
                  value={form.quantity}
                  onChange={handleChange}
                />
              </div>
              <div className="sm:col-span-4">
                <TextField
                  label="Min. stock level"
                  name="minimumStockLevel"
                  type="number"
                  fullWidth
                  required
                  margin="dense"
                  inputProps={{ min: 0 }}
                  value={form.minimumStockLevel}
                  onChange={handleChange}
                />
              </div>
              <div className="sm:col-span-12">
                <Typography variant="caption" color="text.secondary">
                  For routine stock movements, prefer the Transactions page.
                </Typography>
              </div>

              <div className="sm:col-span-12">
                <Typography variant="body2" fontWeight={600} sx={{ mt: 1, mb: 0.75 }}>
                  Product image
                </Typography>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={PRODUCT_IMAGE_ACCEPT}
                  hidden
                  onChange={handleImageSelected}
                />
                <Box
                  role="button"
                  tabIndex={0}
                  aria-label={shownImage ? 'Change product image' : 'Upload product image'}
                  onClick={openFilePicker}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openFilePicker();
                    }
                  }}
                  sx={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 180,
                    overflow: 'hidden',
                    borderRadius: '12px',
                    border: '2px dashed',
                    borderColor: 'divider',
                    bgcolor: 'action.hover',
                    cursor: submitting ? 'default' : 'pointer',
                    '&:hover, &:focus-visible': { borderColor: 'primary.main', outline: 'none' },
                  }}
                >
                  {shownImage ? (
                    <img
                      src={shownImage}
                      alt="Product preview"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 px-4 text-center">
                      <CloudUploadOutlinedIcon sx={{ fontSize: 32, color: 'text.secondary' }} />
                      <Typography variant="body2" fontWeight={600}>
                        Click to upload an image
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        JPG, PNG or WebP, up to 5 MB
                      </Typography>
                    </div>
                  )}
                  {submitting && pendingFile && (
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
                    >
                      <CircularProgress size={30} sx={{ color: '#fff' }} />
                    </div>
                  )}
                </Box>
                {shownImage && (
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                    <Typography variant="caption" color="text.secondary">
                      {pendingFile
                        ? 'New image — it will be uploaded when you click Save.'
                        : 'Click the image to replace it.'}
                    </Typography>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<DeleteOutlineRoundedIcon />}
                      disabled={submitting}
                      onClick={handleImageRemove}
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </div>

              {isEdit && (
                <div className="sm:col-span-12">
                  <FormControlLabel
                    control={
                      <Switch checked={discontinued} onChange={(e) => setDiscontinued(e.target.checked)} />
                    }
                    label="Discontinued"
                  />
                  <Typography variant="body2" color="text.secondary">
                    When off, stock status is calculated automatically from quantity vs. minimum stock level.
                  </Typography>
                </div>
              )}
            </div>
          </DialogContent>
          <DialogActions className="px-6 pb-4">
            <Button onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? (pendingFile ? 'Uploading image…' : 'Saving…') : 'Save'}
            </Button>
          </DialogActions>
        </Box>
      )}
    </Dialog>
  );
}
