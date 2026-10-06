import { useState, useEffect } from 'react';
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
  ToggleButtonGroup,
  ToggleButton,
  Autocomplete,
} from '@mui/material';
import productService from '../../services/productService';
import locationService from '../../services/locationService';

const EMPTY_FORM = {
  product: null,
  type: 'STOCK_IN',
  quantity: '',
  reason: '',
  supplier: '',
  referenceNumber: '',
  notes: '',
  location: '',
  from: '',
  to: '',
};

export default function TransactionFormDialog({ open, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [stock, setStock] = useState(null); // per-location breakdown of the chosen product
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY_FORM);
    setStock(null);
    setError('');
    // Enough for a class-project product catalog; a searchable server-side
    // lookup would replace this if the catalog grew much larger.
    productService
      .getProducts({ limit: 100 })
      .then((res) => setProducts(res.data))
      .catch(() => setProducts([]));
    locationService
      .getLocations()
      .then((res) => setLocations(res.data))
      .catch(() => setLocations([]));
  }, [open]);

  // Show where the chosen product's stock currently sits, so people can
  // see what's available before picking a location / transfer source.
  useEffect(() => {
    if (!form.product) {
      setStock(null);
      return;
    }
    productService
      .getProductStock(form.product._id)
      .then((res) => setStock(res.data))
      .catch(() => setStock(null));
  }, [form.product]);

  const isTransfer = form.type === 'TRANSFER';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.product) {
      setError('Please select a product');
      return;
    }
    if (!form.quantity || Number(form.quantity) <= 0) {
      setError('Quantity must be a positive number');
      return;
    }
    if (isTransfer && form.from === form.to) {
      setError('Choose two different locations');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      if (isTransfer) {
        await onSave({
          type: 'TRANSFER',
          product: form.product._id,
          from: form.from || null,
          to: form.to || null,
          quantity: Number(form.quantity),
          notes: form.notes,
        });
      } else {
        await onSave({
          product: form.product._id,
          type: form.type,
          quantity: Number(form.quantity),
          reason: form.reason,
          supplier: form.supplier,
          referenceNumber: form.referenceNumber,
          notes: form.notes,
          location: form.location || null,
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to record transaction');
    } finally {
      setSubmitting(false);
    }
  };

  const locationOptions = (emptyLabel) => [
    <MenuItem key="none" value="">
      {emptyLabel}
    </MenuItem>,
    ...locations.map((l) => (
      <MenuItem key={l._id} value={l._id}>
        {l.name}
      </MenuItem>
    )),
  ];

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle className="font-semibold">Record Inventory Transaction</DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent className="flex flex-col gap-1">
          {error && <Alert severity="error">{error}</Alert>}

          <ToggleButtonGroup
            exclusive
            fullWidth
            value={form.type}
            onChange={(e, val) => val && setForm({ ...form, type: val })}
            className="mb-2"
          >
            <ToggleButton value="STOCK_IN">Stock In</ToggleButton>
            <ToggleButton value="STOCK_OUT">Stock Out</ToggleButton>
            <ToggleButton value="TRANSFER" disabled={locations.length === 0}>
              Transfer
            </ToggleButton>
          </ToggleButtonGroup>

          <Autocomplete
            options={products}
            getOptionLabel={(p) => `${p.name} (${p.sku})`}
            value={form.product}
            onChange={(e, val) => setForm({ ...form, product: val })}
            renderInput={(params) => <TextField {...params} label="Product" required margin="dense" />}
            isOptionEqualToValue={(a, b) => a._id === b._id}
          />

          {form.product && (
            <Alert severity="info" className="my-1">
              Current stock: {form.product.quantity}
              {stock && stock.levels.length > 0 && (
                <>
                  {' '}
                  — {stock.levels.map((l) => `${l.location?.name || 'Location'}: ${l.quantity}`).join(', ')}
                  {stock.unassigned > 0 && `, Unassigned: ${stock.unassigned}`}
                </>
              )}
            </Alert>
          )}

          <TextField
            label="Quantity"
            type="number"
            fullWidth
            required
            margin="dense"
            inputProps={{ min: 1 }}
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
          />

          {isTransfer ? (
            <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
              <TextField
                select
                label="From"
                fullWidth
                margin="dense"
                value={form.from}
                onChange={(e) => setForm({ ...form, from: e.target.value })}
              >
                {locationOptions('Unassigned')}
              </TextField>
              <TextField
                select
                label="To"
                fullWidth
                margin="dense"
                value={form.to}
                onChange={(e) => setForm({ ...form, to: e.target.value })}
              >
                {locationOptions('Unassigned')}
              </TextField>
            </div>
          ) : (
            <>
              {locations.length > 0 && (
                <TextField
                  select
                  label="Location"
                  fullWidth
                  margin="dense"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  helperText="Optional — leave blank if you don't track this movement by location"
                >
                  {locationOptions('No specific location')}
                </TextField>
              )}

              {form.type === 'STOCK_IN' ? (
                <TextField
                  label="Supplier"
                  fullWidth
                  margin="dense"
                  value={form.supplier}
                  onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                />
              ) : (
                <TextField
                  select
                  label="Reason"
                  fullWidth
                  margin="dense"
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                >
                  {['Sold', 'Damaged', 'Returned to supplier', 'Other'].map((r) => (
                    <MenuItem key={r} value={r}>
                      {r}
                    </MenuItem>
                  ))}
                </TextField>
              )}

              <TextField
                label="Reference number"
                fullWidth
                margin="dense"
                value={form.referenceNumber}
                onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
              />
            </>
          )}

          <TextField
            label="Notes"
            fullWidth
            multiline
            minRows={2}
            margin="dense"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </DialogContent>
        <DialogActions className="px-6 pb-4">
          <Button onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={submitting}>
            {submitting ? 'Saving…' : 'Record'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
