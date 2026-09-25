import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import api from './services/api';
import { useAuthStore } from './stores/useAuthStore';

// Layouts
import StandardLayout from './components/Layout/StandardLayout';
import AdminLayout from './components/Layout/AdminLayout';
import PrivateRoute from './components/Layout/PrivateRoute';
import AdminRoute from './components/Layout/AdminRoute';

// Standard Pages
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const EventDetailPage = lazy(() => import('./pages/EventDetailPage'));
const LoginPage = lazy(() => import('./pages/Auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/Auth/RegisterPage'));
const MyTicketsPage = lazy(() => import('./pages/Tickets/MyTicketsPage'));
const PaymentResultPage = lazy(() => import('./pages/PaymentResultPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const LegalPage = lazy(() => import('./pages/LegalPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

// Admin Pages
const AdminDashboardPage = lazy(() => import('./pages/Admin/AdminDashboardPage'));
const AdminEventsPage = lazy(() => import('./pages/Admin/AdminEventsPage'));
const AdminUsersPage = lazy(() => import('./pages/Admin/AdminUsersPage'));
const AdminRefundsPage = lazy(() => import('./pages/Admin/AdminRefundsPage'));
const AdminScanTicketPage = lazy(() => import('./pages/Admin/AdminScanTicketPage'));

// Mock Pages (Development Only)
const MockPayOSPage = import.meta.env.DEV
  ? lazy(() => import('./pages/MockPayOSPage'))
  : null;

import { ErrorBoundary } from './components/ErrorBoundary';
import { authRefreshResponseSchema } from './schemas/customerSchemas';

function App() {
  const setAuth = useAuthStore(state => state.setAuth);
  const logout = useAuthStore(state => state.logout);

  useEffect(() => {
    let active = true;
    api.post('/api/auth/refresh', {})
      .then(response => {
        if (!active || !response.data?.success) return;
        const parsed = authRefreshResponseSchema.safeParse(response.data.data);
        if (!parsed.success) {
          if (active && useAuthStore.getState().user) logout();
          return;
        }
        const data = parsed.data;
        setAuth({
          id: data.userId,
          name: data.name ?? '',
          email: data.email ?? useAuthStore.getState().user?.email ?? '',
          role: data.role ?? 'Customer',
        }, data.token ?? null);
      })
      .catch(() => {
        if (active && useAuthStore.getState().user) logout();
      });
    return () => { active = false; };
  }, [logout, setAuth]);

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-text-secondary">Đang tải…</div>}>
        <Routes>
        {/* Admin & Staff Portal */}
        <Route
          path="/admin"
          element={
            <AdminRoute allowedRoles={['Admin', 'Staff']}>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route
            index
            element={
              <AdminRoute allowedRoles={['Admin']}>
                <AdminDashboardPage />
              </AdminRoute>
            }
          />
          <Route
            path="events"
            element={
              <AdminRoute allowedRoles={['Admin']}>
                <AdminEventsPage />
              </AdminRoute>
            }
          />
          <Route
            path="scan-ticket"
            element={
              <AdminRoute allowedRoles={['Admin', 'Staff']}>
                <AdminScanTicketPage />
              </AdminRoute>
            }
          />
          <Route
            path="users"
            element={
              <AdminRoute allowedRoles={['Admin']}>
                <AdminUsersPage />
              </AdminRoute>
            }
          />
          <Route
            path="refunds"
            element={
              <AdminRoute allowedRoles={['Admin']}>
                <AdminRefundsPage />
              </AdminRoute>
            }
          />
        </Route>

        {/* Mock Routes - Development Only */}
        {import.meta.env.DEV && MockPayOSPage && (
          <Route
            path="/mock-payos"
            element={
              <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Đang tải...</div>}>
                <MockPayOSPage />
              </Suspense>
            }
          />
        )}

        {/* Auth Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Standard Routes */}
        <Route path="/" element={<StandardLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="events/:id" element={<EventDetailPage />} />
          <Route path="my-tickets" element={<PrivateRoute><MyTicketsPage /></PrivateRoute>} />
          <Route path="payment-result" element={<PrivateRoute><PaymentResultPage /></PrivateRoute>} />
          <Route path="payment/result" element={<PrivateRoute><PaymentResultPage /></PrivateRoute>} />
          <Route path="profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
          <Route path="privacy" element={<LegalPage />} />
          <Route path="terms" element={<LegalPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
