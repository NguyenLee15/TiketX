import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Lock, Save, Loader2, Image as ImageIcon, Phone, Mail, Shield } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import { useAuthStore } from '../stores/useAuthStore';
import { ResilientImage } from '../components/ResilientImage';

// 1. Profile Schema
const profileSchema = z.object({
  name: z.string().min(2, 'Họ và tên phải có ít nhất 2 ký tự').max(100, 'Họ và tên tối đa 100 ký tự'),
  phone: z
    .string()
    .regex(/^(\+84|0)[3|5|7|8|9][0-9]{8}$/, 'Số điện thoại không hợp lệ (VD: 0901234567)')
    .or(z.literal('')),
  avatarUrl: z
    .string()
    .url('Đường dẫn ảnh phải là URL hợp lệ (bắt đầu bằng http:// hoặc https://)')
    .or(z.literal(''))
});

type ProfileFormValues = z.infer<typeof profileSchema>;

// 2. Change Password Schema
const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
  newPassword: z.string().min(6, 'Mật khẩu mới phải có ít nhất 6 ký tự'),
  confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu mới')
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Mật khẩu xác nhận không khớp',
  path: ['confirmPassword']
});

type PasswordFormValues = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const user = useAuthStore(state => state.user);
  const setAuth = useAuthStore(state => state.setAuth);
  const token = useAuthStore(state => state.token);

  // Profile Form
  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    reset: resetProfile,
    watch: watchProfile,
    formState: { errors: profileErrors, isSubmitting: savingProfile }
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: '',
      phone: '',
      avatarUrl: ''
    }
  });

  // Password Form
  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPassword,
    formState: { errors: passwordErrors, isSubmitting: savingPassword }
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    }
  });

  const currentAvatarUrl = watchProfile('avatarUrl');

  const fetchProfile = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      setLoadError(false);
      const res = await api.get('/api/users/me', { signal });
      if (res.data.success) {
        setEmail(res.data.data.email || '');
        resetProfile({
          name: res.data.data.name || '',
          phone: res.data.data.phone || '',
          avatarUrl: res.data.data.avatarUrl || ''
        });
      }
    } catch (error: unknown) {
      if ((error as { code?: string })?.code === 'ERR_CANCELED') return;
      setLoadError(true);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [resetProfile]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchProfile(controller.signal);
    return () => controller.abort();
  }, [fetchProfile]);

  const onUpdateProfile = async (values: ProfileFormValues) => {
    try {
      const res = await api.put('/api/users/profile', {
        name: values.name.trim(),
        phone: values.phone.trim(),
        avatarUrl: values.avatarUrl.trim()
      });
      if (res.data.success) {
        toast.success('Cập nhật hồ sơ thành công!');
        if (user) {
          setAuth({ ...user, name: values.name.trim(), avatarUrl: values.avatarUrl.trim() }, token);
        }
      }
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      toast.error(apiErr.response?.data?.message || 'Lỗi khi cập nhật hồ sơ');
    }
  };

  const onChangePassword = async (values: PasswordFormValues) => {
    try {
      const res = await api.post('/api/users/change-password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword
      });
      if (res.data.success) {
        toast.success('Đổi mật khẩu thành công!');
        resetPassword({ currentPassword: '', newPassword: '', confirmPassword: '' });
      }
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      toast.error(apiErr.response?.data?.message || 'Lỗi khi đổi mật khẩu');
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-brand-primary" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="surface-panel mx-auto flex min-h-[40vh] max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-xl font-display font-bold text-text-primary">Không thể tải hồ sơ</h1>
        <p className="text-base text-text-secondary">Kiểm tra kết nối rồi thử lại.</p>
        <button type="button" onClick={() => void fetchProfile()} className="min-h-11 rounded-lg bg-brand-primary px-5 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary">Thử lại</button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12 relative text-text-primary">
      <div className="surface-panel flex flex-col gap-1.5 p-6 sm:p-8">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-primary/10 border border-brand-primary/20 w-fit mb-1">
          <Shield className="w-3.5 h-3.5 text-brand-primary" />
          <span className="text-xs font-bold text-brand-primary uppercase tracking-wider">Cài Đặt Tài Khoản</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">Hồ Sơ Cá Nhân</h2>
        <p className="text-text-secondary text-xs sm:text-sm">Quản lý thông tin cá nhân và cài đặt bảo mật tài khoản của bạn.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Profile Card */}
        <div className="lg:col-span-7">
          <div className="surface-panel p-6 sm:p-7 relative overflow-hidden h-full shadow-xl">
            
            <div className="flex items-center gap-3.5 mb-6 relative z-10 border-b border-border-subtle pb-4">
              <div className="w-10 h-10 rounded-xl bg-brand-primary/15 border border-brand-primary/30 flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-brand-primary" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">Thông Tin Cá Nhân</h3>
                <p className="text-xs text-text-secondary">Cập nhật tên hiển thị, ảnh đại diện và liên hệ.</p>
              </div>
            </div>

            <form onSubmit={handleProfileSubmit(onUpdateProfile)} className="space-y-4 relative z-10" noValidate>
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 mb-4 p-4 bg-surface-2/50 rounded-xl border border-border-subtle">
                <div className="relative group shrink-0">
                  {currentAvatarUrl ? (
                    <ResilientImage src={currentAvatarUrl} alt="Ảnh đại diện" width="80" height="80" className="relative w-20 h-20 rounded-full object-cover border-2 border-surface-2 shadow-xl group-hover:scale-105 transition-transform" fallbackClassName="relative flex h-20 w-20 items-center justify-center rounded-full border-2 border-surface-2 bg-surface-3 text-text-secondary" />
                  ) : (
                    <div className="relative w-20 h-20 rounded-full bg-surface-3 flex items-center justify-center border-2 border-surface-2 shadow-xl group-hover:scale-105 transition-transform">
                      <User className="w-8 h-8 text-text-secondary" />
                    </div>
                  )}
                </div>
                <div className="flex-1 w-full space-y-1">
                  <label htmlFor="profile-avatar-url" className="text-xs font-bold text-text-secondary uppercase">Đường dẫn ảnh đại diện (URL)</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <ImageIcon className="h-4 w-4 text-text-secondary group-focus-within:text-brand-secondary transition-colors" />
                    </div>
                    <input 
                      id="profile-avatar-url"
                      type="url" 
                      aria-invalid={profileErrors.avatarUrl ? 'true' : 'false'}
                      aria-describedby={profileErrors.avatarUrl ? 'profile-avatar-url-error' : undefined}
                      {...registerProfile('avatarUrl')}
                      placeholder="https://example.com/avatar.jpg"
                      className={`block w-full pl-10 pr-3 py-2 text-xs sm:text-sm border ${
                        profileErrors.avatarUrl ? 'border-danger' : 'border-border-subtle'
                      } rounded-xl bg-surface-1 text-white placeholder-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary transition-[colors,box-shadow]`}
                    />
                  </div>
                  {profileErrors.avatarUrl && (
                    <p id="profile-avatar-url-error" role="alert" className="text-[11px] text-danger pl-1 animate-slide-up">{profileErrors.avatarUrl.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="profile-name" className="text-xs font-bold text-text-secondary uppercase">Họ và tên</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <User className="h-4 w-4 text-text-secondary group-focus-within:text-brand-primary transition-colors" />
                    </div>
                    <input 
                      id="profile-name"
                      type="text" 
                      aria-invalid={profileErrors.name ? 'true' : 'false'}
                      aria-describedby={profileErrors.name ? 'profile-name-error' : undefined}
                      {...registerProfile('name')}
                      placeholder="Nguyễn Văn An"
                      className={`block w-full pl-10 pr-3 py-2 text-xs sm:text-sm border ${
                        profileErrors.name ? 'border-danger' : 'border-border-subtle'
                      } rounded-xl bg-surface-2/50 text-white placeholder-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary transition-[colors,box-shadow] hover:bg-surface-2`}
                    />
                  </div>
                  {profileErrors.name && (
                    <p id="profile-name-error" role="alert" className="text-[11px] text-danger pl-1 animate-slide-up">{profileErrors.name.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label htmlFor="profile-email" className="text-xs font-bold text-text-secondary uppercase flex items-center justify-between">
                    Địa chỉ Email
                    <span className="text-[9px] uppercase tracking-wider text-text-secondary bg-surface-3 px-1.5 py-0.2 rounded">Chỉ đọc</span>
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Mail className="h-4 w-4 text-text-secondary/50" />
                    </div>
                    <input 
                      id="profile-email"
                      type="email" 
                      value={email}
                      disabled
                      className="block w-full pl-10 pr-3 py-2 text-xs sm:text-sm border border-border-subtle rounded-xl bg-surface-1/50 text-text-secondary cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label htmlFor="profile-phone" className="text-xs font-bold text-text-secondary uppercase">Số điện thoại liên hệ</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Phone className="h-4 w-4 text-text-secondary group-focus-within:text-brand-primary transition-colors" />
                    </div>
                    <input 
                      id="profile-phone"
                      type="tel" 
                      aria-invalid={profileErrors.phone ? 'true' : 'false'}
                      aria-describedby={profileErrors.phone ? 'profile-phone-error' : undefined}
                      {...registerProfile('phone')}
                      placeholder="0901234567"
                      className={`block w-full pl-10 pr-3 py-2 text-xs sm:text-sm border ${
                        profileErrors.phone ? 'border-danger' : 'border-border-subtle'
                      } rounded-xl bg-surface-2/50 text-white placeholder-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary transition-[colors,box-shadow] hover:bg-surface-2`}
                    />
                  </div>
                  {profileErrors.phone && (
                    <p id="profile-phone-error" role="alert" className="text-[11px] text-danger pl-1 animate-slide-up">{profileErrors.phone.message}</p>
                  )}
                </div>
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={savingProfile}
                  className="w-full sm:w-auto px-6 py-2.5 bg-brand-primary hover:bg-brand-primary/90 text-white font-bold rounded-xl transition-[opacity,transform,box-shadow] shadow-md shadow-brand-glow flex items-center justify-center gap-1.5 text-xs sm:text-sm disabled:opacity-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                >
                  {savingProfile ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>Lưu Thay Đổi</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Password Card */}
        <div className="lg:col-span-5">
          <div className="surface-panel p-6 sm:p-7 relative overflow-hidden h-full shadow-xl">
            
            <div className="flex items-center gap-3.5 mb-6 relative z-10 border-b border-border-subtle pb-4">
              <div className="w-10 h-10 rounded-xl bg-brand-secondary/15 border border-brand-secondary/30 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5 text-brand-secondary" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">Bảo Mật & Mật Khẩu</h3>
                <p className="text-xs text-text-secondary">Thay đổi mật khẩu đăng nhập tài khoản.</p>
              </div>
            </div>

            <form onSubmit={handlePasswordSubmit(onChangePassword)} className="space-y-3.5 relative z-10" noValidate>
              <div className="space-y-1">
                <label htmlFor="password-current" className="text-xs font-bold text-text-secondary uppercase">Mật khẩu hiện tại</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-text-secondary group-focus-within:text-brand-secondary transition-colors" />
                  </div>
                  <input 
                    id="password-current"
                    type="password" 
                    aria-invalid={passwordErrors.currentPassword ? 'true' : 'false'}
                    aria-describedby={passwordErrors.currentPassword ? 'password-current-error' : undefined}
                    {...registerPassword('currentPassword')}
                    placeholder="••••••••"
                    className={`block w-full pl-10 pr-3 py-2 text-xs sm:text-sm border ${
                      passwordErrors.currentPassword ? 'border-danger' : 'border-border-subtle'
                    } rounded-xl bg-surface-2/50 text-white placeholder-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary transition-[colors,box-shadow] hover:bg-surface-2`}
                  />
                </div>
                {passwordErrors.currentPassword && (
                  <p id="password-current-error" role="alert" className="text-[11px] text-danger pl-1 animate-slide-up">{passwordErrors.currentPassword.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <label htmlFor="password-new" className="text-xs font-bold text-text-secondary uppercase">Mật khẩu mới</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Shield className="h-4 w-4 text-text-secondary group-focus-within:text-brand-secondary transition-colors" />
                  </div>
                  <input 
                    id="password-new"
                    type="password" 
                    aria-invalid={passwordErrors.newPassword ? 'true' : 'false'}
                    aria-describedby={passwordErrors.newPassword ? 'password-new-error' : undefined}
                    {...registerPassword('newPassword')}
                    placeholder="••••••••"
                    className={`block w-full pl-10 pr-3 py-2 text-xs sm:text-sm border ${
                      passwordErrors.newPassword ? 'border-danger' : 'border-border-subtle'
                    } rounded-xl bg-surface-2/50 text-white placeholder-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary transition-[colors,box-shadow] hover:bg-surface-2`}
                  />
                </div>
                {passwordErrors.newPassword && (
                  <p id="password-new-error" role="alert" className="text-[11px] text-danger pl-1 animate-slide-up">{passwordErrors.newPassword.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <label htmlFor="password-confirm" className="text-xs font-bold text-text-secondary uppercase">Xác nhận mật khẩu mới</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Shield className="h-4 w-4 text-text-secondary group-focus-within:text-brand-secondary transition-colors" />
                  </div>
                  <input 
                    id="password-confirm"
                    type="password" 
                    aria-invalid={passwordErrors.confirmPassword ? 'true' : 'false'}
                    aria-describedby={passwordErrors.confirmPassword ? 'password-confirm-error' : undefined}
                    {...registerPassword('confirmPassword')}
                    placeholder="••••••••"
                    className={`block w-full pl-10 pr-3 py-2 text-xs sm:text-sm border ${
                      passwordErrors.confirmPassword ? 'border-danger' : 'border-border-subtle'
                    } rounded-xl bg-surface-2/50 text-white placeholder-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary transition-[colors,box-shadow] hover:bg-surface-2`}
                  />
                </div>
                {passwordErrors.confirmPassword && (
                  <p id="password-confirm-error" role="alert" className="text-[11px] text-danger pl-1 animate-slide-up">{passwordErrors.confirmPassword.message}</p>
                )}
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={savingPassword}
                  className="w-full py-2.5 bg-brand-primary hover:bg-brand-primary/90 text-white font-bold rounded-lg transition-[background-color,transform] flex items-center justify-center gap-1.5 text-sm disabled:opacity-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                >
                  {savingPassword ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                  <span>Cập Nhật Mật Khẩu</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
