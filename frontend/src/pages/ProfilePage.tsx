import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Shield, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import { useAuthStore } from '../stores/useAuthStore';
import { 
  profileSchema, 
  passwordSchema, 
  ProfileFormValues, 
  PasswordFormValues 
} from './Profile/profileSchemas';
import { ProfileInfoForm } from './Profile/ProfileInfoForm';
import { ChangePasswordForm } from './Profile/ChangePasswordForm';

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
      if (res.data?.success && res.data?.data) {
        setEmail(res.data.data.email || '');
        resetProfile({
          name: res.data.data.name || '',
          phone: res.data.data.phone || '',
          avatarUrl: res.data.data.avatarUrl || ''
        });
      } else {
        setLoadError(true);
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
      if (res.data?.success) {
        toast.success('Cập nhật hồ sơ thành công!');
        if (user) {
          setAuth({ ...user, name: values.name.trim(), avatarUrl: values.avatarUrl.trim() }, token);
        }
      } else {
        toast.error(res.data?.message || 'Không thể cập nhật hồ sơ');
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
      if (res.data?.success) {
        toast.success('Đổi mật khẩu thành công!');
        resetPassword({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        toast.error(res.data?.message || 'Không thể đổi mật khẩu');
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
        <ProfileInfoForm
          email={email}
          currentAvatarUrl={currentAvatarUrl}
          register={registerProfile}
          errors={profileErrors}
          onSubmit={handleProfileSubmit(onUpdateProfile)}
          isSubmitting={savingProfile}
        />

        <ChangePasswordForm
          register={registerPassword}
          errors={passwordErrors}
          onSubmit={handlePasswordSubmit(onChangePassword)}
          isSubmitting={savingPassword}
        />
      </div>
    </div>
  );
}
