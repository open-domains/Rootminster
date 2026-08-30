import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

/**
 * Renders children only if the current user has one of the allowed roles.
 * Otherwise redirects to /UserDashboard.
 */
export default function RoleProtectedRoute({ allowedRoles = [] }) {
  const { user, isLoadingAuth } = useAuth();

  if (isLoadingAuth) return null;

  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/user-dashboard" replace />;
  }

  return <Outlet />;
}