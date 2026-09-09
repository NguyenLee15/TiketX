import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, ArrowRight, Loader2, Zap, Eye, EyeOff } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import { useAuthStore } from '../../stores/useAuthStore';

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email không được để trống')
    .email('Địa chỉ email không đúng định dạng')
    .max(150, 'Email không được vượt quá 150 ký tự'),
  password: z
    .string()
    .min(1, 'Mật khẩu không được để trống')
    .max(72, 'Mật khẩu không được vượt quá 72 ký tự')
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [serverError, setServerError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    formState: { errors, isSubmitting }
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  });

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

  const onError = (formErrors: typeof errors) => {
    if (formErrors.email) {
      setFocus('email');
    } else if (formErrors.password) {
      setFocus('password');
    }
  };

  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center py-10 px-4 relative text-text-primary">
      {/* Decorative Grid */}
      <div className="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-scale-in">
        {/* Sleek Floating Panel */}
        <div className="glass-panel p-6 sm:p-8 rounded-3xl relative">
          {/* Subtle top highlight */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-primary to-transparent opacity-50" />
          
          <div className="text-center mb-6 sm:mb-8">
            <Link 
              to="/" 
              className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-surface-2 border border-border-focus shadow-[0_0_20px_rgba(94,106,210,0.2)] mb-4 hover:scale-105 transition-transform group"
              aria-label="Về trang chủ TickeX"
            >
              <Zap className="w-6 h-6 text-brand-primary group-hover:text-white transition-colors" aria-hidden="true" />
            </Link>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-white mb-1.5 tracking-tight">Đăng Nhập Tài Khoản</h1>
            <p className="text-text-secondary text-xs sm:text-sm">Nhập thông tin xác thực để truy cập TickeX</p>
          </div>

          <form 
            onSubmit={handleSubmit(onSubmit, onError)} 
            className="space-y-4" 
            noValidate 
            aria-busy={isSubmitting}
          >
            {serverError && (
              <div 
                role="alert" 
                aria-live="polite"
                className="p-3.5 bg-danger/10 border border-danger/20 rounded-xl text-danger text-xs font-medium animate-slide-up flex items-start gap-2"
              >
                <span>{serverError}</span>
              </div>
            )}

            <div className="space-y-3.5">
              {/* Email Field */}
              <div className="space-y-1">
                <label htmlFor="login-email" className="block text-xs font-medium text-text-secondary">
                  Địa chỉ email
                </label>
                <div className="group relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-text-tertiary group-focus-within:text-brand-primary transition-colors" aria-hidden="true" />
                  </div>
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="username"
                    spellCheck={false}
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? "email-error" : undefined}
                    {...register('email')}
                    className={`block w-full pl-10 pr-3.5 py-2.5 bg-surface-2 border ${
                      errors.email ? 'border-danger focus:border-danger focus:ring-danger' : 'border-border-subtle focus:border-brand-primary focus:ring-brand-primary'
                    } rounded-xl text-white placeholder-text-tertiary focus:outline-none focus-visible:ring-2 transition-[colors,box-shadow] text-xs sm:text-sm`}
                    placeholder="name@example.com"
                  />
                </div>
                {errors.email && (
                  <p id="email-error" className="text-[11px] text-danger pl-1 animate-slide-up">
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Password Field */}
              <div className="space-y-1">
                <label htmlFor="login-password" className="block text-xs font-medium text-text-secondary">
                  Mật khẩu
                </label>
                <div className="group relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-text-tertiary group-focus-within:text-brand-primary transition-colors" aria-hidden="true" />
                  </div>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? "password-error" : undefined}
                    {...register('password')}
                    className={`block w-full pl-10 pr-10 py-2.5 bg-surface-2 border ${
                      errors.password ? 'border-danger focus:border-danger focus:ring-danger' : 'border-border-subtle focus:border-brand-primary focus:ring-brand-primary'
                    } rounded-xl text-white placeholder-text-tertiary focus:outline-none focus-visible:ring-2 transition-[colors,box-shadow] text-xs sm:text-sm`}
                    placeholder="Mật khẩu của bạn"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-text-tertiary hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p id="password-error" className="text-[11px] text-danger pl-1 animate-slide-up">
                    {errors.password.message}
                  </p>
                )}
              </div>
            </div>

            {/* Quick Demo Credentials - Development Only */}
            {import.meta.env.DEV && (
              <div className="p-3.5 rounded-2xl bg-surface-2/70 border border-border-subtle text-xs text-text-secondary space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-text-primary flex items-center gap-1.5 text-[11px]">
                    <Zap className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                    Điền nhanh tài khoản thử nghiệm:
                  </span>
                  <span className="text-[9px] font-mono uppercase text-text-tertiary bg-surface-3 px-1.5 py-0.5 rounded">DEV</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setValue('email', 'admin@tickex.com', { shouldValidate: true });
                      setValue('password', 'Admin@123', { shouldValidate: true });
                      setServerError('');
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-surface-3 hover:bg-surface-4 text-[11px] font-medium text-white transition-colors text-left border border-border-subtle hover:border-brand-primary/50 group"
                  >
                    <span className="text-brand-primary font-semibold block text-[11px]">Quản Trị Viên</span>
                    <span className="text-text-tertiary text-[10px] truncate block group-hover:text-text-secondary">admin@tickex.com</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setValue('email', 'user@tickex.com', { shouldValidate: true });
                      setValue('password', 'Admin@123', { shouldValidate: true });
                      setServerError('');
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-surface-3 hover:bg-surface-4 text-[11px] font-medium text-white transition-colors text-left border border-border-subtle hover:border-brand-secondary/50 group"
                  >
                    <span className="text-brand-secondary font-semibold block text-[11px]">Khách Hàng</span>
                    <span className="text-text-tertiary text-[10px] truncate block group-hover:text-text-secondary">user@tickex.com</span>
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="group w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold text-black bg-white hover:bg-gray-100 transition-[colors,transform,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.98] shadow-lg"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <>
                  <span>Đăng Nhập Ngay</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                </>
              )}
            </button>
          </form>

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
