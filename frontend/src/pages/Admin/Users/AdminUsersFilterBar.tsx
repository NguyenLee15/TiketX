import React from 'react';
import { Search } from 'lucide-react';

interface AdminUsersFilterBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  roleFilter: string;
  onRoleChange: (value: string) => void;
  blockFilter: string;
  onBlockChange: (value: string) => void;
}

export const AdminUsersFilterBar: React.FC<AdminUsersFilterBarProps> = ({
  searchTerm,
  onSearchChange,
  roleFilter,
  onRoleChange,
  blockFilter,
  onBlockChange
}) => {
  return (
    <div className="surface-panel p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
      <div className="relative w-full sm:w-80">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input 
          id="user-search"
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Tìm theo tên hoặc email..."
          aria-label="Tìm người dùng theo tên hoặc email"
          className="w-full bg-surface-2 border border-border-subtle rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus:border-brand-primary/50"
        />
      </div>

      <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap">
        {/* Role Filter */}
        <select 
          value={roleFilter}
          onChange={(e) => onRoleChange(e.target.value)}
          aria-label="Lọc theo vai trò"
          className="bg-surface-2 border border-border-subtle rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus:border-brand-primary cursor-pointer flex-1 sm:flex-initial"
        >
          <option value="">Tất cả vai trò</option>
          <option value="Admin">Quản trị viên (Admin)</option>
          <option value="Staff">Nhân viên soát vé (Staff)</option>
          <option value="Customer">Khách hàng (Customer)</option>
        </select>

        {/* Block Status Filter */}
        <select 
          value={blockFilter}
          onChange={(e) => onBlockChange(e.target.value)}
          aria-label="Lọc theo trạng thái tài khoản"
          className="bg-surface-2 border border-border-subtle rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus:border-brand-primary cursor-pointer flex-1 sm:flex-initial"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="blocked">Đã bị khóa</option>
        </select>
      </div>
    </div>
  );
};
