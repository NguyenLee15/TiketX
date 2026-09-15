import React from 'react';

export const SkeletonSeatMap: React.FC = () => {
  return (
    <div className="animate-pulse space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Back Nav Placeholder */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-surface-2" />
        <div className="w-32 h-4 rounded-lg bg-surface-2" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Col: Event Information Skeleton (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="glass-card rounded-3xl overflow-hidden border border-border-subtle/80 space-y-4 p-5">
            {/* Image Placeholder */}
            <div className="aspect-[16/10] bg-surface-2 rounded-2xl w-full" />
            
            {/* Title & Category */}
            <div className="space-y-2 pt-2">
              <div className="w-20 h-5 rounded-full bg-surface-3" />
              <div className="w-3/4 h-7 rounded-xl bg-surface-3" />
              <div className="w-1/2 h-4 rounded-lg bg-surface-2" />
            </div>

            {/* Event Info Details */}
            <div className="space-y-3 pt-3 border-t border-border-subtle/60">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-surface-2" />
                <div className="space-y-1.5 flex-1">
                  <div className="w-24 h-3 bg-surface-2 rounded" />
                  <div className="w-40 h-4 bg-surface-3 rounded" />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-surface-2" />
                <div className="space-y-1.5 flex-1">
                  <div className="w-24 h-3 bg-surface-2 rounded" />
                  <div className="w-48 h-4 bg-surface-3 rounded" />
                </div>
              </div>
            </div>

            {/* Selection Placeholder Box */}
            <div className="p-4 rounded-2xl bg-surface-2/40 border border-border-subtle/60 space-y-3">
              <div className="w-32 h-4 rounded bg-surface-3" />
              <div className="w-full h-10 rounded-xl bg-surface-3" />
            </div>
          </div>
        </div>

        {/* Right Col: Interactive Auditorium Seat Map Skeleton (8 cols) */}
        <div className="lg:col-span-8">
          <div className="glass-premium p-6 sm:p-8 rounded-3xl border border-border-subtle/80 space-y-6">
            {/* Stage Indicator Placeholder */}
            <div className="flex flex-col items-center justify-center space-y-2 py-4">
              <div className="w-48 h-2 rounded-full bg-surface-3" />
              <div className="w-32 h-4 rounded-lg bg-surface-2" />
            </div>

            {/* Legend Placeholder */}
            <div className="flex justify-center gap-4 py-2 border-b border-border-subtle/60">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-md bg-surface-3" />
                  <div className="w-16 h-3 rounded bg-surface-2" />
                </div>
              ))}
            </div>

            {/* Seat Rows Matrix Skeleton */}
            <div className="py-6 space-y-4 flex flex-col items-center">
              {['A', 'B', 'C', 'D', 'E'].map((row) => (
                <div key={row} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-md bg-surface-2 font-mono text-xs flex items-center justify-center text-text-tertiary">
                    {row}
                  </div>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <div
                        key={num}
                        className="w-8 h-8 rounded-xl bg-surface-2 border border-border-subtle/40"
                      />
                    ))}
                  </div>
                  <div className="w-6 h-6 rounded-md bg-surface-2 font-mono text-xs flex items-center justify-center text-text-tertiary">
                    {row}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
