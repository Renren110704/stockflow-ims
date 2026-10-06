import { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, TextField, MenuItem, Button, Alert } from '@mui/material';

// Reassigns a batch of selected products (by id) to a single target
// category in one request. Distinct from categories/ReassignCategoryDialog,
// which handles the "category is being deleted, move its products first"
// flow — this one is a deliberate bulk edit the user initiated themselves.
export default function BulkCategoryDialog({ open, count, categories, onCancel, onConfirm }) {
  const [target, setTarget] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    if (!target) {
      setError('Please choose a category');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onConfirm(target);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reassign products');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="xs">
      <DialogTitle className="font-semibold">Move {count} product(s)</DialogTitle>
      <DialogContent className="flex flex-col gap-3">
        <DialogContentText>Choose the category to move the selected products into.</DialogContentText>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField select fullWidth label="Category" value={target} onChange={(e) => setTarget(e.target.value)}>
          {categories.map((c) => (
            <MenuItem key={c._id} value={c._id}>
              {c.name}
            </MenuItem>
          ))}
        </TextField>
      </DialogContent>
      <DialogActions className="px-6 pb-4">
        <Button onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={handleConfirm} variant="contained" disabled={submitting}>
          {submitting ? 'Moving…' : 'Move products'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
