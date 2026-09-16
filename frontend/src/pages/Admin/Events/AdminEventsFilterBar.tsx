import React from 'react';
import { Search } from 'lucide-react';

interface AdminEventsFilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  categoryFilter: string;
  onCategoryChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
}

export const AdminEventsFilterBar: React.FC<AdminEventsFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  statusFilter,
  onStatusChange
}) => {
  return (
    <div className="surface-panel p-3.5 sm:p-4 flex flex-col md:flex-row gap-3">
      <div className="flex-1 relative flex items-center bg-surface-2 rounded-xl border border-border-subtle focus-within:border-brand-primary/50">
        <Search className="absolute left-3.5 w-4 h-4 text-text-tertiary" />
        <input 
          type="text" 
          placeholder="Tìm kiếm theo tên sự kiện, địa điểm..." 
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          aria-label="Tìm kiếm sự kiện"
          className="w-full bg-transparent pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder-text-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        />
      </div>

      <div className="flex gap-2 shrink-0 flex-wrap sm:flex-nowrap">
        <select
          value={categoryFilter}
          onChange={e => onCategoryChange(e.target.value)}
          aria-label="Lọc theo thể loại"
          className="bg-surface-2 border border-border-subtle rounded-xl px-3 py-2 text-xs sm:text-sm text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus:border-brand-primary cursor-pointer whitespace-nowrap flex-1 sm:flex-initial"
        >
          <option value="All">Tất cả thể loại</option>
          <option value="Concert">Nhạc hội (Concert)</option>
          <option value="Music">Âm nhạc (Music)</option>
          <option value="Conference">Hội nghị (Conference)</option>
          <option value="Entertainment">Giải trí (Entertainment)</option>
          <option value="Sports">Thể thao (Sports)</option>
        </select>

        <select
          value={statusFilter}
          onChange={e => onStatusChange(e.target.value)}
          aria-label="Lọc theo trạng thái"
          className="bg-surface-2 border border-border-subtle rounded-xl px-3 py-2 text-xs sm:text-sm text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus:border-brand-primary cursor-pointer whitespace-nowrap flex-1 sm:flex-initial"
        >
          <option value="All">Tất cả trạng thái</option>
          <option value="1">Đang mở bán (Published)</option>
          <option value="0">Bản nháp (Draft)</option>
          <option value="2">Đã kết thúc (Completed)</option>
          <option value="3">Đã hủy (Cancelled)</option>
          <option value="Deleted">Đã xóa (Deleted)</option>
        </select>
      </div>
    </div>
  );
};
