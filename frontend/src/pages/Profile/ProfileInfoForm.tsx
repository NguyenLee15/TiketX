import React from 'react';
import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { User, Image as ImageIcon, Mail, Phone, Save, Loader2 } from 'lucide-react';
import { ResilientImage } from '../../components/ResilientImage';
import { ProfileFormValues } from './profileSchemas';

interface ProfileInfoFormProps {
  email: string;
  currentAvatarUrl?: string;
  register: UseFormRegister<ProfileFormValues>;
  errors: FieldErrors<ProfileFormValues>;
  onSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  isSubmitting: boolean;
}

export function ProfileInfoForm({
  email,
  currentAvatarUrl,
  register,
  errors,
  onSubmit,
  isSubmitting
}: ProfileInfoFormProps) {
  return (
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

        <form onSubmit={onSubmit} className="space-y-4 relative z-10" noValidate>
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 mb-4 p-4 bg-surface-2/50 rounded-xl border border-border-subtle">
            <div className="relative group shrink-0">
              {currentAvatarUrl ? (
                <ResilientImage 
                  src={currentAvatarUrl} 
                  alt="Ảnh đại diện" 
                  width="80" 
                  height="80" 
                  className="relative w-20 h-20 rounded-full object-cover border-2 border-surface-2 shadow-xl group-hover:scale-105 transition-transform" 
                  fallbackClassName="relative flex h-20 w-20 items-center justify-center rounded-full border-2 border-surface-2 bg-surface-3 text-text-secondary" 
                />
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
                  aria-invalid={errors.avatarUrl ? 'true' : 'false'}
                  aria-describedby={errors.avatarUrl ? 'profile-avatar-url-error' : undefined}
                  {...register('avatarUrl')}
                  placeholder="https://example.com/avatar.jpg"
                  className={`block w-full pl-10 pr-3 py-2 text-xs sm:text-sm border ${
                    errors.avatarUrl ? 'border-danger' : 'border-border-subtle'
                  } rounded-xl bg-surface-1 text-white placeholder-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary transition-[colors,box-shadow]`}
                />
              </div>
              {errors.avatarUrl && (
                <p id="profile-avatar-url-error" role="alert" className="text-[11px] text-danger-readable pl-1 animate-slide-up">{errors.avatarUrl.message}</p>
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
                  aria-invalid={errors.name ? 'true' : 'false'}
                  aria-describedby={errors.name ? 'profile-name-error' : undefined}
                  {...register('name')}
                  placeholder="Nguyễn Văn An"
                  className={`block w-full pl-10 pr-3 py-2 text-xs sm:text-sm border ${
                    errors.name ? 'border-danger' : 'border-border-subtle'
                  } rounded-xl bg-surface-2/50 text-white placeholder-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary transition-[colors,box-shadow] hover:bg-surface-2`}
                />
              </div>
              {errors.name && (
                <p id="profile-name-error" role="alert" className="text-[11px] text-danger-readable pl-1 animate-slide-up">{errors.name.message}</p>
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
                  <Phone className="h-4 w-4 text-text-secondary group-focus-within:text-brand-readable transition-colors" />
                </div>
                <input 
                  id="profile-phone"
                  type="tel" 
                  aria-invalid={errors.phone ? 'true' : 'false'}
                  aria-describedby={errors.phone ? 'profile-phone-error' : undefined}
                  {...register('phone')}
                  placeholder="0901234567"
                  className={`block w-full pl-10 pr-3 py-2 text-xs sm:text-sm border ${
                    errors.phone ? 'border-danger' : 'border-border-subtle'
                  } rounded-xl bg-surface-2/50 text-white placeholder-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary transition-[colors,box-shadow] hover:bg-surface-2`}
                />
              </div>
              {errors.phone && (
                <p id="profile-phone-error" role="alert" className="text-[11px] text-danger-readable pl-1 animate-slide-up">{errors.phone.message}</p>
              )}
            </div>
          </div>

          <div className="pt-2">
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full sm:w-auto px-6 py-2.5 bg-brand-primary hover:bg-brand-secondary text-surface-0 font-bold rounded-xl transition-[background-color,transform,box-shadow] shadow-md shadow-brand-glow flex items-center justify-center gap-1.5 text-xs sm:text-sm disabled:opacity-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              {isSubmitting ? (
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
  );
}
