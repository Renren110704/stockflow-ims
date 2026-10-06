import { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, TextField, MenuItem, Button, Alert } from '@mui/material';
import locationService from '../../services/locationService';

// Confirms receiving a PO and lets the user override its default
// put-away location for this particular delivery.
export default function ReceivePODialog({ open, order, onCancel, onConfirm }) {
  const [locations, setLocations] = useState([]);
  const [location, setLocation] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    setLocation(order?.location?._id || '');
    locationService
      .getLocations()
      .then((res) => setLocations(res.data))
      .catch(() => setLocations([]));
  }, [open, order]);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError('');
    try {
      await onConfirm(location || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to receive order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="xs">
      <DialogTitle className="font-semibold">Receive {order?.poNumber}</DialogTitle>
      <DialogContent className="flex flex-col gap-3">
        <DialogContentText>
          This adds every item's quantity to stock and logs a Stock In transaction for each.
        </DialogContentText>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField select fullWidth label="Put away at" value={location} onChange={(e) => setLocation(e.target.value)}>
          <MenuItem value="">No specific location</MenuItem>
          {locations.map((l) => (
            <MenuItem key={l._id} value={l._id}>
              {l.name}
            </MenuItem>
          ))}
        </TextField>
      </DialogContent>
      <DialogActions className="px-6 pb-4">
        <Button onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={handleConfirm} variant="contained" disabled={submitting}>
          {submitting ? 'Receiving…' : 'Receive order'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
