import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';

export default function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isHydrating } = useAuthStore();
  const location = useLocation();

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

  return <>{children}</>;
}
