import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';
import { useAuthColors } from './authTokens';
import { TERMS_LAST_UPDATED, TERMS_SECTIONS } from '../../config/termsContent';

// The full Terms & Conditions, shown in a scrollable dialog.
//   onClose  -> user closed it without agreeing
//   onAgree  -> user pressed "I agree" (the page ticks its checkbox)
export default function TermsDialog({ open, onClose, onAgree }) {
  const colors = useAuthColors();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      scroll="paper"
      maxWidth="sm"
      fullWidth
      aria-labelledby="terms-dialog-title"
    >
      <DialogTitle id="terms-dialog-title" className="font-semibold">
        Terms &amp; Conditions
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          Last updated: {TERMS_LAST_UPDATED}
        </Typography>
        {TERMS_SECTIONS.map((section) => (
          <div key={section.title} className="mb-4">
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
              {section.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65 }}>
              {section.body}
            </Typography>
          </div>
        ))}
      </DialogContent>
      <DialogActions className="px-6 py-3">
        <Button onClick={onClose} color="inherit">
          Close
        </Button>
        <Button
          variant="contained"
          onClick={onAgree}
          sx={{ bgcolor: colors.accent, '&:hover': { bgcolor: colors.accentHover } }}
        >
          I agree
        </Button>
      </DialogActions>
    </Dialog>
  );
}
