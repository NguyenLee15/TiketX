import { FormEvent } from 'react';
import { ArrowRight, Calendar, Search, Sparkles, Tag, Users, Zap } from 'lucide-react';

const CATEGORIES = [
  { id: 'All', label: 'Tất cả sự kiện', icon: Sparkles },
  { id: 'Concert', label: 'Âm nhạc', icon: Zap },
  { id: 'Conference', label: 'Hội thảo', icon: Users },
  { id: 'Entertainment', label: 'Giải trí', icon: Tag },
  { id: 'Sports', label: 'Thể thao', icon: Calendar },
];

interface DiscoveryHeroProps {
  search: string;
  sortBy: string;
  selectedCategory: string;
  onSearchChange: (value: string) => void;
  onSortChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}

export function DiscoveryHero({
  search,
  sortBy,
  selectedCategory,
  onSearchChange,
  onSortChange,
  onCategoryChange,
  onSubmit,
}: DiscoveryHeroProps) {
  return (
    <section className="border-b border-border-subtle pb-10 sm:pb-12">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
        <div className="max-w-2xl space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-primary">TickeX / Sự kiện</p>
          <h1 className="max-w-xl text-4xl font-display font-bold leading-tight tracking-tight text-text-primary sm:text-5xl">
            Những cuộc hẹn đáng để bạn có mặt.
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-text-secondary">
            Tìm chương trình phù hợp, chọn đúng chỗ ngồi và nhận vé ngay trong một phiên đặt chỗ rõ ràng.
          </p>
        </div>

        <div className="surface-panel p-4 sm:p-5">
          <p className="mb-3 text-sm font-semibold text-text-primary">Bạn muốn đi đâu tối nay?</p>
          <form onSubmit={onSubmit} className="space-y-3">
            <label htmlFor="event-search" className="sr-only">Tìm kiếm sự kiện</label>
            <div className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface-1 px-3 focus-within:border-brand-primary">
              <Search className="h-5 w-5 shrink-0 text-text-tertiary" aria-hidden="true" />
              <input
                id="event-search"
                type="search"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Tên sự kiện, nghệ sĩ hoặc địa điểm"
                className="min-h-11 w-full bg-transparent text-base text-text-primary placeholder:text-text-tertiary focus:outline-none"
              />
              <button type="submit" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg bg-brand-primary px-4 text-sm font-bold text-white transition-colors hover:bg-brand-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary">
                Tìm
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <label htmlFor="event-sort" className="text-sm text-text-secondary">Sắp xếp sự kiện</label>
              <select id="event-sort" value={sortBy} onChange={(event) => onSortChange(event.target.value)} className="min-h-11 flex-1 rounded-lg border border-border-subtle bg-surface-1 px-3 text-sm text-text-primary focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30">
                <option value="date_asc">Ngày gần nhất</option>
                <option value="date_desc">Ngày xa nhất</option>
                <option value="price_asc">Giá thấp đến cao</option>
                <option value="price_desc">Giá cao đến thấp</option>
              </select>
            </div>
          </form>
        </div>
      </div>

      <div className="mt-8 flex gap-2 overflow-x-auto pb-1" aria-label="Lọc theo danh mục">
        {CATEGORIES.map(({ id, label, icon: Icon }) => {
          const active = selectedCategory === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => onCategoryChange(id)}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${active ? 'border-brand-primary bg-brand-primary text-white' : 'border-border-subtle bg-surface-2 text-text-secondary hover:border-brand-primary/60 hover:text-text-primary'}`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
