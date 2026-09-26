import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface TicketPaginationProps {
  currentPage: number;
  hasNextPage: boolean;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export const TicketPagination: React.FC<TicketPaginationProps> = React.memo(({
  currentPage,
  hasNextPage,
  onPageChange,
  isLoading = false,
}) => {
  const hasPrevPage = currentPage > 1;

  if (!hasPrevPage && !hasNextPage) {
    return null;
  }

  return (
    <nav
      aria-label="Phân trang vé"
      className="flex items-center justify-between gap-3 pt-4 border-t border-border-subtle"
    >
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={!hasPrevPage || isLoading}
        aria-label="Trang trước"
        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border ${
          hasPrevPage && !isLoading
            ? 'bg-surface-2 hover:bg-surface-3 text-white border-border-subtle hover:border-border-default cursor-pointer'
            : 'bg-surface-1/50 text-text-tertiary border-border-subtle/50 cursor-not-allowed opacity-50'
        } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary`}
      >
        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        <span>Trang trước</span>
      </button>

      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2/80 border border-border-subtle text-xs font-medium text-text-secondary">
        <span>Trang</span>
        <span className="font-bold text-brand-readable px-1.5 py-0.5 rounded bg-surface-3">
          {currentPage}
        </span>
      </div>

      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={!hasNextPage || isLoading}
        aria-label="Trang sau"
        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border ${
          hasNextPage && !isLoading
            ? 'bg-surface-2 hover:bg-surface-3 text-white border-border-subtle hover:border-border-default cursor-pointer'
            : 'bg-surface-1/50 text-text-tertiary border-border-subtle/50 cursor-not-allowed opacity-50'
        } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary`}
      >
        <span>Trang sau</span>
        <ChevronRight className="w-4 h-4" aria-hidden="true" />
      </button>
    </nav>
  );
});
