import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import { useAuthStore } from '../../stores/useAuthStore';
import LoginForm, { LoginFormValues } from './LoginForm';

export default function LoginPage() {
  const [serverError, setServerError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuth, isAuthenticated, user } = useAuthStore();

  const resolveRedirectTarget = (role?: string) => {
    const stateFrom = (location.state as { from?: unknown })?.from;
    let targetPath = '';

    if (typeof stateFrom === 'string') {
      targetPath = stateFrom;
    } else if (stateFrom && typeof stateFrom === 'object' && 'pathname' in stateFrom) {
      const locObj = stateFrom as { pathname: string; search?: string; hash?: string };
      targetPath = `${locObj.pathname}${locObj.search || ''}${locObj.hash || ''}`;
    } else {
      const searchParams = new URLSearchParams(location.search);
      const fromQuery = searchParams.get('from');
      if (fromQuery && fromQuery.startsWith('/')) {
        targetPath = fromQuery;
      }
    }

    // Guard against open redirect and auth loop
    if (!targetPath || targetPath.startsWith('/login') || targetPath.startsWith('/register') || !targetPath.startsWith('/')) {
      if (role === 'Staff') return '/admin/scan-ticket';
      if (role === 'Admin') return '/admin';
      return '/';
    }

    // If staff user is sent to /admin root, redirect to scan ticket
    if (role === 'Staff' && targetPath === '/admin') {
      return '/admin/scan-ticket';
    }

    return targetPath;
  };

  // Auto-redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated()) {
      navigate(resolveRedirectTarget(user?.role), { replace: true });
    }
  }, [isAuthenticated, user?.role, navigate]);

  const onSubmit = async (values: LoginFormValues) => {
    setServerError('');

    try {
      const res = await api.post('/api/auth/login', {
        email: values.email.trim(),
        password: values.password
      });

      if (res.data?.success && res.data?.data) {
        const { token, userId, name, role } = res.data.data;
        const userData = {
          id: userId,
          name: name,
          email: values.email.trim(),
          role: role
        };

        setAuth(userData, token);
        toast.success(`Chào mừng ${name} đã đăng nhập thành công!`);
        navigate(resolveRedirectTarget(role), { replace: true });
      } else {
        const msg = res.data?.message || 'Đăng nhập không thành công';
        setServerError(msg);
      }
    } catch (err: unknown) {
      const apiErr = err as { response?: { status?: number; data?: { message?: string } } };
      if (apiErr.response?.status === 429) {
        setServerError('Bạn đã gửi quá nhiều yêu cầu đăng nhập. Vui lòng chờ 1 phút trước khi thử lại.');
      } else {
        const msg = apiErr.response?.data?.message || 'Email hoặc mật khẩu không chính xác';
        setServerError(msg);
      }
    }
  };

  return (
    <div className="min-h-[100dvh] bg-surface-1 flex items-center justify-center py-10 px-4 relative text-text-primary">
      <div className="w-full max-w-md relative z-10 animate-scale-in">
        {/* Sleek Floating Panel */}
        <div className="surface-panel p-6 sm:p-8 rounded-2xl relative">
          {/* Subtle top highlight */}
          
          <div className="text-center mb-6 sm:mb-8">
            <Link 
              to="/" 
              className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-surface-2 border border-border-focus mb-4 hover:bg-surface-3 transition-colors group"
              aria-label="Về trang chủ TickeX"
            >
              <Zap className="w-6 h-6 text-brand-primary group-hover:text-white transition-colors" aria-hidden="true" />
            </Link>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-white mb-1.5 tracking-tight">Đăng Nhập Tài Khoản</h1>
            <p className="text-text-secondary text-xs sm:text-sm">Nhập thông tin xác thực để truy cập TickeX</p>
          </div>

          <LoginForm
            serverError={serverError}
            onSubmit={onSubmit}
            onClearServerError={() => setServerError('')}
          />

          <div className="mt-6 text-center text-xs text-text-secondary">
            Bạn chưa có tài khoản?{' '}
            <Link to="/register" className="font-bold text-white hover:text-brand-primary transition-colors">
              Đăng ký tài khoản mới
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
