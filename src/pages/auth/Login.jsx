import { useState } from 'react';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { Button, Typography, Alert, Link } from '@mui/material';
import useAuth from '../../hooks/useAuth';
import AuthLayout from '../../components/auth/AuthLayout';
import AuthField from '../../components/auth/AuthField';
import SocialLogin from '../../components/auth/SocialLogin';
import { useAuthColors } from '../../components/auth/authTokens';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const colors = useAuthColors();
  // Set by Register after a successful email verification, or by
  // ForgotPassword after a successful reset.
  const justVerified = Boolean(location.state?.verified);
  const justReset = Boolean(location.state?.passwordReset);
  const [form, setForm] = useState({ email: location.state?.email || '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Log in to your account" subtitle="Welcome back — enter your details to continue.">
      {justVerified && !error && (
        <Alert severity="success" className="mb-4">
          Email verified! Your account is ready — log in to continue.
        </Alert>
      )}

      {justReset && !error && (
        <Alert severity="success" className="mb-4">
          Password reset successful — log in with your new password.
        </Alert>
      )}

      {error && (
        <Alert severity="error" className="mb-4">
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} noValidate>
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
          autoComplete="current-password"
          required
          value={form.password}
          onChange={handleChange}
        />
        <Typography sx={{ mt: -2, mb: 2.5, textAlign: 'right', fontSize: 13 }}>
          <Link
            component={RouterLink}
            to="/forgot-password"
            underline="none"
            sx={{ fontWeight: 600, color: colors.link }}
          >
            Forgot password?
          </Link>
        </Typography>
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
          {submitting ? 'Signing in…' : 'Log in'}
        </Button>
      </form>

      <SocialLogin />

      <Typography sx={{ mt: 3, textAlign: 'center', fontSize: 12.5, color: 'text.secondary' }}>
        Don&apos;t have an account?{' '}
        <Link
          component={RouterLink}
          to="/register"
          underline="none"
          sx={{ fontWeight: 600, color: colors.link }}
        >
          Register
        </Link>
      </Typography>
    </AuthLayout>
  );
}
