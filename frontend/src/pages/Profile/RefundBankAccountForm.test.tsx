import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RefundBankAccountForm } from './RefundBankAccountForm';

describe('RefundBankAccountForm', () => {
  afterEach(() => {
    cleanup();
  });
  it('validates destination details and submits the normalized account data', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<RefundBankAccountForm onSave={onSave} onDelete={vi.fn()} isSubmitting={false} />);

    fireEvent.change(screen.getByLabelText('Mã BIN ngân hàng'), { target: { value: '970415' } });
    fireEvent.change(screen.getByLabelText('Tên chủ tài khoản'), { target: { value: '  Test Account  ' } });
    fireEvent.change(screen.getByLabelText('Số tài khoản'), { target: { value: '123456789' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu tài khoản' }));

    await waitFor(() => expect(onSave.mock.calls[0]?.[0]).toEqual({ bankBin: '970415', accountName: 'Test Account', accountNumber: '123456789' }));
  });

  it('shows only the masked account number and offers deletion when configured', () => {
    render(<RefundBankAccountForm bankBin="970415" accountName="TEST ACCOUNT" maskedAccount="•••• 6789" onSave={vi.fn()} onDelete={vi.fn()} isSubmitting={false} />);

    expect(screen.getByText(/•••• 6789/)).toBeInTheDocument();
    expect(screen.getByLabelText('Số tài khoản')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Xóa tài khoản' })).toBeInTheDocument();
  });

  it('requires confirmation before calling onDelete', () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<RefundBankAccountForm bankBin="970415" accountName="TEST ACCOUNT" maskedAccount="•••• 6789" onSave={vi.fn()} onDelete={onDelete} isSubmitting={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Xóa tài khoản' }));
    expect(screen.getByText('Xác nhận xóa tài khoản?')).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
