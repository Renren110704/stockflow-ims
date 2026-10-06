import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, TextField, MenuItem, Button, Alert } from '@mui/material';
import { useState } from 'react';

export default function ReassignCategoryDialog({ open, category, productCount, categories, onCancel, onConfirm }) {
  const [target, setTarget] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const otherCategories = categories.filter((c) => c._id !== category?._id);

  const handleConfirm = async () => {
    if (!target) {
      setError('Please choose a category to move these products to');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onConfirm(target);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reassign and delete');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="xs">
      <DialogTitle className="font-semibold">Category still in use</DialogTitle>
      <DialogContent className="flex flex-col gap-3">
        <DialogContentText>
          {productCount} product(s) are still assigned to &quot;{category?.name}&quot;. Choose another category to
          move them to before deleting.
        </DialogContentText>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          select
          fullWidth
          label="Move products to"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        >
          {otherCategories.map((c) => (
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
        <Button onClick={handleConfirm} color="error" variant="contained" disabled={submitting}>
          {submitting ? 'Please wait…' : 'Reassign & Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
