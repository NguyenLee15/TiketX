import React from 'react';
import { 
  Shield, ShieldAlert, Ban, CheckCircle, Mail, 
  Phone, ShieldCheck, ChevronLeft, ChevronRight 
} from 'lucide-react';

export interface AdminUserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  isBlocked: boolean;
  avatarUrl?: string;
  phone?: string;
  createdAt?: string;
  version?: string;
}

interface AdminUsersTableProps {
  users: AdminUserItem[];
  currentUserId?: string;
  totalCount: number;
  page: number;
  totalPages: number;
  isSubmitting: boolean;
  onPageChange: (newPage: number) => void;
  onRequestChangeRole: (user: AdminUserItem, newRole: string) => void;
  onRequestToggleBlock: (user: AdminUserItem, targetBlocked: boolean) => void;
}

export const AdminUsersTable: React.FC<AdminUsersTableProps> = ({
  users,
  currentUserId,
  totalCount,
  page,
  totalPages,
  isSubmitting,
  onPageChange,
  onRequestChangeRole,
  onRequestToggleBlock
}) => {
  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block surface-panel overflow-hidden relative shadow-lg">
        <div className="overflow-x-auto relative z-10">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-2/50 text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                <th className="p-4 sm:p-5 whitespace-nowrap">Thông Tin Người Dùng</th>
                <th className="p-4 sm:p-5 whitespace-nowrap">Liên Hệ</th>
                <th className="p-4 sm:p-5 whitespace-nowrap">Vai Trò</th>
                <th className="p-4 sm:p-5 whitespace-nowrap">Trạng Thái</th>
                <th className="p-4 sm:p-5 text-right whitespace-nowrap">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-xs sm:text-sm">
              {users.map(user => {
                const isSelf = currentUserId === user.id;
                return (
                  <tr key={user.id} className="hover:bg-surface-2/30 transition-colors group">
                    <td className="p-4 sm:p-5">
                      <div className="flex items-center gap-3">
                        {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt="" width="36" height="36" loading="lazy" className="w-9 h-9 rounded-full object-cover border border-surface-2 shadow-md shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-surface-3 flex items-center justify-center border border-surface-2 shadow-md shrink-0">
                            <span className="text-sm font-black text-white">{user.name?.charAt(0) || 'U'}</span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-bold text-white group-hover:text-brand-primary transition-colors line-clamp-1 flex items-center gap-1.5">
                            {user.name}
                            {isSelf && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-primary/20 text-brand-primary font-mono font-normal">
                                (Bạn)
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-mono text-text-tertiary whitespace-nowrap">
                            ID: {user.id.substring(0, 8)}...
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 sm:p-5 whitespace-nowrap">
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-1.5 text-text-primary">
                          <Mail className="w-3.5 h-3.5 text-text-secondary shrink-0" />
                          <span className="truncate">{user.email}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-text-secondary">
                          <Phone className="w-3.5 h-3.5 opacity-50 shrink-0" />
                          <span>{user.phone || 'Chưa cập nhật SĐT'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 sm:p-5 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border whitespace-nowrap ${
                        user.role === 'Admin' 
                          ? 'bg-brand-primary/15 text-brand-primary border-brand-primary/30' :
                        user.role === 'Staff'
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-surface-3 text-text-secondary border-border-subtle'
                      }`}>
                        {user.role === 'Admin' ? <ShieldAlert className="w-3.5 h-3.5" /> : 
                         user.role === 'Staff' ? <ShieldCheck className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                        {user.role === 'Admin' ? 'Quản trị viên' : user.role === 'Staff' ? 'Soát vé (Staff)' : 'Khách hàng'}
                      </span>
                    </td>
                    <td className="p-4 sm:p-5 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border whitespace-nowrap ${
                        user.isBlocked 
                          ? 'bg-danger/15 text-danger border-danger/30' 
                          : 'bg-success/15 text-success border-success/30'
                      }`}>
                        {user.isBlocked ? <Ban className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                        {user.isBlocked ? 'Đã khóa' : 'Hoạt động'}
                      </span>
                    </td>
                    <td className="p-4 sm:p-5 text-right whitespace-nowrap">
                      <div className="flex justify-end items-center gap-2 shrink-0">
                        <select 
                          value={user.role}
                          disabled={isSelf || isSubmitting}
                          onChange={(e) => onRequestChangeRole(user, e.target.value)}
                          className="bg-surface-1 border border-border-subtle hover:border-brand-primary rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary transition-colors cursor-pointer font-semibold whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <option value="Customer">Khách hàng (Customer)</option>
                          <option value="Staff">Nhân viên soát vé (Staff)</option>
                          <option value="Admin">Quản trị viên (Admin)</option>
                        </select>
                        
                        <button 
                          onClick={() => onRequestToggleBlock(user, !user.isBlocked)}
                          disabled={isSelf || isSubmitting}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary border whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${
                            user.isBlocked 
                              ? 'bg-success/15 hover:bg-success text-success hover:text-white border-success/30' 
                              : 'bg-danger/15 hover:bg-danger text-danger hover:text-white border-danger/30'
                          }`}
                        >
                          {user.isBlocked ? 'Mở Khóa' : 'Khóa'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-text-secondary text-xs sm:text-sm">
                    Không tìm thấy người dùng nào phù hợp với bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View (< md) */}
      <div className="block md:hidden space-y-3.5">
        {users.map(user => {
          const isSelf = currentUserId === user.id;
          return (
            <div key={user.id} className="surface-panel p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" width="40" height="40" loading="lazy" className="w-10 h-10 rounded-full object-cover shrink-0 border border-surface-2" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-surface-3 flex items-center justify-center shrink-0 border border-surface-2">
                      <span className="text-sm font-bold text-white">{user.name?.charAt(0) || 'U'}</span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-white text-sm truncate flex items-center gap-1">
                      {user.name}
                      {isSelf && <span className="text-[10px] text-brand-primary">(Bạn)</span>}
                    </p>
                    <p className="text-xs text-text-secondary truncate">{user.email}</p>
                  </div>
                </div>

                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                  user.isBlocked ? 'bg-danger/15 text-danger border-danger/30' : 'bg-success/15 text-success border-success/30'
                }`}>
                  {user.isBlocked ? 'Đã khóa' : 'Hoạt động'}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-border-subtle">
                <select 
                  value={user.role}
                  disabled={isSelf || isSubmitting}
                  onChange={(e) => onRequestChangeRole(user, e.target.value)}
                  className="bg-surface-2 border border-border-subtle rounded-xl px-2.5 py-1.5 text-xs text-white flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:opacity-40"
                >
                  <option value="Customer">Khách hàng</option>
                  <option value="Staff">Soát vé (Staff)</option>
                  <option value="Admin">Quản trị (Admin)</option>
                </select>

                <button
                  onClick={() => onRequestToggleBlock(user, !user.isBlocked)}
                  disabled={isSelf || isSubmitting}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border shrink-0 disabled:opacity-40 ${
                    user.isBlocked 
                      ? 'bg-success/15 text-success border-success/30' 
                      : 'bg-danger/15 text-danger border-danger/30'
                  }`}
                >
                  {user.isBlocked ? 'Mở Khóa' : 'Khóa'}
                </button>
              </div>
            </div>
          );
        })}

        {users.length === 0 && (
          <p className="p-8 text-center text-text-secondary text-xs">Không tìm thấy người dùng nào.</p>
        )}
      </div>

      {/* Server-side Pagination Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 pt-2 text-xs text-text-secondary">
        <p>
          Hiển thị <span className="font-bold text-white">{users.length}</span> / <span className="font-bold text-white">{totalCount}</span> người dùng (Trang {page}/{totalPages})
        </p>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="p-1.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-white border border-border-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            title="Trang trước"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <span className="px-3 py-1 rounded-xl bg-surface-2 border border-border-subtle text-white font-mono">
            {page}
          </span>

          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="p-1.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-white border border-border-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            title="Trang sau"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
};
