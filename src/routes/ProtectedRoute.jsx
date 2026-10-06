import { Navigate } from 'react-router-dom';
import { CircularProgress } from '@mui/material';
import useAuth from '../hooks/useAuth';

// Wraps a route element. Redirects unauthenticated users to /login.
// If `roles` is provided, also enforces role membership on the frontend
// (the backend is the real authorization boundary — see server middleware).
export default function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <CircularProgress />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
