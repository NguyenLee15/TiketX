import { Calendar, MapPin, ArrowRight, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Event } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { ResilientImage } from '../ResilientImage';

interface EventCardProps { event: Event; featured?: boolean }

export function EventCard({ event, featured = false }: EventCardProps) {
  if (featured) {
    return (
      <article className="surface-panel overflow-hidden">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
          <div className="relative min-h-64 bg-surface-0 lg:min-h-80">
            <ResilientImage src={event.bannerUrl || event.imageUrl} alt={event.title} width="1280" height="720" fetchPriority="high" className="absolute inset-0 h-full w-full object-cover" fallbackClassName="absolute inset-0 flex items-center justify-center bg-surface-3 text-text-tertiary" />
            <div className="absolute inset-0 bg-surface-0/20" />
          </div>
          <div className="flex flex-col justify-between gap-6 p-6 sm:p-8">
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-primary">Đề xuất cho bạn</p>
              <h2 className="text-2xl font-display font-bold leading-tight text-text-primary sm:text-3xl">{event.title}</h2>
              <p className="line-clamp-3 text-base leading-relaxed text-text-secondary">{event.description}</p>
              <EventMeta event={event} />
            </div>
            <Link to={`/events/${event.id}`} className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg bg-brand-primary px-5 text-sm font-bold text-white transition-colors hover:bg-brand-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary">Xem sự kiện <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </div>
        </div>
      </article>
    );
  }

  return (
    <Link to={`/events/${event.id}`} className="group surface-raised flex h-full flex-col overflow-hidden transition-[border-color,transform] duration-200 hover:-translate-y-1 hover:border-brand-primary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary">
      <div className="relative aspect-[16/10] overflow-hidden bg-surface-0">
        <ResilientImage src={event.imageUrl} alt={event.title} width="640" height="400" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" fallbackClassName="flex h-full w-full items-center justify-center bg-surface-3 text-text-tertiary" />
        <span className="absolute left-3 top-3 rounded-md bg-surface-0/85 px-2.5 py-1 text-xs font-semibold text-text-primary">{event.category}</span>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="space-y-3">
          <h3 className="line-clamp-2 text-xl font-display font-bold leading-snug text-text-primary group-hover:text-brand-primary">{event.title}</h3>
          <EventMeta event={event} />
          <p className="line-clamp-2 text-sm leading-relaxed text-text-secondary">{event.description}</p>
        </div>
        <div className="mt-auto flex items-end justify-between gap-3 border-t border-border-subtle pt-4">
          <div><span className="block text-xs text-text-tertiary">Từ</span><span className="text-lg font-bold text-text-primary">{formatCurrency(event.basePrice)}</span></div>
          <span className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border-subtle px-3 text-sm font-bold text-text-primary group-hover:border-brand-primary group-hover:text-brand-primary">Chọn chỗ <ArrowRight className="h-4 w-4" aria-hidden="true" /></span>
        </div>
      </div>
    </Link>
  );
}

function EventMeta({ event }: { event: Event }) {
  return <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-text-secondary"><span className="inline-flex items-center gap-1.5"><Calendar className="h-4 w-4 text-brand-primary" aria-hidden="true" />{formatDate(event.date, { month: 'short', day: 'numeric', year: 'numeric' })}</span><span className="inline-flex min-w-0 items-center gap-1.5"><MapPin className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden="true" /><span className="truncate">{event.venueName || event.location}</span></span>{typeof event.availableSeatsCount === 'number' && <span className="inline-flex items-center gap-1.5 text-success"><Users className="h-4 w-4" aria-hidden="true" />Còn {event.availableSeatsCount} chỗ</span>}</div>;
}
