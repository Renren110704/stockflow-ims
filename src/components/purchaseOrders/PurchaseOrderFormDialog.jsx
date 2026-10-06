import { useState, useEffect, useMemo } from 'react';
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
  IconButton,
  Typography,
  Autocomplete,
  Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import productService from '../../services/productService';
import locationService from '../../services/locationService';
import { formatCurrency } from '../../utils/currency';

const EMPTY_LINE = () => ({ key: crypto.randomUUID(), product: null, quantity: '', unitCost: '' });

// Creates or edits a Draft purchase order: pick a supplier, a set of
// product/quantity/unit-cost line items, and an optional put-away
// location for when it's later received.
export default function PurchaseOrderFormDialog({ open, order, prefill, onClose, onSave }) {
  const [supplier, setSupplier] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([EMPTY_LINE()]);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    productService
      .getProducts({ limit: 200 })
      .then((res) => setProducts(res.data))
      .catch(() => setProducts([]));
    locationService
      .getLocations()
      .then((res) => setLocations(res.data))
      .catch(() => setLocations([]));
  }, [open]);

  // Populate from an existing order (edit) or a reorder suggestion
  // (supplier + product/quantity already chosen, unit cost left blank).
  useEffect(() => {
    if (!open) return;
    if (order) {
      setSupplier(order.supplier);
      setExpectedDate(order.expectedDate ? order.expectedDate.slice(0, 10) : '');
      setLocation(order.location?._id || '');
      setNotes(order.notes || '');
      setLines(
        order.items.map((i) => ({
          key: crypto.randomUUID(),
          product: i.product,
          quantity: String(i.quantity),
          unitCost: i.unitCost ? String(i.unitCost) : '',
        }))
      );
    } else if (prefill) {
      setSupplier(prefill.supplier || '');
      setExpectedDate('');
      setLocation('');
      setNotes('');
      setLines(
        prefill.items.map((i) => ({
          key: crypto.randomUUID(),
          product: i.product,
          quantity: String(i.suggestedQuantity),
          unitCost: '',
        }))
      );
    } else {
      setSupplier('');
      setExpectedDate('');
      setLocation('');
      setNotes('');
      setLines([EMPTY_LINE()]);
    }
  }, [open, order, prefill]);

  const total = useMemo(
    () => lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0),
    [lines]
  );

  const updateLine = (key, patch) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const addLine = () => setLines((prev) => [...prev, EMPTY_LINE()]);
  const removeLine = (key) => setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!supplier.trim()) {
      setError('Supplier is required');
      return;
    }
    const items = lines.filter((l) => l.product);
    if (items.length === 0) {
      setError('Add at least one product');
      return;
    }
    if (items.some((l) => !l.quantity || Number(l.quantity) <= 0)) {
      setError('Every line needs a positive quantity');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await onSave({
        supplier: supplier.trim(),
        expectedDate: expectedDate || null,
        location: location || null,
        notes,
        items: items.map((l) => ({
          product: l.product._id,
          quantity: Number(l.quantity),
          unitCost: Number(l.unitCost) || 0,
        })),
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save purchase order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle className="font-semibold">{order ? `Edit ${order.poNumber}` : 'New Purchase Order'}</DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent className="flex flex-col gap-1">
          {error && <Alert severity="error">{error}</Alert>}

          <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-3">
            <TextField
              label="Supplier"
              required
              fullWidth
              margin="dense"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
            />
            <TextField
              label="Expected date"
              type="date"
              fullWidth
              margin="dense"
              InputLabelProps={{ shrink: true }}
              value={expectedDate}
              slotProps={{ inputLabel: { shrink: true } }} 
              onChange={(e) => setExpectedDate(e.target.value)}
            />
            <TextField
              select
              label="Put-away location"
              fullWidth
              margin="dense"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              helperText="Used when this order is received"
            >
              <MenuItem value="">No specific location</MenuItem>
              {locations.map((l) => (
                <MenuItem key={l._id} value={l._id}>
                  {l.name}
                </MenuItem>
              ))}
            </TextField>
          </div>

          <Divider className="my-2" />
          <Typography variant="subtitle2" fontWeight={700}>
            Items
          </Typography>

          {lines.map((line) => (
            <div key={line.key} className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
              <Autocomplete
                options={products}
                getOptionLabel={(p) => `${p.name} (${p.sku})`}
                value={line.product}
                onChange={(e, val) => updateLine(line.key, { product: val })}
                isOptionEqualToValue={(a, b) => a._id === b._id}
                className="min-w-55 flex-1"
                renderInput={(params) => <TextField {...params} label="Product" margin="dense" />}
              />
              <TextField
                label="Qty"
                type="number"
                margin="dense"
                inputProps={{ min: 1 }}
                className="w-24"
                value={line.quantity}
                onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
              />
              <TextField
                label="Unit cost (₱)"
                type="number"
                margin="dense"
                inputProps={{ min: 0, step: '0.01' }}
                className="w-28"
                value={line.unitCost}
                onChange={(e) => updateLine(line.key, { unitCost: e.target.value })}
              />
              <IconButton
                aria-label="Remove line"
                onClick={() => removeLine(line.key)}
                disabled={lines.length === 1}
                className="mt-2"
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </div>
          ))}

          <Button startIcon={<AddIcon />} onClick={addLine} className="self-start" size="small">
            Add item
          </Button>

          <Typography variant="body2" className="mt-2 text-right" fontWeight={600}>
            Total: {formatCurrency(total)}
          </Typography>

          <TextField
            label="Notes"
            fullWidth
            multiline
            minRows={2}
            margin="dense"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </DialogContent>
        <DialogActions className="px-6 pb-4">
          <Button onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={submitting}>
            {submitting ? 'Saving…' : order ? 'Save changes' : 'Create draft'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
