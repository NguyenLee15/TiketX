import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Banknote, Loader2, Save, Trash2 } from 'lucide-react';
import { refundBankAccountSchema, RefundBankAccountFormValues } from './profileSchemas';

interface RefundBankAccountFormProps {
  bankBin?: string | null;
  accountName?: string | null;
  maskedAccount?: string | null;
  onSave: (values: RefundBankAccountFormValues) => Promise<void>;
  onDelete: () => Promise<void>;
  isSubmitting: boolean;
}

export function RefundBankAccountForm({ bankBin, accountName, maskedAccount, onSave, onDelete, isSubmitting }: RefundBankAccountFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<RefundBankAccountFormValues>({
    resolver: zodResolver(refundBankAccountSchema),
    defaultValues: { bankBin: bankBin ?? '', accountName: accountName ?? '', accountNumber: '' }
  });

  const fieldClass = 'w-full rounded-lg border border-border-subtle bg-surface-2 px-3 py-2.5 text-sm text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-brand-primary';

  return (
    <section className="surface-panel p-6 sm:p-7" aria-labelledby="refund-bank-title">
      <div className="mb-5 flex items-center gap-3 border-b border-border-subtle pb-4">
        <Banknote className="h-5 w-5 text-brand-primary" aria-hidden="true" />
        <div>
          <h3 id="refund-bank-title" className="text-lg font-bold text-white">Tài khoản nhận hoàn tiền</h3>
          <p className="text-xs text-text-secondary">Thông tin được mã hóa; số tài khoản chỉ hiển thị bốn số cuối.</p>
        </div>
      </div>
      {maskedAccount && <p className="mb-4 text-sm text-text-secondary">Đang lưu: {bankBin} · {accountName} · {maskedAccount}</p>}
      <form className="grid gap-4 sm:grid-cols-3" onSubmit={handleSubmit(onSave)} noValidate>
        <div>
          <label className="mb-1 block text-xs font-semibold text-text-secondary" htmlFor="refund-bank-bin">Mã BIN ngân hàng</label>
          <input id="refund-bank-bin" inputMode="numeric" autoComplete="off" className={fieldClass} {...register('bankBin')} aria-invalid={Boolean(errors.bankBin)} />
          {errors.bankBin && <p role="alert" className="mt-1 text-xs text-danger">{errors.bankBin.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-text-secondary" htmlFor="refund-account-name">Tên chủ tài khoản</label>
          <input id="refund-account-name" autoComplete="name" className={fieldClass} {...register('accountName')} aria-invalid={Boolean(errors.accountName)} />
          {errors.accountName && <p role="alert" className="mt-1 text-xs text-danger">{errors.accountName.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-text-secondary" htmlFor="refund-account-number">Số tài khoản</label>
          <input id="refund-account-number" inputMode="numeric" autoComplete="off" className={fieldClass} {...register('accountNumber')} aria-invalid={Boolean(errors.accountNumber)} />
          {errors.accountNumber && <p role="alert" className="mt-1 text-xs text-danger">{errors.accountNumber.message}</p>}
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-3">
          <button type="submit" disabled={isSubmitting} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-primary px-4 text-sm font-bold text-white disabled:opacity-60">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Lưu tài khoản
          </button>
          {maskedAccount && <button type="button" disabled={isSubmitting} onClick={() => void onDelete()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-danger/40 px-4 text-sm font-semibold text-danger disabled:opacity-60"><Trash2 className="h-4 w-4" /> Xóa tài khoản</button>}
        </div>
      </form>
    </section>
  );
}
