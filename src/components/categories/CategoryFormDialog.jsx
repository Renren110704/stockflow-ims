import { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Alert, Box } from '@mui/material';

const EMPTY_FORM = { name: '', description: '' };

export default function CategoryFormDialog({ open, category, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(category ? { name: category.name, description: category.description || '' } : EMPTY_FORM);
      setError('');
    }
  }, [open, category]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Category name is required');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onSave(form);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save category');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle className="font-semibold">{category ? 'Edit Category' : 'Add Category'}</DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent className="flex flex-col gap-1">
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Name"
            fullWidth
            required
            autoFocus
            margin="dense"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <TextField
            label="Description"
            fullWidth
            multiline
            minRows={2}
            margin="dense"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </DialogContent>
        <DialogActions className="px-6 pb-4">
          <Button onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
