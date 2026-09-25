import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { SkeletonCard } from '../components/Skeletons/SkeletonCard';
import { DiscoveryHero } from '../components/Discovery/DiscoveryHero';
import { EventCard } from '../components/Discovery/EventCard';
import { parseCatalogState, writeCatalogState } from '../utils/customerState';
import { useEventsCatalogQuery } from '../hooks/useCustomerQueries';

export default function DashboardPage() {
  const [urlParams, setUrlParams] = useSearchParams();
  const catalogState = parseCatalogState(urlParams);
  const { search: urlSearch, category, sort: sortBy, page } = catalogState;

  // Local draft state for search input text
  const [searchInput, setSearchInput] = useState(urlSearch);

  // Keep searchInput in sync when URL changes via back/forward navigation
  useEffect(() => {
    setSearchInput(urlSearch);
  }, [urlSearch]);

  const updateFilters = useCallback((updates: Partial<typeof catalogState>) => {
    const next = {
      search: updates.search !== undefined ? updates.search : urlSearch,
      category: updates.category !== undefined ? updates.category : category,
      sort: updates.sort !== undefined ? updates.sort : sortBy,
      page: updates.page !== undefined ? updates.page : 1,
    };
    setUrlParams(writeCatalogState(next));
  }, [urlSearch, category, sortBy, setUrlParams]);

  const {
    data: catalogResult,
    isLoading: loading,
    isError: loadError,
    refetch,
  } = useEventsCatalogQuery({
    page,
    pageSize: 6,
    search: urlSearch,
    category,
    sort: sortBy,
  });

  const events = catalogResult?.items ?? [];
  const totalPages = catalogResult?.totalPages ?? 1;
  const totalCount = catalogResult?.totalCount ?? 0;

  const resetFilters = () => {
    setSearchInput('');
    setUrlParams(writeCatalogState({ search: '', category: 'All', sort: 'date_asc', page: 1 }));
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({ search: searchInput, page: 1 });
  };

  const featuredEvent = events[0];

  return (
    <div className="space-y-10 pb-16 text-text-primary">
      <DiscoveryHero
        search={searchInput}
        sortBy={sortBy}
        selectedCategory={category}
        onSearchChange={setSearchInput}
        onSortChange={(value) => updateFilters({ sort: value, page: 1 })}
        onCategoryChange={(value) => updateFilters({ category: value, page: 1 })}
        onSubmit={handleSearchSubmit}
      />

      {featuredEvent && <EventCard event={featuredEvent} featured />}

      <section aria-labelledby="catalog-title" className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border-subtle pb-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-primary">Lịch sự kiện</p>
            <h2 id="catalog-title" className="mt-1 text-2xl font-display font-bold text-text-primary sm:text-3xl">Khám phá chương trình</h2>
          </div>
          <p className="text-sm text-text-secondary">{events.length} / {totalCount} sự kiện</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <SkeletonCard key={item} />
            ))}
          </div>
        ) : loadError ? (
          <StatePanel
            title="Không thể tải danh sách sự kiện"
            message="Kiểm tra kết nối rồi thử lại."
            actionLabel="Thử lại"
            onAction={() => void refetch()}
          />
        ) : events.length === 0 ? (
          <StatePanel
            title="Chưa có sự kiện phù hợp"
            message="Thử từ khóa hoặc danh mục khác."
            actionLabel="Đặt lại bộ lọc"
            onAction={resetFilters}
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {events.slice(1).map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <nav aria-label="Phân trang sự kiện" className="flex items-center justify-center gap-2 pt-4">
            <button
              type="button"
              aria-label="Trang trước"
              onClick={() => updateFilters({ page: Math.max(1, page - 1) })}
              disabled={page === 1}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border-subtle bg-surface-2 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="px-3 text-sm text-text-secondary">
              Trang {page} / {totalPages}
            </span>
            <button
              type="button"
              aria-label="Trang sau"
              onClick={() => updateFilters({ page: Math.min(totalPages, page + 1) })}
              disabled={page === totalPages}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border-subtle bg-surface-2 disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </nav>
        )}
      </section>
    </div>
  );
}

interface StatePanelProps {
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
}

function StatePanel({ title, message, actionLabel, onAction }: StatePanelProps) {
  return (
    <div className="surface-panel flex flex-col items-center justify-center px-6 py-16 text-center">
      <RotateCcw className="mb-4 h-8 w-8 text-brand-primary" aria-hidden="true" />
      <h3 className="text-xl font-display font-bold text-text-primary">{title}</h3>
      <p className="mt-2 text-base text-text-secondary">{message}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-brand-primary px-5 text-sm font-bold text-white hover:bg-brand-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer"
      >
        {actionLabel}
      </button>
    </div>
  );
}
