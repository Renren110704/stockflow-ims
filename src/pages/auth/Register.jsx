import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { Button, Typography, Alert, Link, Checkbox, Box } from '@mui/material';
import useAuth from '../../hooks/useAuth';
import AuthLayout from '../../components/auth/AuthLayout';
import AuthField from '../../components/auth/AuthField';
import OtpVerification from '../../components/auth/OtpVerification';
import PasswordStrength from '../../components/auth/PasswordStrength';
import TermsDialog from '../../components/auth/TermsDialog';
import SocialLogin from '../../components/auth/SocialLogin';
import { useAuthColors } from '../../components/auth/authTokens';
import { AUTH_REQUIRE_TERMS } from '../../config/authConfig';
import { evaluatePassword } from '../../utils/passwordStrength';

// Names may contain letters (any language), spaces, periods, apostrophes and
// hyphens - no digits or other symbols. Keep in sync with NAME_REGEX in
// server/validators/authValidators.js.
const NAME_DISALLOWED = /[^\p{L}\p{M}\s.'’-]/gu;
const NAME_VALID = /^[\p{L}\p{M}][\p{L}\p{M}\s.'’-]*$/u;

export default function Register() {
  const { register, verifyRegistrationOtp, resendRegistrationOtp } = useAuth();
  const navigate = useNavigate();
  const colors = useAuthColors();
  // 'form' = sign-up details, 'otp' = enter the emailed code
  const [step, setStep] = useState('form');
  const [pendingEmail, setPendingEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(60);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [agreed, setAgreed] = useState(false);
  // The checkbox stays locked until the Terms have been opened at least once.
  const [termsOpened, setTermsOpened] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Strip disallowed characters (including digits) as the user types or pastes.
    const next = name === 'name' ? value.replace(NAME_DISALLOWED, '') : value;
    setForm({ ...form, [name]: next });
  };

  const openTerms = () => {
    setTermsOpened(true);
    setTermsOpen(true);
  };

  // "I agree" inside the dialog closes it and ticks the checkbox.
  const agreeFromDialog = () => {
    setAgreed(true);
    setTermsOpen(false);
    setError('');
  };

  // Show the red "do not match" state as soon as the confirm box has text.
  const passwordsMismatch =
    form.confirmPassword.length > 0 && form.password !== form.confirmPassword;

  const validate = () => {
    if (!form.name || !form.email || !form.password || !form.confirmPassword) {
      return 'All fields are required.';
    }
    if (!NAME_VALID.test(form.name.trim())) {
      return 'Name can only contain letters, spaces, apostrophes, periods and hyphens.';
    }
    if (!evaluatePassword(form.password).isValid) {
      return 'Password does not meet all the requirements below.';
    }
    if (form.password !== form.confirmPassword) {
      return 'Passwords do not match.';
    }
    if (AUTH_REQUIRE_TERMS && !termsOpened) {
      return 'Please open and read the Terms & Conditions first.';
    }
    if (AUTH_REQUIRE_TERMS && !agreed) {
      return 'Please agree to the Terms & Conditions.';
    }
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await register(form.name, form.email, form.password, form.confirmPassword);
      setPendingEmail(res?.data?.email || form.email.trim().toLowerCase());
      setResendCooldown(res?.data?.resendAfterSeconds ?? 60);
      setStep('otp');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (otp) => {
    await verifyRegistrationOtp(pendingEmail, otp);
    navigate('/login', { state: { verified: true, email: pendingEmail } });
  };

  if (step === 'otp') {
    return (
      <AuthLayout title="Verify your email">
        <OtpVerification
          email={pendingEmail}
          initialCooldown={resendCooldown}
          onVerify={handleVerify}
          onResend={() => resendRegistrationOtp(pendingEmail)}
          onBack={() => {
            setStep('form');
            setError('');
          }}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create an account">
      {error && (
        <Alert severity="error" className="mb-4">
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <AuthField
          label="Name"
          name="name"
          placeholder="Enter your name"
          autoComplete="name"
          required
          value={form.name}
          onChange={handleChange}
        />
        <AuthField
          label="Email"
          name="email"
          type="email"
          placeholder="Enter your email"
          autoComplete="email"
          required
          value={form.email}
          onChange={handleChange}
        />
        <AuthField
          label="Password"
          name="password"
          type="password"
          placeholder="Enter your password"
          autoComplete="new-password"
          required
          value={form.password}
          onChange={handleChange}
        />
        <PasswordStrength password={form.password} twoColumns />
        <AuthField
          label="Confirm password"
          name="confirmPassword"
          type="password"
          placeholder="Re-enter your password"
          autoComplete="new-password"
          error={passwordsMismatch}
          helperText={passwordsMismatch ? 'Passwords do not match' : undefined}
          required
          value={form.confirmPassword}
          onChange={handleChange}
        />

        {AUTH_REQUIRE_TERMS && (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', ml: -0.5 }}>
              <Checkbox
                size="medium"
                checked={agreed}
                disabled={!termsOpened}
                onChange={(e) => setAgreed(e.target.checked)}
                inputProps={{ 'aria-label': 'I agree to the Terms and Conditions' }}
                sx={{ color: colors.inputBorder, '&.Mui-checked': { color: colors.accent } }}
              />
              <Typography sx={{ fontSize: 13.5, color: 'text.primary' }}>
                I agree to all the{' '}
                <Link
                  component="button"
                  type="button"
                  underline="always"
                  onClick={openTerms}
                  sx={{
                    fontSize: 13.5,
                    fontWeight: 600,
                    verticalAlign: 'baseline',
                    color: colors.link,
                  }}
                >
                  Terms &amp; Conditions
                </Link>
              </Typography>
            </Box>
            {!termsOpened && (
              <Typography sx={{ ml: 0.5, fontSize: 12, color: 'text.secondary' }}>
                Open the Terms &amp; Conditions to enable this checkbox.
              </Typography>
            )}
          </Box>
        )}

        <Button
          type="submit"
          variant="contained"
          fullWidth
          disabled={submitting}
          sx={{
            height: 52,
            borderRadius: '10px',
            fontSize: 15,
            fontWeight: 500,
            bgcolor: colors.accent,
            '&:hover': { bgcolor: colors.accentHover },
          }}
        >
          {submitting ? 'Sending code…' : 'Sign up'}
        </Button>
      </form>

      <TermsDialog open={termsOpen} onClose={() => setTermsOpen(false)} onAgree={agreeFromDialog} />

      <SocialLogin />

      <Typography sx={{ mt: 3, textAlign: 'center', fontSize: 12.5, color: 'text.secondary' }}>
        Already have an account?{' '}
        <Link
          component={RouterLink}
          to="/login"
          underline="none"
          sx={{ fontWeight: 600, color: colors.link }}
        >
          Log in
        </Link>
      </Typography>
    </AuthLayout>
  );
}
