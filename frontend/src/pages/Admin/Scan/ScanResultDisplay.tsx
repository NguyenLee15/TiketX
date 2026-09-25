import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, AlertOctagon } from 'lucide-react';
import { formatDate } from '../../../utils/formatters';

export interface ScanTicketData {
  ticketId: string;
  eventTitle: string;
  attendeeName: string;
  attendeeEmail?: string;
  row: string;
  number: number;
  tier: number | string;
  price?: number;
  orderCode?: string | number;
  checkedInAt?: string;
}

export interface ScanResult {
  status: 'valid' | 'already_used' | 'conflict' | 'invalid';
  message: string;
  ticket?: ScanTicketData;
}

interface ScanResultDisplayProps {
  scanResult: ScanResult | null;
}

export const ScanResultDisplay: React.FC<ScanResultDisplayProps> = ({ scanResult }) => {
  return (
    <div 
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="surface-panel p-5 sm:p-6 min-h-[220px] flex flex-col justify-center relative overflow-hidden"
    >
      {scanResult ? (
        <div className="space-y-3.5 animate-in zoom-in-95 duration-300">
          {scanResult.status === 'valid' && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center space-y-1.5">
              <CheckCircle2 className="w-10 h-10 text-success mx-auto" aria-hidden="true" />
              <h3 className="text-sm font-black text-emerald-400 uppercase tracking-wide">{scanResult.message}</h3>
            </div>
          )}

          {scanResult.status === 'already_used' && (
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-center space-y-1.5">
              <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" aria-hidden="true" />
              <h3 className="text-xs font-black text-amber-400 uppercase tracking-wide">{scanResult.message}</h3>
            </div>
          )}

          {scanResult.status === 'conflict' && (
            <div className="p-3.5 bg-amber-600/15 border border-amber-500/40 rounded-xl text-center space-y-1.5">
              <AlertOctagon className="w-10 h-10 text-amber-300 mx-auto" aria-hidden="true" />
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-bold uppercase">
                Xung Đột Trạm Soát Vé (HTTP 409)
              </div>
              <h3 className="text-xs font-black text-amber-200 tracking-wide">{scanResult.message}</h3>
              <p className="text-[11px] text-amber-300/80">Vui lòng đợi 3 giây và quét lại hoặc kiểm tra trạm soát vé lân cận.</p>
            </div>
          )}

          {scanResult.status === 'invalid' && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-center space-y-1.5">
              <XCircle className="w-10 h-10 text-red-400 mx-auto" aria-hidden="true" />
              <h3 className="text-xs font-black text-red-400 uppercase tracking-wide">{scanResult.message}</h3>
            </div>
          )}

          {/* Ticket Details Box */}
          {scanResult.ticket && (
            <div aria-live="off" className="bg-surface-2 p-3.5 rounded-xl border border-border-subtle space-y-2 text-xs">
              <div className="flex justify-between items-center pb-1.5 border-b border-border-subtle">
                <span className="text-text-secondary">Khách Hàng:</span>
                <span className="font-bold text-white text-sm">{scanResult.ticket.attendeeName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Sự Kiện:</span>
                <span className="font-medium text-white line-clamp-1">{scanResult.ticket.eventTitle}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Vị Trí Ghế:</span>
                <span className="font-bold text-brand-primary text-sm">
                  Hàng {scanResult.ticket.row} - Ghế {scanResult.ticket.number}
                </span>
              </div>
              {scanResult.ticket.orderCode ? (
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary">Mã Đơn Hàng:</span>
                  <span className="font-mono text-text-tertiary">#{scanResult.ticket.orderCode}</span>
                </div>
              ) : null}
              {scanResult.ticket.checkedInAt && (
                <div className="flex justify-between items-center pt-1.5 border-t border-border-subtle text-text-tertiary text-[11px]">
                  <span>Thời Gian Soát:</span>
                  <span className="font-mono text-text-secondary">{formatDate(scanResult.ticket.checkedInAt)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-6 space-y-2 text-text-tertiary">
          <div className="w-12 h-12 rounded-2xl bg-surface-2 border border-border-subtle flex items-center justify-center mx-auto text-text-muted">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium">Sẵn sàng soát vé</p>
          <p className="text-xs max-w-xs mx-auto">
            Đưa mã QR trên vé vào khung quét camera hoặc dán chuỗi token chữ ký số bên trái để kiểm tra.
          </p>
        </div>
      )}
    </div>
  );
};
