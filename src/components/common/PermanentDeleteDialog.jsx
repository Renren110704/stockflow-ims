import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  TextField,
  Alert,
} from '@mui/material';

const CONFIRM_WORD = 'DELETE';

// Confirmation for an IRREVERSIBLE delete. The admin has to type DELETE
// before the button enables, so it can't be triggered by a stray click.
//   itemName    - shown in the warning (e.g. the product's name)
//   description - what will / won't happen, in plain words
export default function PermanentDeleteDialog({
  open,
  title = 'Delete permanently?',
  itemName,
  description,
  onConfirm,
  onCancel,
  loading = false,
}) {
  const [typed, setTyped] = useState('');

  // Start empty every time the dialog opens.
  useEffect(() => {
    if (open) setTyped('');
  }, [open]);

  const canConfirm = typed.trim() === CONFIRM_WORD && !loading;

  return (
    <Dialog open={open} onClose={loading ? undefined : onCancel} maxWidth="xs" fullWidth>
      <DialogTitle className="font-semibold">{title}</DialogTitle>
      <DialogContent>
        <Alert severity="error" sx={{ mb: 2 }}>
          <strong>{itemName}</strong> will be erased for good. This cannot be undone.
        </Alert>
        {description && <DialogContentText sx={{ mb: 2 }}>{description}</DialogContentText>}
        <TextField
          autoFocus
          fullWidth
          size="small"
          label={`Type ${CONFIRM_WORD} to confirm`}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
        />
      </DialogContent>
      <DialogActions className="px-6 pb-4">
        <Button onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={onConfirm} color="error" variant="contained" disabled={!canConfirm}>
          {loading ? 'Deleting…' : 'Delete permanently'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
