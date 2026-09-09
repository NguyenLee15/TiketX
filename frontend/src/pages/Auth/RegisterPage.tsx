import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, User, ArrowRight, Loader2, Zap } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';

const registerSchema = z.object({
  name: z.string().min(2, 'Họ và tên phải có ít nhất 2 ký tự').max(100, 'Họ và tên tối đa 100 ký tự'),
  email: z.string().min(1, 'Email không được để trống').email('Địa chỉ email không đúng định dạng'),
  password: z.string().min(6, 'Mật khẩu phải chứa ít nhất 6 ký tự'),
  confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu')
}).refine(data => data.password === data.confirmPassword, {
  message: 'Mật khẩu xác nhận không khớp',
  path: ['confirmPassword']
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const [serverError, setServerError] = useState('');
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: ''
    }
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setServerError('');

    try {
      const payload = {
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password
      };
      const res = await api.post('/api/auth/register', payload);
      if (res.data.success) {
        toast.success('Đăng ký tài khoản thành công! Vui lòng đăng nhập.');
        navigate('/login');
      } else {
        const msg = res.data.message || 'Đăng ký thất bại';
        setServerError(msg);
        toast.error(msg);
      }
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      const msg = apiErr.response?.data?.message || 'Đăng ký thất bại. Email có thể đã được sử dụng.';
      setServerError(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center p-4 relative overflow-hidden text-text-primary py-12">
      {/* Decorative Grid */}
      <div className="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-scale-in">
        {/* Sleek Floating Panel */}
        <div className="glass-panel p-6 sm:p-8 rounded-3xl relative overflow-hidden">
          {/* Subtle top highlight */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-primary to-transparent opacity-50" />
          
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-surface-2 border border-border-focus shadow-[0_0_20px_rgba(94,106,210,0.2)] mb-4 hover:scale-105 transition-transform group">
              <Zap className="w-6 h-6 text-brand-primary group-hover:text-white transition-colors" />
            </Link>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-white mb-1 tracking-tight">Tạo Tài Khoản Mới</h1>
            <p className="text-text-secondary text-xs sm:text-sm">Trở thành thành viên TickeX để đặt vé sự kiện dễ dàng</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5" noValidate>
            {serverError && (
              <div className="p-3.5 bg-danger/10 border border-danger/20 rounded-xl text-danger text-xs font-medium animate-slide-up">
                {serverError}
              </div>
            )}

            <div className="space-y-1">
              <div className="group relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-text-tertiary group-focus-within:text-brand-primary transition-colors" />
                </div>
                <input
                  type="text"
                  {...register('name')}
                  aria-label="Họ và tên"
                  autoComplete="name"
                  className={`block w-full pl-10 pr-3.5 py-2.5 bg-surface-2 border ${
                    errors.name ? 'border-danger focus:border-danger focus:ring-danger' : 'border-border-subtle focus:border-brand-primary focus:ring-brand-primary'
                  } rounded-xl text-white placeholder-text-tertiary focus:outline-none focus-visible:ring-2 transition-[colors,box-shadow] text-xs sm:text-sm`}
                  placeholder="Họ và tên (VD: Nguyễn Văn An)"
                />
              </div>
              {errors.name && (
                <p className="text-[11px] text-danger pl-1 animate-slide-up">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <div className="group relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-text-tertiary group-focus-within:text-brand-primary transition-colors" />
                </div>
                <input
                  type="email"
                  {...register('email')}
                  aria-label="Email"
                  autoComplete="email"
                  className={`block w-full pl-10 pr-3.5 py-2.5 bg-surface-2 border ${
                    errors.email ? 'border-danger focus:border-danger focus:ring-danger' : 'border-border-subtle focus:border-brand-primary focus:ring-brand-primary'
                  } rounded-xl text-white placeholder-text-tertiary focus:outline-none focus-visible:ring-2 transition-[colors,box-shadow] text-xs sm:text-sm`}
                  placeholder="Địa chỉ email (VD: an.nguyen@example.com)"
                />
              </div>
              {errors.email && (
                <p className="text-[11px] text-danger pl-1 animate-slide-up">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <div className="group relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-text-tertiary group-focus-within:text-brand-primary transition-colors" />
                </div>
                <input
                  type="password"
                  {...register('password')}
                  aria-label="Mật khẩu"
                  autoComplete="new-password"
                  className={`block w-full pl-10 pr-3.5 py-2.5 bg-surface-2 border ${
                    errors.password ? 'border-danger focus:border-danger focus:ring-danger' : 'border-border-subtle focus:border-brand-primary focus:ring-brand-primary'
                  } rounded-xl text-white placeholder-text-tertiary focus:outline-none focus-visible:ring-2 transition-[colors,box-shadow] text-xs sm:text-sm`}
                  placeholder="Mật khẩu (tối thiểu 6 ký tự)"
                />
              </div>
              {errors.password && (
                <p className="text-[11px] text-danger pl-1 animate-slide-up">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <div className="group relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-text-tertiary group-focus-within:text-brand-primary transition-colors" />
                </div>
                <input
                  type="password"
                  {...register('confirmPassword')}
                  aria-label="Xác nhận mật khẩu"
                  autoComplete="new-password"
                  className={`block w-full pl-10 pr-3.5 py-2.5 bg-surface-2 border ${
                    errors.confirmPassword ? 'border-danger focus:border-danger focus:ring-danger' : 'border-border-subtle focus:border-brand-primary focus:ring-brand-primary'
                  } rounded-xl text-white placeholder-text-tertiary focus:outline-none focus-visible:ring-2 transition-[colors,box-shadow] text-xs sm:text-sm`}
                  placeholder="Xác nhận lại mật khẩu"
                />
              </div>
              {errors.confirmPassword && (
                <p className="text-[11px] text-danger pl-1 animate-slide-up">{errors.confirmPassword.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="group w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold text-black bg-white hover:bg-gray-100 transition-[colors,transform,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.98] mt-4 shadow-lg"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <span>Đăng Ký Tài Khoản</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-text-secondary">
            Bạn đã có tài khoản?{' '}
            <Link to="/login" className="font-bold text-white hover:text-brand-primary transition-colors">
              Đăng nhập ngay
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
