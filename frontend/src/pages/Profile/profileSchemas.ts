import { z } from 'zod';

export const profileSchema = z.object({
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

export type ProfileFormValues = z.infer<typeof profileSchema>;

export const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
  newPassword: z.string().min(6, 'Mật khẩu mới phải có ít nhất 6 ký tự'),
  confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu mới')
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Mật khẩu xác nhận không khớp',
  path: ['confirmPassword']
});

export type PasswordFormValues = z.infer<typeof passwordSchema>;

export const refundBankAccountSchema = z.object({
  bankBin: z.string().regex(/^\d{6,11}$/, 'Nhập mã BIN ngân hàng gồm 6–11 chữ số'),
  accountName: z.string().trim().min(2, 'Nhập tên chủ tài khoản').max(120),
  accountNumber: z.string().regex(/^\d{6,30}$/, 'Số tài khoản phải gồm 6–30 chữ số')
});

export type RefundBankAccountFormValues = z.infer<typeof refundBankAccountSchema>;
