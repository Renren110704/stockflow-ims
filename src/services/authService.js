import api from './api';

// All calls related to authentication live here so components/context
// never talk to axios directly.
const authService = {
  // Step 1: validates the form and emails a 6-digit code (no account yet).
  register: async (name, email, password, confirmPassword) => {
    const { data } = await api.post('/auth/register', {
      name,
      email,
      password,
      confirmPassword,
    });
    return data;
  },

  // Step 2: submit the emailed code; creates the account on success.
  verifyOtp: async (email, otp) => {
    const { data } = await api.post('/auth/verify-otp', { email, otp });
    return data;
  },

  resendOtp: async (email) => {
    const { data } = await api.post('/auth/resend-otp', { email });
    return data;
  },

  // Forgot password: emails a reset code (response is the same whether or
  // not the account exists), then the code + new password are submitted together.
  forgotPassword: async (email) => {
    const { data } = await api.post('/auth/forgot-password', { email });
    return data;
  },

  resetPassword: async (email, otp, newPassword, confirmNewPassword) => {
    const { data } = await api.post('/auth/reset-password', {
      email,
      otp,
      newPassword,
      confirmNewPassword,
    });
    return data;
  },

  // Change email (logged in): codes go to BOTH the current and the new
  // address; the change only applies once both are confirmed.
  // requestEmailChange is also used to resend (the server enforces a cooldown).
  requestEmailChange: async (newEmail) => {
    const { data } = await api.post('/auth/email-change/request', { newEmail });
    return data;
  },

  confirmEmailChange: async (currentOtp, newOtp) => {
    const { data } = await api.post('/auth/email-change/confirm', { currentOtp, newOtp });
    return data;
  },

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    return data;
  },

  // Exchanges a Google OAuth access token for our own JWT.
  googleLogin: async (accessToken) => {
    const { data } = await api.post('/auth/google', { accessToken });
    return data;
  },

  logout: async () => {
    const { data } = await api.post('/auth/logout');
    return data;
  },

  getCurrentUser: async () => {
    const { data } = await api.get('/auth/me');
    return data;
  },

  // Profile picture: ask the server to sign an upload, then (after the
  // browser uploads to Cloudinary) save the resulting URL.
  getAvatarUploadSignature: async () => {
    const { data } = await api.post('/auth/avatar/signature');
    return data;
  },

  updateAvatar: async (avatar) => {
    const { data } = await api.put('/auth/avatar', { avatar });
    return data;
  },

  removeAvatar: async () => {
    const { data } = await api.delete('/auth/avatar');
    return data;
  },

  changePassword: async (currentPassword, newPassword, confirmNewPassword) => {
    const { data } = await api.put('/auth/change-password', {
      currentPassword,
      newPassword,
      confirmNewPassword,
    });
    return data;
  },
};

export default authService;
