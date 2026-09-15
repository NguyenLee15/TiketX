import React from 'react';
import { Calendar, MapPin, Sparkles } from 'lucide-react';
import { EventDetail } from '../../types';
import { formatDate } from '../../utils/formatters';

interface EventInfoCardProps {
  event: EventDetail;
}

export const EventInfoCard: React.FC<EventInfoCardProps> = ({ event }) => {
  return (
    <div className="glass-premium p-5 sm:p-6 rounded-2xl border border-border-subtle shadow-xl relative overflow-hidden group">
      {event.imageUrl && (
        <>
          <div 
            className="absolute inset-0 bg-cover bg-center opacity-25 blur-xl scale-110 transition-transform duration-1000 group-hover:scale-125" 
            style={{ backgroundImage: `url(${event.imageUrl})` }} 
          />
        </>
      )}
      
      <div className="relative z-10 space-y-3.5">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-primary/20 border border-brand-primary/30 backdrop-blur-md">
          <Sparkles className="w-3 h-3 text-brand-primary" />
          <span className="text-[11px] font-bold text-brand-primary uppercase tracking-wider">{event.category}</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-display font-black text-white leading-snug tracking-tight">
          {event.title}
        </h1>
        <p className="text-text-secondary text-xs sm:text-sm leading-relaxed line-clamp-3 font-light">
          {event.description}
        </p>
        
        <div className="space-y-2.5 pt-1">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-2/60 border border-border-subtle backdrop-blur-md">
            <div className="w-8 h-8 rounded-lg bg-brand-primary/20 border border-brand-primary/30 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 text-brand-primary" />
            </div>
            <div>
              <p className="text-[10px] text-text-tertiary font-bold uppercase tracking-wider">Thời Gian</p>
              <p className="font-bold text-white text-xs sm:text-sm">
                {formatDate(event.date, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
              </p>
              <p className="text-[11px] text-brand-secondary font-semibold">
                {formatDate(event.date, { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-2/60 border border-border-subtle backdrop-blur-md">
            <div className="w-8 h-8 rounded-lg bg-brand-secondary/20 border border-brand-secondary/30 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 text-brand-secondary" />
            </div>
            <div>
              <p className="text-[10px] text-text-tertiary font-bold uppercase tracking-wider">Địa Điểm</p>
              <p className="font-bold text-white text-xs sm:text-sm">{event.venueName || event.location}</p>
              {event.venueName && <p className="text-[11px] text-text-secondary">{event.location}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
