import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Alert,
  Link,
} from '@mui/material';

const OTP_LENGTH = 6;
const digitsOnly = (value) => value.replace(/\D/g, '').slice(0, OTP_LENGTH);

// Asks for the two codes needed to change the account email: one emailed to
// the CURRENT address and one to the NEW address.
//
//   onConfirm(currentOtp, newOtp) -> Promise; throws (axios error) if wrong
//   onResend()                    -> Promise resolving with the server response
//   onClose()                     -> user cancelled
export default function ChangeEmailDialog({
  open,
  newEmail,
  currentEmailMasked,
  initialCooldown = 60,
  onConfirm,
  onResend,
  onClose,
}) {
  const [currentOtp, setCurrentOtp] = useState('');
  const [newOtp, setNewOtp] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(initialCooldown);

  // Start fresh every time the dialog is (re)opened.
  useEffect(() => {
    if (open) {
      setCurrentOtp('');
      setNewOtp('');
      setError('');
      setInfo('');
      setSubmitting(false);
      setCooldown(initialCooldown);
    }
  }, [open, initialCooldown]);

  // Resend countdown.
  useEffect(() => {
    if (!open || cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [open, cooldown]);

  const canSubmit = currentOtp.length === OTP_LENGTH && newOtp.length === OTP_LENGTH;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    setInfo('');
    setSubmitting(true);
    try {
      await onConfirm(currentOtp, newOtp);
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed. Please try again.');
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setInfo('');
    setResending(true);
    try {
      const res = await onResend();
      setCurrentOtp('');
      setNewOtp('');
      setCooldown(res?.data?.resendAfterSeconds ?? 60);
      setInfo('New codes have been sent to both addresses.');
    } catch (err) {
      const data = err.response?.data;
      if (data?.retryAfter) setCooldown(data.retryAfter);
      setError(data?.message || 'Could not resend the codes. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const codeField = (props) => (
    <TextField
      fullWidth
      margin="dense"
      autoComplete="one-time-code"
      placeholder="000000"
      slotProps={{
        htmlInput: {
          inputMode: 'numeric',
          maxLength: OTP_LENGTH,
          style: { letterSpacing: '0.4em', fontWeight: 600 },
        },
      }}
      {...props}
    />
  );

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} fullWidth maxWidth="xs">
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle>Verify email change</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            To protect your account we sent a 6-digit code to{' '}
            <strong>{currentEmailMasked}</strong> (your current email) and a different code to{' '}
            <strong>{newEmail}</strong> (your new email). Enter both to confirm. They expire in 10
            minutes.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 1 }}>
              {error}
            </Alert>
          )}
          {info && (
            <Alert severity="success" sx={{ mb: 1 }}>
              {info}
            </Alert>
          )}

          {codeField({
            label: 'Code from your current email',
            name: 'currentOtp',
            autoFocus: true,
            value: currentOtp,
            onChange: (e) => setCurrentOtp(digitsOnly(e.target.value)),
          })}
          {codeField({
            label: 'Code from your new email',
            name: 'newOtp',
            value: newOtp,
            onChange: (e) => setNewOtp(digitsOnly(e.target.value)),
          })}

          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            Didn&apos;t get them?{' '}
            {cooldown > 0 ? (
              <span>Resend in {cooldown}s</span>
            ) : (
              <Link
                component="button"
                type="button"
                underline="hover"
                disabled={resending}
                onClick={handleResend}
                sx={{ verticalAlign: 'baseline', fontWeight: 600 }}
              >
                {resending ? 'Sending…' : 'Resend codes'}
              </Link>
            )}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={!canSubmit || submitting}>
            {submitting ? 'Verifying…' : 'Confirm change'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
