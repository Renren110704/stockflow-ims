import { useEffect, useState } from 'react';
import { Button, Typography, Alert, Link, TextField } from '@mui/material';
import { useAuthColors } from './authTokens';

const OTP_LENGTH = 6;

// Second step of sign-up: the user types the 6-digit code emailed to them.
//
//   onVerify(otp)  -> Promise; should throw (axios error) on a wrong code
//   onResend()     -> Promise; resolves with the server response
//   onBack()       -> go back to the previous form (e.g. to fix a typo'd email)
//   children       -> optional extra fields rendered under the code box
//                     (the reset-password page puts the new-password fields here)
//   submitLabel / submitDisabled -> customise the submit button
export default function OtpVerification({
  email,
  onVerify,
  onResend,
  onBack,
  children,
  submitLabel = 'Verify & create account',
  submitDisabled = false,
  initialCooldown = 60,
}) {
  const colors = useAuthColors();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(initialCooldown);

  // Tick the resend countdown down once per second.
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleChange = (e) => {
    setOtp(e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (otp.length !== OTP_LENGTH) {
      setError(`Enter the ${OTP_LENGTH}-digit code.`);
      return;
    }
    setError('');
    setInfo('');
    setSubmitting(true);
    try {
      await onVerify(otp);
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
      setOtp('');
      setCooldown(res?.data?.resendAfterSeconds ?? 60);
      setInfo('A new code has been sent to your email.');
    } catch (err) {
      const data = err.response?.data;
      if (data?.retryAfter) setCooldown(data.retryAfter);
      setError(data?.message || 'Could not resend the code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      <Typography sx={{ mb: 3, fontSize: 14, color: 'text.secondary' }}>
        We sent a 6-digit code to{' '}
        <Typography component="span" sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary' }}>
          {email}
        </Typography>
        . It expires in 10 minutes.
      </Typography>

      {error && (
        <Alert severity="error" className="mb-4">
          {error}
        </Alert>
      )}
      {info && (
        <Alert severity="success" className="mb-4">
          {info}
        </Alert>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <Typography
          component="label"
          htmlFor="otp-input"
          sx={{ display: 'block', mb: 1, fontSize: 14, fontWeight: 500, color: 'text.primary' }}
        >
          Verification code
        </Typography>
        <TextField
          id="otp-input"
          name="otp"
          fullWidth
          autoFocus
          autoComplete="one-time-code"
          placeholder="000000"
          value={otp}
          onChange={handleChange}
          slotProps={{
            htmlInput: {
              inputMode: 'numeric',
              maxLength: OTP_LENGTH,
              'aria-label': 'Verification code',
              style: { textAlign: 'center', letterSpacing: '0.5em', fontSize: 22, fontWeight: 600 },
            },
          }}
          sx={{
            mb: 3,
            '& .MuiOutlinedInput-root': {
              borderRadius: '10px',
              backgroundColor: colors.inputBg,
              '& fieldset': { borderColor: colors.inputBorder },
              '&:hover fieldset': { borderColor: colors.inputBorder },
              '&.Mui-focused fieldset': { borderColor: colors.accent, borderWidth: 1 },
            },
            '& .MuiOutlinedInput-input': { padding: '14px 18px' },
          }}
        />

        {children}

        <Button
          type="submit"
          variant="contained"
          fullWidth
          disabled={submitting || otp.length !== OTP_LENGTH || submitDisabled}
          sx={{
            height: 52,
            borderRadius: '10px',
            fontSize: 15,
            fontWeight: 500,
            bgcolor: colors.accent,
            '&:hover': { bgcolor: colors.accentHover },
          }}
        >
          {submitting ? 'Verifying…' : submitLabel}
        </Button>
      </form>

      <Typography sx={{ mt: 3, textAlign: 'center', fontSize: 13, color: 'text.secondary' }}>
        Didn&apos;t get it?{' '}
        {cooldown > 0 ? (
          <span>Resend in {cooldown}s</span>
        ) : (
          <Link
            component="button"
            type="button"
            underline="none"
            disabled={resending}
            onClick={handleResend}
            sx={{ fontWeight: 600, fontSize: 13, verticalAlign: 'baseline', color: colors.link }}
          >
            {resending ? 'Sending…' : 'Resend code'}
          </Link>
        )}
      </Typography>

      <Typography sx={{ mt: 1, textAlign: 'center', fontSize: 12.5, color: 'text.secondary' }}>
        <Link
          component="button"
          type="button"
          underline="none"
          onClick={onBack}
          sx={{ fontWeight: 600, fontSize: 12.5, verticalAlign: 'baseline', color: colors.link }}
        >
          Use a different email
        </Link>
      </Typography>
    </>
  );
}
