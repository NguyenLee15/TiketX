import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Calendar, MapPin, ChevronLeft, ChevronRight, Zap, ArrowRight, Sparkles, Tag, Users } from 'lucide-react';
import api from '../services/api';
import { Event } from '../types';
import { SkeletonCard } from '../components/Skeletons/SkeletonCard';
import { parseCatalogState, writeCatalogState } from '../utils/customerState';
import { formatCurrency, formatDate } from '../utils/formatters';

const CATEGORIES = [
  { id: 'All', label: 'Tất cả sự kiện', icon: Sparkles },
  { id: 'Concert', label: 'Concert & Âm nhạc', icon: Zap },
  { id: 'Conference', label: 'Hội thảo & Công nghệ', icon: Users },
  { id: 'Entertainment', label: 'Giải trí & Hài kịch', icon: Tag },
  { id: 'Sports', label: 'Thể thao & Trận đấu', icon: Calendar },
];

export default function DashboardPage() {
  const [urlParams, setUrlParams] = useSearchParams();
  const initial = parseCatalogState(urlParams);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  
  const [search, setSearch] = useState(initial.search);
  const [selectedCategory, setSelectedCategory] = useState(initial.category);
  const [sortBy, setSortBy] = useState(initial.sort);
  const [page, setPage] = useState(initial.page);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTrigger, setSearchTrigger] = useState(0);

  useEffect(() => {
    setUrlParams(writeCatalogState({ search, category: selectedCategory, sort: sortBy, page }));
  }, [page, searchTrigger, selectedCategory, sortBy, setUrlParams]);

  useEffect(() => {
    const next = parseCatalogState(urlParams);
    setSearch(next.search); setSelectedCategory(next.category); setSortBy(next.sort); setPage(next.page);
  }, [urlParams]);

  useEffect(() => {
    const controller = new AbortController();
    let isCancelled = false;

    const fetchEvents = async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          pageSize: '6',
          sortBy: sortBy
        });
        if (search.trim()) params.append('search', search.trim());
        if (selectedCategory && selectedCategory !== 'All') params.append('category', selectedCategory);

        const res = await api.get(`/api/events?${params.toString()}`, {
          signal: controller.signal
        });
        if (!isCancelled && res.data.success) {
          setEvents(res.data.data.items || []);
          setTotalPages(res.data.data.totalPages || 1);
          setTotalCount(res.data.data.totalCount || 0);
        } else if (!isCancelled) {
          setLoadError(true);
        }
      } catch (err: unknown) {
        if (!isCancelled && (err as { name?: string })?.name !== 'CanceledError' && (err as { code?: string })?.code !== 'ERR_CANCELED') {
          console.error('Error fetching events:', err);
          setLoadError(true);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchEvents();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [page, selectedCategory, sortBy, searchTrigger]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearchTrigger(prev => prev + 1);
  };

  const featuredEvent = events.length > 0 ? events[0] : null;

  return (
    <div className="space-y-12 sm:space-y-16 pb-16 text-text-primary max-w-7xl mx-auto">
      {/* Cinematic Hero Section */}
      <section className="relative pt-8 sm:pt-12 pb-14 flex flex-col items-center justify-center text-center overflow-hidden">
        {/* Ambient Gradient Glows */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[450px] bg-brand-primary/15 blur-[120px] pointer-events-none rounded-full" />
        <div className="absolute top-1/3 right-1/4 w-[350px] h-[350px] bg-brand-secondary/10 blur-[100px] pointer-events-none rounded-full" />
        
        <div className="relative z-10 max-w-4xl mx-auto px-4 space-y-4 animate-slide-up">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-border-subtle bg-surface-glass backdrop-blur-xl mb-1 shadow-inner">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-secondary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-secondary"></span>
            </span>
            <span className="text-xs font-bold text-text-secondary tracking-widest uppercase">
              TickeX — Đặt Vé Sự Kiện Trực Tuyến
            </span>
          </div>
          
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-display font-black tracking-tight leading-[1.15] text-white">
            Trải Nghiệm Đỉnh Cao.<br />
            <span className="text-gradient-brand">Giữ Chỗ Thời Gian Thực.</span>
          </h1>
          
          <p className="text-sm sm:text-base text-text-secondary max-w-2xl mx-auto font-light leading-relaxed">
            Hệ thống phân tầng hạng vé VIP, Standard, Economy với công nghệ khóa chống trùng ghế tức thì và xuất vé điện tử tích hợp chữ ký số QR bảo mật.
          </p>
        </div>

        {/* Search Bar & Filter Controls */}
        <div className="relative z-20 w-full max-w-3xl mx-auto mt-8 px-4 animate-slide-up delay-200">
          <form onSubmit={handleSearchSubmit} className="glass-panel p-2.5 rounded-2xl flex flex-col md:flex-row gap-3 shadow-2xl backdrop-blur-2xl border border-border-subtle">
            <div className="flex-1 relative flex items-center bg-surface-2/80 rounded-xl overflow-hidden border border-transparent focus-within:border-brand-primary transition-colors">
              <Search className="absolute left-4 w-5 h-5 text-text-tertiary" />
              <input 
                type="text" 
                placeholder="Tìm kiếm đại nhạc hội, hội nghị công nghệ, nghệ sĩ, địa điểm..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-transparent pl-12 pr-4 py-3.5 text-white placeholder-text-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary text-sm md:text-base"
              />
            </div>

            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={e => { setSortBy(e.target.value); setPage(1); }}
                className="bg-surface-2/80 border border-transparent hover:border-border-focus text-text-secondary hover:text-white px-4 py-3.5 rounded-xl text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer"
              >
                <option value="date_asc" className="bg-surface-2 text-white">Ngày: Gần nhất trước</option>
                <option value="date_desc" className="bg-surface-2 text-white">Ngày: Xa nhất trước</option>
                <option value="price_asc" className="bg-surface-2 text-white">Giá: Thấp đến cao</option>
                <option value="price_desc" className="bg-surface-2 text-white">Giá: Cao đến thấp</option>
              </select>

              <button 
                type="submit" 
                className="px-7 py-3.5 bg-gradient-to-r from-brand-primary to-brand-secondary hover:opacity-95 text-white rounded-xl font-bold transition-[opacity,transform] shrink-0 active:scale-95 flex items-center gap-2 shadow-lg shadow-brand-glow"
              >
                Tìm kiếm
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>

          {/* Category Tabs Pills */}
          <div className="flex items-center justify-center gap-2 mt-6 overflow-x-auto pb-2 hide-scrollbar">
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => { setSelectedCategory(cat.id); setPage(1); }}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition-[color,background-color,transform] shrink-0 ${
                    isActive 
                      ? 'bg-white text-black shadow-lg shadow-white/10 scale-105 font-bold' 
                      : 'bg-surface-2/60 text-text-secondary hover:text-white hover:bg-surface-2 border border-border-subtle'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-black' : 'text-brand-primary'}`} />
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Featured Spotlight Card (If available) */}
      {featuredEvent && (
        <section className="px-4 mx-auto max-w-7xl">
          <div className="relative rounded-3xl overflow-hidden border border-border-subtle glass-panel group shadow-2xl">
            <div className="absolute inset-0">
              <img 
                src={featuredEvent.bannerUrl || featuredEvent.imageUrl} 
                alt={featuredEvent.title} 
                width="1280"
                height="720"
                fetchPriority="high"
                className="w-full h-full object-cover opacity-40 group-hover:scale-105 transition-transform duration-1000"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-surface-1 via-surface-1/80 to-transparent" />
            </div>

            <div className="relative z-10 p-8 md:p-12 flex flex-col md:flex-row items-start md:items-end justify-between gap-8">
              <div className="max-w-2xl space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-primary/20 border border-brand-primary/30 text-xs font-bold text-brand-primary uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" />
                  Sự kiện nổi bật
                </div>
                <h2 className="text-3xl md:text-5xl font-display font-black text-white tracking-tight leading-tight">
                  {featuredEvent.title}
                </h2>
                <p className="text-text-secondary line-clamp-2 text-sm md:text-base font-light">
                  {featuredEvent.description}
                </p>

                <div className="flex flex-wrap items-center gap-4 text-xs md:text-sm text-text-secondary pt-2">
                  <span className="flex items-center gap-1.5 bg-surface-2/60 px-3 py-1.5 rounded-lg border border-border-subtle">
                    <Calendar className="w-4 h-4 text-brand-secondary" />
                    {formatDate(featuredEvent.date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span className="flex items-center gap-1.5 bg-surface-2/60 px-3 py-1.5 rounded-lg border border-border-subtle">
                    <MapPin className="w-4 h-4 text-brand-primary" />
                    {featuredEvent.venueName ? `${featuredEvent.venueName}, ${featuredEvent.location}` : featuredEvent.location}
                  </span>
                  <span className="flex items-center gap-1.5 bg-success/10 text-success border border-success/20 px-3 py-1.5 rounded-lg font-bold">
                    <Users className="w-4 h-4" />
                    Còn {featuredEvent.availableSeatsCount ?? 0} ghế trống
                  </span>
                </div>
              </div>

              <div className="shrink-0 flex flex-col items-start md:items-end gap-3 w-full md:w-auto">
                <div className="text-left md:text-right">
                  <span className="text-xs text-text-tertiary uppercase tracking-wider font-semibold">Giá vé từ</span>
                  <div className="text-3xl font-black text-white font-display">
                    {formatCurrency(featuredEvent.basePrice)}
                  </div>
                </div>
                <Link
                  to={`/events/${featuredEvent.id}`}
                  className="w-full md:w-auto px-8 py-4 bg-white hover:bg-gray-100 text-black font-bold rounded-xl transition-[background-color,transform] shadow-xl flex items-center justify-center gap-2 group/btn"
                >
                  <span>Chọn Ghế Ngay</span>
                  <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Events Grid Section */}
      <section className="px-4 mx-auto max-w-7xl animate-slide-up delay-300 space-y-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 border-b border-border-subtle pb-6">
          <div>
            <h2 className="text-3xl font-display font-black text-white tracking-tight mb-1">
              Khám Phá Tất Cả Sự Kiện
            </h2>
            <p className="text-text-secondary text-sm">
              Hiển thị {events.length} trên tổng số {totalCount} sự kiện đang diễn ra
            </p>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : loadError ? (
          <div className="py-24 text-center glass-premium rounded-3xl border border-dashed border-danger/40" role="alert" aria-live="polite">
            <div className="w-16 h-16 bg-danger/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-danger/30 text-danger">
              <Search className="w-8 h-8" aria-hidden="true" />
            </div>
            <h3 className="text-2xl font-display font-bold text-white mb-2">Không thể tải danh sách sự kiện</h3>
            <p className="text-text-secondary text-sm max-w-sm mx-auto mb-6">
              Đã xảy ra lỗi kết nối. Vui lòng thử lại.
            </p>
            <button
              onClick={() => setSearchTrigger(prev => prev + 1)}
              className="px-6 py-2.5 bg-brand-primary hover:bg-brand-primary/90 text-white text-sm font-semibold rounded-xl border border-brand-primary transition-colors focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              Thử lại
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="py-24 text-center glass-premium rounded-3xl border border-dashed border-border-subtle">
            <div className="w-16 h-16 bg-surface-2 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-border-subtle text-text-tertiary">
              <Search className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-display font-bold text-white mb-2">Không tìm thấy sự kiện phù hợp</h3>
            <p className="text-text-secondary text-sm max-w-sm mx-auto mb-6">
              Hãy thử điều chỉnh từ khóa tìm kiếm hoặc chọn danh mục thể loại khác.
            </p>
            <button
              onClick={() => { setSearch(''); setSelectedCategory('All'); setSortBy('date_asc'); setPage(1); setSearchTrigger(prev => prev + 1); }}
              className="px-6 py-2.5 bg-surface-3 hover:bg-surface-2 text-white text-sm font-semibold rounded-xl border border-border-subtle transition-colors"
            >
              Đặt lại bộ lọc
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {events.map((event, index) => (
              <Link 
                key={event.id} 
                to={`/events/${event.id}`} 
                className="group flex flex-col glass-premium rounded-3xl overflow-hidden border border-border-subtle hover:border-brand-primary/50 transition-[border-color,transform,box-shadow] duration-500 hover:-translate-y-1.5 hover:shadow-[0_25px_50px_-12px_rgba(94,106,210,0.25)]"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                {/* Event Image Banner */}
                <div className="aspect-[16/10] w-full overflow-hidden relative bg-surface-2">
                  <img 
                    src={event.imageUrl}
                    alt={event.title} 
                    width="640"
                    height="400"
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-surface-1 via-transparent to-transparent opacity-80" />
                  
                  {/* Category Pill Tag */}
                  <div className="absolute top-4 left-4">
                    <span className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white rounded-full bg-surface-0/80 backdrop-blur-md border border-border-subtle whitespace-nowrap">
                      {event.category}
                    </span>
                  </div>

                  {/* Remaining Seats Pill */}
                  <div className="absolute top-4 right-4">
                    <span className="px-3 py-1 text-[11px] font-bold text-success rounded-full bg-surface-0/80 backdrop-blur-md border border-success/20 whitespace-nowrap">
                      Còn {event.availableSeatsCount ?? 0} ghế
                    </span>
                  </div>
                </div>
                
                {/* Event Details Content */}
                <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-3 text-xs text-text-tertiary font-medium">
                      <span className="flex items-center gap-1.5 text-brand-secondary font-semibold whitespace-nowrap">
                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                        <span>{formatDate(event.date, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1.5 truncate">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{event.venueName || event.location}</span>
                      </span>
                    </div>

                    <h3 className="text-xl font-display font-bold text-white group-hover:text-brand-primary transition-colors line-clamp-2 leading-snug">
                      {event.title}
                    </h3>
                    
                    <p className="text-xs md:text-sm text-text-secondary line-clamp-2 font-light leading-relaxed">
                      {event.description}
                    </p>
                  </div>
                  
                  <div className="pt-4 border-t border-border-subtle flex items-center justify-between gap-2">
                    <div className="shrink-0 whitespace-nowrap">
                      <span className="text-[11px] uppercase tracking-wider text-text-tertiary font-semibold block">Giá từ</span>
                      <span className="text-lg font-black text-white font-display">
                        {formatCurrency(event.basePrice)}
                      </span>
                    </div>

                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-3 group-hover:bg-brand-primary text-white text-xs font-bold transition-colors shadow-md shrink-0 whitespace-nowrap">
                      <span>Chọn ghế</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-12">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-3 border border-border-subtle rounded-xl glass-premium hover:bg-surface-2 disabled:opacity-30 disabled:hover:bg-transparent transition-[background-color,opacity]"
            >
              <ChevronLeft className="w-4 h-4 text-white" />
            </button>
            
            <div className="flex items-center gap-1.5 mx-2">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i + 1)}
                  className={`w-10 h-10 rounded-xl text-sm font-bold transition-[color,background-color,transform] ${
                    page === i + 1 
                      ? 'bg-brand-primary text-white shadow-lg shadow-brand-glow scale-105' 
                      : 'glass-premium text-text-secondary hover:text-white hover:bg-surface-2 border border-border-subtle'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            <button 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-3 border border-border-subtle rounded-xl glass-premium hover:bg-surface-2 disabled:opacity-30 disabled:hover:bg-transparent transition-[background-color,opacity]"
            >
              <ChevronRight className="w-4 h-4 text-white" />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
