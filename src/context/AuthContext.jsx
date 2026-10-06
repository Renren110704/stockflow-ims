import { createContext, useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On first load, if a token exists, verify it against the backend
  // and restore the session instead of trusting stale localStorage data.
  useEffect(() => {
    const bootstrapAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await authService.getCurrentUser();
        setUser(res.data);
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      } finally {
        setLoading(false);
      }
    };
    bootstrapAuth();
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await authService.login(email, password);
    localStorage.setItem('token', res.token);
    localStorage.setItem('user', JSON.stringify(res.data));
    setUser(res.data);
    return res;
  }, []);

  // Merge changes (e.g. a new avatar) into the logged-in user so the whole
  // app updates immediately, without a page refresh.
  const updateCurrentUser = useCallback((changes) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...changes };
      localStorage.setItem('user', JSON.stringify(next));
      return next;
    });
  }, []);

  const loginWithGoogle = useCallback(async (accessToken) => {
    const res = await authService.googleLogin(accessToken);
    localStorage.setItem('token', res.token);
    localStorage.setItem('user', JSON.stringify(res.data));
    setUser(res.data);
    return res;
  }, []);

  const register = useCallback(async (name, email, password, confirmPassword) => {
    const res = await authService.register(name, email, password, confirmPassword);
    return res;
  }, []);

  const verifyRegistrationOtp = useCallback(async (email, otp) => {
    const res = await authService.verifyOtp(email, otp);
    return res;
  }, []);

  const resendRegistrationOtp = useCallback(async (email) => {
    const res = await authService.resendOtp(email);
    return res;
  }, []);

  const forgotPassword = useCallback(async (email) => {
    const res = await authService.forgotPassword(email);
    return res;
  }, []);

  const resetPassword = useCallback(async (email, otp, newPassword, confirmNewPassword) => {
    const res = await authService.resetPassword(email, otp, newPassword, confirmNewPassword);
    return res;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
    }
  }, []);

  const value = {
    user,
    isAuthenticated: !!user,
    loading,
    login,
    loginWithGoogle,
    updateCurrentUser,
    logout,
    register,
    verifyRegistrationOtp,
    resendRegistrationOtp,
    forgotPassword,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
