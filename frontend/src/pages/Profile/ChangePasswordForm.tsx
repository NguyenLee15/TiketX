import React from 'react';
import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { Lock, Shield, Loader2 } from 'lucide-react';
import { PasswordFormValues } from './profileSchemas';

interface ChangePasswordFormProps {
  register: UseFormRegister<PasswordFormValues>;
  errors: FieldErrors<PasswordFormValues>;
  onSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  isSubmitting: boolean;
}

export function ChangePasswordForm({
  register,
  errors,
  onSubmit,
  isSubmitting
}: ChangePasswordFormProps) {
  return (
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

        <form onSubmit={onSubmit} className="space-y-3.5 relative z-10" noValidate>
          <div className="space-y-1">
            <label htmlFor="password-current" className="text-xs font-bold text-text-secondary uppercase">Mật khẩu hiện tại</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="h-4 w-4 text-text-secondary group-focus-within:text-brand-secondary transition-colors" />
              </div>
              <input 
                id="password-current"
                type="password" 
                aria-invalid={errors.currentPassword ? 'true' : 'false'}
                aria-describedby={errors.currentPassword ? 'password-current-error' : undefined}
                {...register('currentPassword')}
                placeholder="••••••••"
                className={`block w-full pl-10 pr-3 py-2 text-xs sm:text-sm border ${
                  errors.currentPassword ? 'border-danger' : 'border-border-subtle'
                } rounded-xl bg-surface-2/50 text-white placeholder-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary transition-[colors,box-shadow] hover:bg-surface-2`}
              />
            </div>
            {errors.currentPassword && (
              <p id="password-current-error" role="alert" className="text-[11px] text-danger-readable pl-1 animate-slide-up">{errors.currentPassword.message}</p>
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
                aria-invalid={errors.newPassword ? 'true' : 'false'}
                aria-describedby={errors.newPassword ? 'password-new-error' : undefined}
                {...register('newPassword')}
                placeholder="••••••••"
                className={`block w-full pl-10 pr-3 py-2 text-xs sm:text-sm border ${
                  errors.newPassword ? 'border-danger' : 'border-border-subtle'
                } rounded-xl bg-surface-2/50 text-white placeholder-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary transition-[colors,box-shadow] hover:bg-surface-2`}
              />
            </div>
            {errors.newPassword && (
              <p id="password-new-error" role="alert" className="text-[11px] text-danger-readable pl-1 animate-slide-up">{errors.newPassword.message}</p>
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
                aria-invalid={errors.confirmPassword ? 'true' : 'false'}
                aria-describedby={errors.confirmPassword ? 'password-confirm-error' : undefined}
                {...register('confirmPassword')}
                placeholder="••••••••"
                className={`block w-full pl-10 pr-3 py-2 text-xs sm:text-sm border ${
                  errors.confirmPassword ? 'border-danger' : 'border-border-subtle'
                } rounded-xl bg-surface-2/50 text-white placeholder-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary transition-[colors,box-shadow] hover:bg-surface-2`}
              />
            </div>
            {errors.confirmPassword && (
              <p id="password-confirm-error" role="alert" className="text-[11px] text-danger-readable pl-1 animate-slide-up">{errors.confirmPassword.message}</p>
            )}
          </div>

          <div className="pt-2">
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full py-2.5 bg-brand-primary hover:bg-brand-secondary text-surface-0 font-bold rounded-lg transition-[background-color,transform] flex items-center justify-center gap-1.5 text-sm disabled:opacity-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              {isSubmitting ? (
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
  );
}
