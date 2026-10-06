import { useState, useEffect, useRef } from 'react';
import {
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  Divider,
  Chip,
  Avatar,
  CircularProgress,
} from '@mui/material';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import useAuth from '../../hooks/useAuth';
import userService from '../../services/userService';
import authService from '../../services/authService';
import PasswordStrength from '../../components/auth/PasswordStrength';
import ChangeEmailDialog from '../../components/users/ChangeEmailDialog';
import { evaluatePassword } from '../../utils/passwordStrength';
import { AVATAR_ACCEPT, validateAvatarFile, uploadAvatar } from '../../utils/avatarUpload';

export default function Profile() {
  const { user, updateCurrentUser } = useAuth();

  const fileInputRef = useRef(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  const [profileForm, setProfileForm] = useState({ name: '', email: '' });
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  // Set while an email change is waiting for its two verification codes.
  const [emailChange, setEmailChange] = useState(null);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (user) setProfileForm({ name: user.name, email: user.email });
  }, [user]);

  const handleAvatarSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // lets the user pick the same file again later
    if (!file) return;
    setAvatarError('');
    const problem = validateAvatarFile(file);
    if (problem) {
      setAvatarError(problem);
      return;
    }
    setAvatarBusy(true);
    try {
      const updated = await uploadAvatar(file);
      updateCurrentUser({ avatar: updated.avatar });
    } catch (err) {
      setAvatarError(err.response?.data?.message || err.message || 'Failed to upload picture.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleAvatarRemove = async () => {
    setAvatarError('');
    setAvatarBusy(true);
    try {
      await authService.removeAvatar();
      updateCurrentUser({ avatar: '' });
    } catch (err) {
      setAvatarError(err.response?.data?.message || 'Failed to remove picture.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const initials = (user?.name || '?')
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Show the red "do not match" state as soon as the confirm box has text.
  const passwordsMismatch =
    passwordForm.confirmNewPassword.length > 0 &&
    passwordForm.newPassword !== passwordForm.confirmNewPassword;

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    const newName = profileForm.name.trim();
    const newEmail = profileForm.email.trim().toLowerCase();
    const nameChanged = newName !== user.name;
    const emailChanged = newEmail !== user.email.toLowerCase();

    if (!nameChanged && !emailChanged) {
      setProfileSuccess('No changes to save.');
      return;
    }

    setSavingProfile(true);
    try {
      // The name is saved normally. The email is deliberately NOT sent to the
      // update endpoint: it can only change through the two-code verification.
      if (nameChanged) {
        const res = await userService.updateUser(user._id, { name: newName });
        updateCurrentUser({ name: res.data.name });
      }
      if (emailChanged) {
        const res = await authService.requestEmailChange(newEmail);
        setEmailChange({
          newEmail: res.data.newEmail,
          currentEmailMasked: res.data.currentEmailMasked,
          cooldown: res.data.resendAfterSeconds,
        });
      } else {
        setProfileSuccess('Profile updated.');
      }
    } catch (err) {
      setProfileError(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleEmailChangeConfirm = async (currentOtp, newOtp) => {
    const res = await authService.confirmEmailChange(currentOtp, newOtp);
    updateCurrentUser({ email: res.data.email });
    setEmailChange(null);
    setProfileSuccess('Email updated successfully.');
  };

  const handleEmailChangeClose = () => {
    setEmailChange(null);
    // Put the field back to the account's real email.
    setProfileForm((form) => ({ ...form, email: user.email }));
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!evaluatePassword(passwordForm.newPassword).isValid) {
      setPasswordError('New password does not meet all the requirements below.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setSavingPassword(true);
    try {
      await authService.changePassword(
        passwordForm.currentPassword,
        passwordForm.newPassword,
        passwordForm.confirmNewPassword
      );
      setPasswordSuccess('Password changed successfully.');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
    } catch (err) {
      setPasswordError(err.response?.data?.message || 'Failed to change password.');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Profile
      </Typography>
      <Chip label={user?.role} size="small" sx={{ mb: 2, textTransform: 'capitalize' }} />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      <Paper variant="outlined" className="rounded-2xl p-6">
        <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
          Account details
        </Typography>

        <div className="mb-5 flex flex-wrap items-center gap-4">
          <div className="relative">
            <Avatar
              src={user?.avatar || undefined}
              alt={user?.name}
              sx={{ width: 88, height: 88, fontSize: 30, fontWeight: 700, bgcolor: 'primary.main' }}
            >
              {initials}
            </Avatar>
            {avatarBusy && (
              <div
                className="absolute inset-0 flex items-center justify-center rounded-full"
                style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
              >
                <CircularProgress size={28} sx={{ color: '#fff' }} />
              </div>
            )}
          </div>
          <div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outlined"
                size="small"
                startIcon={<PhotoCameraRoundedIcon />}
                disabled={avatarBusy}
                onClick={() => fileInputRef.current?.click()}
              >
                {user?.avatar ? 'Change photo' : 'Upload photo'}
              </Button>
              {user?.avatar && (
                <Button
                  size="small"
                  color="error"
                  startIcon={<DeleteOutlineRoundedIcon />}
                  disabled={avatarBusy}
                  onClick={handleAvatarRemove}
                >
                  Remove
                </Button>
              )}
            </div>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
              JPG, PNG or WebP, up to 2 MB.
            </Typography>
            <input
              ref={fileInputRef}
              type="file"
              accept={AVATAR_ACCEPT}
              hidden
              onChange={handleAvatarSelected}
            />
          </div>
        </div>
        {avatarError && (
          <Alert severity="error" onClose={() => setAvatarError('')} className="mb-4">
            {avatarError}
          </Alert>
        )}
        {profileError && (
          <Alert severity="error" className="mb-4">
            {profileError}
          </Alert>
        )}
        {profileSuccess && (
          <Alert severity="success" className="mb-4">
            {profileSuccess}
          </Alert>
        )}
        <form onSubmit={handleProfileSubmit}>
          <div className="grid grid-cols-1 gap-4">
            <TextField
              label="Name"
              fullWidth
              required
              value={profileForm.name}
              onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
            />
            <TextField
              label="Email"
              type="email"
              fullWidth
              required
              helperText="Changing your email requires codes sent to both your current and new address."
              value={profileForm.email}
              onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
            />
          </div>
          <Button type="submit" variant="contained" sx={{ mt: 2 }} disabled={savingProfile}>
            {savingProfile ? 'Saving…' : 'Save changes'}
          </Button>
        </form>
      </Paper>

      <Paper variant="outlined" className="rounded-2xl p-6">
        <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
          Change password
        </Typography>
        <Divider sx={{ mb: 2 }} />
        {passwordError && (
          <Alert severity="error" className="mb-4">
            {passwordError}
          </Alert>
        )}
        {passwordSuccess && (
          <Alert severity="success" className="mb-4">
            {passwordSuccess}
          </Alert>
        )}
        <form onSubmit={handlePasswordSubmit}>
          <TextField
            label="Current password"
            type="password"
            fullWidth
            required
            margin="dense"
            value={passwordForm.currentPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
          />
          <TextField
            label="New password"
            type="password"
            fullWidth
            required
            margin="dense"
            value={passwordForm.newPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
          />
          <PasswordStrength password={passwordForm.newPassword} sx={{ mt: 1, mb: 1 }} />
          <TextField
            label="Confirm new password"
            type="password"
            fullWidth
            required
            margin="dense"
            error={passwordsMismatch}
            helperText={passwordsMismatch ? 'Passwords do not match' : undefined}
            value={passwordForm.confirmNewPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, confirmNewPassword: e.target.value })}
          />
          <Button type="submit" variant="contained" sx={{ mt: 2 }} disabled={savingPassword}>
            {savingPassword ? 'Saving…' : 'Change password'}
          </Button>
        </form>
      </Paper>
      </div>

      <ChangeEmailDialog
        open={Boolean(emailChange)}
        newEmail={emailChange?.newEmail || ''}
        currentEmailMasked={emailChange?.currentEmailMasked || ''}
        initialCooldown={emailChange?.cooldown ?? 60}
        onConfirm={handleEmailChangeConfirm}
        onResend={() => authService.requestEmailChange(emailChange.newEmail)}
        onClose={handleEmailChangeClose}
      />
    </div>
  );
}
