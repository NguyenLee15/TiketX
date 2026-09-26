import { z } from 'zod';

export const authRefreshResponseSchema = z.object({
  userId: z.string().min(1),
  name: z.string().optional().default(''),
  email: z.string().optional().default(''),
  role: z.string().optional().default('Customer'),
  token: z.string().nullable().optional(),
  refreshToken: z.string().nullable().optional(),
}).passthrough();

export type AuthRefreshResponse = z.infer<typeof authRefreshResponseSchema>;

export const checkoutLinkResponseSchema = z.object({
  orderCode: z.union([z.string().min(1), z.number()]).transform(v => String(v)),
  amount: z.number().nonnegative().optional().default(0),
  checkoutUrl: z.string().min(1),
  qrCode: z.string().optional().nullable().default(''),
  accountNumber: z.string().optional().nullable().default(''),
  accountName: z.string().optional().nullable().default(''),
  bin: z.string().optional().nullable().default(''),
  description: z.string().optional().nullable().default(''),
}).passthrough();

export type CheckoutLinkResponse = z.infer<typeof checkoutLinkResponseSchema>;

export const userProfileResponseSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional().default(''),
  email: z.string().optional().default(''),
  phone: z.string().optional().nullable().default(''),
  avatarUrl: z.string().optional().nullable().default(''),
  role: z.string().optional().default('Customer'),
  hasRefundBankAccount: z.boolean().optional().default(false),
  refundBankBin: z.string().optional().nullable().default(null),
  refundBankAccountName: z.string().optional().nullable().default(null),
  refundBankAccountMasked: z.string().optional().nullable().default(null),
}).passthrough();

export type UserProfileResponse = z.infer<typeof userProfileResponseSchema>;

export const paymentStatusResponseSchema = z.object({
  orderCode: z.union([z.string().min(1), z.number()]).transform(v => String(v)),
  amount: z.number().optional().nullable(),
  checkoutUrl: z.string().optional().nullable(),
  qrCode: z.string().optional().nullable(),
  status: z.union([z.string(), z.number()]),
  ticketId: z.string().optional().nullable(),
  refundStatus: z.string().optional().nullable().default(null),
}).passthrough();

export type PaymentStatusResponse = z.infer<typeof paymentStatusResponseSchema>;
