import { z } from 'zod';

export function toLocalDatetimeInput(isoOrDateString?: string | null): string {
  if (!isoOrDateString) return '';
  const d = new Date(isoOrDateString);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function toUtcIsoString(localDatetimeStr: string): string {
  if (!localDatetimeStr) return '';
  const d = new Date(localDatetimeStr);
  if (isNaN(d.getTime())) return '';
  return d.toISOString();
}

export const eventSchema = z.object({
  title: z.string().min(3, "Tên sự kiện phải từ 3 ký tự trở lên"),
  description: z.string().min(10, "Mô tả phải từ 10 ký tự trở lên"),
  location: z.string().min(3, "Địa điểm là bắt buộc"),
  venueName: z.string().optional(),
  date: z.string().min(1, "Thời gian bắt đầu là bắt buộc"),
  endDate: z.string().optional(),
  imageUrl: z.union([z.literal(''), z.string().url("URL hình ảnh không hợp lệ")]),
  category: z.string().min(1, "Danh mục là bắt buộc"),
  status: z.enum(['Draft', 'Published', 'Completed', 'Cancelled']),
  rowCount: z.number().min(1, "Tối thiểu 1 hàng").max(50, "Tối đa 50 hàng"),
  seatsPerRow: z.number().min(1, "Tối thiểu 1 ghế/hàng").max(50, "Tối đa 50 ghế/hàng"),
  basePrice: z.number().positive("Giá vé cơ sở phải lớn hơn 0"),
}).refine(data => !data.endDate || new Date(data.endDate).getTime() > new Date(data.date).getTime(), {
  path: ['endDate'],
  message: 'Thời gian kết thúc phải sau thời gian bắt đầu',
});

export type EventFormValues = z.infer<typeof eventSchema>;

export const CATEGORIES = ['Concert', 'Music', 'Sports', 'Tech', 'Conference', 'Entertainment', 'Arts', 'Workshop', 'General'];

