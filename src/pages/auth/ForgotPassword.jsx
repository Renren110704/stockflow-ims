import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { Button, Typography, Alert, Link } from '@mui/material';
import useAuth from '../../hooks/useAuth';
import AuthLayout from '../../components/auth/AuthLayout';
import AuthField from '../../components/auth/AuthField';
import OtpVerification from '../../components/auth/OtpVerification';
import PasswordStrength from '../../components/auth/PasswordStrength';
import { useAuthColors } from '../../components/auth/authTokens';
import { evaluatePassword } from '../../utils/passwordStrength';

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

// Forgot password, in two steps:
//   1. 'email'  - enter the account email; a 6-digit code is emailed
//   2. 'reset'  - enter the code and a new password together
export default function ForgotPassword() {
  const { forgotPassword, resetPassword } = useAuth();
  const navigate = useNavigate();
  const colors = useAuthColors();

  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [passwords, setPasswords] = useState({ newPassword: '', confirmNewPassword: '' });
  const [resendCooldown, setResendCooldown] = useState(60);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await forgotPassword(trimmed);
      setEmail(trimmed);
      setResendCooldown(res?.data?.resendAfterSeconds ?? 60);
      setStep('reset');
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async (otp) => {
    await resetPassword(email, otp, passwords.newPassword, passwords.confirmNewPassword);
    navigate('/login', { state: { passwordReset: true, email } });
  };

  const handlePasswordChange = (e) => {
    setPasswords({ ...passwords, [e.target.name]: e.target.value });
  };

  const mismatch =
    passwords.confirmNewPassword.length > 0 &&
    passwords.newPassword !== passwords.confirmNewPassword;
  const passwordsValid =
    evaluatePassword(passwords.newPassword).isValid &&
    passwords.newPassword === passwords.confirmNewPassword;

  if (step === 'reset') {
    return (
      <AuthLayout title="Reset your password">
        <OtpVerification
          email={email}
          initialCooldown={resendCooldown}
          submitLabel="Reset password"
          submitDisabled={!passwordsValid}
          onVerify={handleReset}
          onResend={() => forgotPassword(email)}
          onBack={() => {
            setStep('email');
            setError('');
          }}
        >
          <AuthField
            label="New password"
            name="newPassword"
            type="password"
            placeholder="Enter a new password"
            autoComplete="new-password"
            value={passwords.newPassword}
            onChange={handlePasswordChange}
          />
          <PasswordStrength password={passwords.newPassword} twoColumns />
          <AuthField
            label="Confirm new password"
            name="confirmNewPassword"
            type="password"
            placeholder="Re-enter your new password"
            autoComplete="new-password"
            error={mismatch}
            helperText={mismatch ? 'Passwords do not match' : undefined}
            value={passwords.confirmNewPassword}
            onChange={handlePasswordChange}
          />
        </OtpVerification>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a 6-digit code to reset it."
    >
      {error && (
        <Alert severity="error" className="mb-4">
          {error}
        </Alert>
      )}

      <form onSubmit={handleEmailSubmit} noValidate>
        <AuthField
          label="Email"
          name="email"
          type="email"
          placeholder="Enter your email"
          autoComplete="email"
          autoFocus
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button
          type="submit"
          variant="contained"
          fullWidth
          disabled={submitting}
          sx={{
            mt: 1,
            height: 52,
            borderRadius: '10px',
            fontSize: 15,
            fontWeight: 500,
            bgcolor: colors.accent,
            '&:hover': { bgcolor: colors.accentHover },
          }}
        >
          {submitting ? 'Sending code…' : 'Send reset code'}
        </Button>
      </form>

      <Typography sx={{ mt: 3, textAlign: 'center', fontSize: 12.5, color: 'text.secondary' }}>
        Remembered it?{' '}
        <Link
          component={RouterLink}
          to="/login"
          underline="none"
          sx={{ fontWeight: 600, color: colors.link }}
        >
          Back to log in
        </Link>
      </Typography>
    </AuthLayout>
  );
}
