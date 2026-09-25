import { z } from 'zod';

// ==========================================
// 1. Admin Dashboard Schemas
// ==========================================

export const dailyRevenueSchema = z.object({
  date: z.string(),
  revenue: z.number(),
  ticketsSold: z.number(),
}).passthrough();

export const topEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string().default(''),
  ticketsSold: z.number(),
  revenue: z.number(),
  totalSeats: z.number(),
}).passthrough();

export const recentTransactionSchema = z.object({
  ticketId: z.string(),
  orderCode: z.union([z.number(), z.string()]).transform(v => Number(v) || 0),
  eventTitle: z.string(),
  userName: z.string(),
  amount: z.number(),
  status: z.string(),
  createdAt: z.string(),
}).passthrough();

export const adminDashboardStatsSchema = z.object({
  totalUsers: z.number().nonnegative(),
  totalEvents: z.number().nonnegative(),
  totalTicketsSold: z.number().nonnegative(),
  totalRevenue: z.number(),
  totalRefunded: z.number().default(0),
  totalRefundPending: z.number().optional().default(0),
  totalNetRevenue: z.number().optional(),
  totalCheckedIn: z.number().nonnegative().default(0),
  topEvents: z.array(topEventSchema).default([]),
  recentTransactions: z.array(recentTransactionSchema).default([]),
  dailyStats: z.array(dailyRevenueSchema).default([]),
}).passthrough();

// ==========================================
// 2. Admin Events List Schemas
// ==========================================

export const adminEventItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(''),
  date: z.string().min(1),
  endDate: z.string().optional().nullable(),
  location: z.string().default(''),
  venueName: z.string().optional().default(''),
  category: z.string().default(''),
  imageUrl: z.string().default(''),
  bannerUrl: z.string().optional().default(''),
  organizerName: z.string().optional().default(''),
  totalSeats: z.number().int().nonnegative(),
  availableSeatsCount: z.number().int().nonnegative().optional().default(0),
  basePrice: z.number().nonnegative(),
  minPrice: z.number().nonnegative().optional().default(0),
  maxPrice: z.number().nonnegative().optional().default(0),
  status: z.union([z.number(), z.string()]),
  refundCutoffHours: z.number().int().nonnegative().optional().default(24),
  isDeleted: z.boolean().optional().default(false),
  hasTicketHistory: z.boolean().optional().default(false),
  version: z.string().optional().nullable(),
}).passthrough();

export const adminEventsPagedResponseSchema = z.object({
  items: z.array(adminEventItemSchema).default([]),
  totalCount: z.number().int().nonnegative().default(0),
  totalPages: z.number().int().nonnegative().default(1),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().default(10),
}).passthrough();

// ==========================================
// 3. Admin Users List Schemas
// ==========================================

export const adminUserItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().default(''),
  email: z.string().email().or(z.string()),
  role: z.string().default('Customer'),
  isBlocked: z.boolean().default(false),
  avatarUrl: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  createdAt: z.string().optional().nullable(),
  version: z.string().optional().nullable(),
}).passthrough();

export const adminUsersPagedResponseSchema = z.union([
  z.array(adminUserItemSchema),
  z.object({
    items: z.array(adminUserItemSchema).default([]),
    totalCount: z.number().int().nonnegative().default(0),
    totalPages: z.number().int().nonnegative().default(1),
    page: z.number().int().positive().default(1),
    pageSize: z.number().int().positive().default(10),
  }).passthrough(),
]);

// ==========================================
// 4. Admin Scan Ticket / Check-in Schemas
// ==========================================

export const scanTicketDataSchema = z.object({
  ticketId: z.string().min(1),
  eventTitle: z.string().min(1),
  attendeeName: z.string().default(''),
  attendeeEmail: z.string().nullish().transform(v => v ?? undefined),
  row: z.string().min(1),
  number: z.number().int().positive(),
  tier: z.union([z.number(), z.string()]).default(0),
  price: z.number().nullish().transform(v => v ?? undefined),
  orderCode: z.union([z.number(), z.string()]).transform(v => Number(v) || 0).optional(),
  checkedInAt: z.string().nullish().transform(v => v ?? undefined),
}).passthrough();
