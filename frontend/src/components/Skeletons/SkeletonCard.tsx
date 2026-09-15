import React from 'react';

export const SkeletonCard: React.FC = () => {
  return (
    <div className="surface-raised rounded-xl overflow-hidden flex flex-col h-full animate-pulse">
      {/* Poster Image Placeholder */}
      <div className="relative aspect-[16/10] bg-surface-2/80 w-full overflow-hidden">
        <div className="absolute top-4 left-4 w-20 h-6 rounded-full bg-surface-3/80" />
      </div>

      {/* Card Content Placeholder */}
      <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-3">
          {/* Title Placeholder */}
          <div className="h-6 bg-surface-3/80 rounded-lg w-3/4" />
          <div className="h-4 bg-surface-3/50 rounded-lg w-1/2" />

          {/* Meta Info Placeholders */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-surface-3/80 shrink-0" />
              <div className="h-3.5 bg-surface-3/60 rounded w-2/3" />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-surface-3/80 shrink-0" />
              <div className="h-3.5 bg-surface-3/60 rounded w-1/2" />
            </div>
          </div>
        </div>

        {/* Footer: Price & CTA */}
        <div className="pt-4 border-t border-border-subtle/60 flex items-center justify-between">
          <div className="space-y-1">
            <div className="h-2.5 bg-surface-3/50 rounded w-12" />
            <div className="h-5 bg-surface-3/80 rounded w-24" />
          </div>
          <div className="h-10 w-28 bg-surface-3 rounded-xl" />
        </div>
      </div>
    </div>
  );
};
