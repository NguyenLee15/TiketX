import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { z } from 'zod';
import api from '../../services/api';

const refundPageSchema = z.object({
  items: z.array(z.object({
    id: z.string(), eventId: z.string(), ticketId: z.string(), amount: z.number(), status: z.string(),
    attempts: z.number(), providerStatus: z.string().nullable(), providerReference: z.string().nullable(),
    lastError: z.string().nullable(), createdAt: z.string(), nextAttemptAt: z.string().nullable()
  }).passthrough()), page: z.number(), pageSize: z.number(), totalCount: z.number()
}).passthrough();

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

export default function AdminRefundsPage() {
  const [page, setPage] = useState(1);
  const [retrying, setRetrying] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const refundsQuery = useQuery({
    queryKey: ['admin', 'refunds', page],
    queryFn: async ({ signal }) => {
      const response = await api.get('/api/admin/refunds', { params: { page, pageSize: 25 }, signal });
      return refundPageSchema.parse(response.data.data);
    }
  });

  const retryRefund = async (id: string) => {
    setRetrying(id);
    try {
      await api.post(`/api/admin/refunds/${id}/retries`);
      toast.success('Đã gửi yêu cầu đối soát và xử lý lại.');
      await queryClient.invalidateQueries({ queryKey: ['admin', 'refunds'] });
    } catch (error: unknown) {
      const response = (error as { response?: { data?: { message?: string } } }).response;
      toast.error(response?.data?.message || 'PayOS chưa có trạng thái cuối để xử lý lại.');
      await queryClient.invalidateQueries({ queryKey: ['admin', 'refunds'] });
    } finally { setRetrying(null); }
  };

  if (refundsQuery.isLoading) return <div className="p-8 text-text-secondary" aria-busy="true"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Đang tải yêu cầu hoàn tiền</div>;
  if (refundsQuery.isError) return <section className="surface-panel m-6 p-6"><p role="alert" className="mb-3 text-danger">Không tải được danh sách hoàn tiền.</p><button className="rounded-lg bg-brand-primary px-4 py-2 text-white" onClick={() => void refundsQuery.refetch()}>Thử lại</button></section>;

  const data = refundsQuery.data;
  if (!data) return null;
  const pages = Math.max(1, Math.ceil(data.totalCount / data.pageSize));

  return (
    <main className="space-y-5 p-4 sm:p-6">
      <header><h1 className="text-2xl font-bold text-white">Hoàn tiền</h1><p className="mt-1 text-sm text-text-secondary">Theo dõi lệnh chi và xử lý các yêu cầu cần đối soát.</p></header>
      <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface-1">
        <table className="w-full min-w-[850px] text-left text-sm">
          <thead className="border-b border-border-subtle text-xs uppercase text-text-secondary"><tr><th className="p-3">Yêu cầu / Vé</th><th className="p-3">Số tiền</th><th className="p-3">Trạng thái</th><th className="p-3">PayOS</th><th className="p-3">Lần thử</th><th className="p-3">Thao tác</th></tr></thead>
          <tbody>
            {data.items.map(refund => <tr key={refund.id} className="border-b border-border-subtle/70 align-top">
              <td className="p-3"><div className="font-medium text-white">{refund.id.slice(0, 8)}</div><div className="text-xs text-text-secondary">Vé {refund.ticketId.slice(0, 8)}</div></td>
              <td className="whitespace-nowrap p-3 tabular-nums">{money.format(refund.amount)}</td>
              <td className="p-3"><span className="rounded-md bg-surface-2 px-2 py-1 text-xs">{refund.status}</span>{refund.lastError && <p className="mt-2 flex max-w-sm gap-1.5 text-xs text-warning"><AlertTriangle className="h-4 w-4 shrink-0" />{refund.lastError}</p>}</td>
              <td className="p-3">{refund.providerStatus ?? '—'}{refund.providerReference && <p className="mt-1 max-w-40 truncate text-xs text-text-secondary">{refund.providerReference}</p>}</td>
              <td className="p-3 tabular-nums">{refund.attempts}</td>
              <td className="p-3">{refund.status === 'NeedsReview' && <button type="button" disabled={retrying === refund.id} onClick={() => void retryRefund(refund.id)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-brand-primary/40 px-3 text-xs font-semibold text-brand-primary disabled:opacity-60">{retrying === refund.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Đối soát / thử lại</button>}</td>
            </tr>)}
            {data.items.length === 0 && <tr><td colSpan={6} className="p-10 text-center text-text-secondary">Chưa có yêu cầu hoàn tiền.</td></tr>}
          </tbody>
        </table>
      </div>
      <nav aria-label="Phân trang yêu cầu hoàn tiền" className="flex items-center justify-between text-sm text-text-secondary"><span>{data.totalCount} yêu cầu · Trang {page}/{pages}</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))} className="min-h-10 rounded-lg border border-border-subtle px-3 disabled:opacity-40">Trước</button><button disabled={page >= pages} onClick={() => setPage(value => Math.min(pages, value + 1))} className="min-h-10 rounded-lg border border-border-subtle px-3 disabled:opacity-40">Sau</button></div></nav>
    </main>
  );
}
