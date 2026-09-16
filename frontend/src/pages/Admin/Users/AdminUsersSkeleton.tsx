import React from 'react';

export const AdminUsersSkeleton: React.FC = () => {
  return (
    <div className="surface-panel overflow-hidden shadow-lg animate-pulse" role="status" aria-label="Đang tải danh sách người dùng...">
      <div className="p-4 border-b border-border-subtle bg-surface-2/20 flex justify-between items-center">
        <div className="h-4 w-36 bg-surface-3 rounded-lg" />
        <div className="h-4 w-24 bg-surface-3 rounded-lg" />
      </div>
      <div className="divide-y divide-border-subtle">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-9 h-9 rounded-full bg-surface-3 shrink-0" />
              <div className="space-y-1.5 flex-1 max-w-sm">
                <div className="h-4 w-2/3 bg-surface-3 rounded" />
                <div className="h-3 w-1/3 bg-surface-2 rounded" />
              </div>
            </div>
            <div className="hidden sm:block h-4 w-40 bg-surface-3 rounded" />
            <div className="hidden md:block h-6 w-24 bg-surface-3 rounded-full" />
            <div className="hidden lg:block h-6 w-20 bg-surface-3 rounded-full" />
            <div className="h-8 w-24 bg-surface-3 rounded-xl shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
};
