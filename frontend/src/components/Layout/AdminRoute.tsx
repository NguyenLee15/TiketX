import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';

interface AdminRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export default function AdminRoute({ children, allowedRoles = ['Admin'] }: AdminRouteProps) {
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const role = user?.role || 'Customer';
  if (!allowedRoles.includes(role)) {
    if (role === 'Staff') {
      return <Navigate to="/admin/scan-ticket" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
