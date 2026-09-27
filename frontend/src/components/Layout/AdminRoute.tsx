import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';

interface AdminRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export default function AdminRoute({ children, allowedRoles = ['Admin'] }: AdminRouteProps) {
  const location = useLocation();
  const { isAuthenticated, user, isHydrating } = useAuthStore();

  if (isHydrating) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-brand-primary animate-spin" />
      </div>
    );
  }

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
