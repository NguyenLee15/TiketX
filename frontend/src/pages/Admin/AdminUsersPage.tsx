import { useState, useEffect, useCallback } from 'react';
import { 
  Shield, ShieldAlert, Ban, CheckCircle, Loader2, Mail, 
  Phone, Users, ShieldCheck, Search, ChevronLeft, ChevronRight
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { useAuthStore } from '../../stores/useAuthStore';
import ConfirmModal from '../../components/Admin/ConfirmModal';

interface User {
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

interface ConfirmState {
  type: 'role' | 'block';
  userId: string;
  userName: string;
  currentRole?: string;
  newRole?: string;
  targetBlocked?: boolean;
  expectedVersion?: string;
}

export default function AdminUsersPage() {
  const [urlSearchParams, setUrlSearchParams] = useSearchParams();
  const { user: currentUser } = useAuthStore();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Search, Filter & Pagination
  const [searchTerm, setSearchTerm] = useState(() => urlSearchParams.get('search') || '');
  const [roleFilter, setRoleFilter] = useState(() => urlSearchParams.get('role') || '');
  const [blockFilter, setBlockFilter] = useState<string>(() => urlSearchParams.get('status') || '');
  const [page, setPage] = useState(() => Math.max(1, Number(urlSearchParams.get('page')) || 1));
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Confirm Modal state
  const [confirmModal, setConfirmModal] = useState<ConfirmState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mutationError, setMutationError] = useState('');

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const params: Record<string, string | number> = {
        page,
        pageSize
      };
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (roleFilter) params.role = roleFilter;
      if (blockFilter === 'blocked') params.isBlocked = 'true';
      if (blockFilter === 'active') params.isBlocked = 'false';

      const res = await api.get('/api/admin/users', { params });
      if (res.data.success) {
        const data = res.data.data;
        if (Array.isArray(data)) {
          setUsers(data);
          setTotalCount(data.length);
          setTotalPages(1);
        } else if (data && data.items) {
          setUsers(data.items);
          setTotalCount(data.totalCount || 0);
          setTotalPages(data.totalPages || 1);
        }
      }
    } catch {
      setLoadError(true);
      toast.error('Không thể tải danh sách người dùng.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchTerm, roleFilter, blockFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  useEffect(() => {
    const nextParams = new URLSearchParams();
    if (searchTerm.trim()) nextParams.set('search', searchTerm.trim());
    if (roleFilter) nextParams.set('role', roleFilter);
    if (blockFilter) nextParams.set('status', blockFilter);
    if (page > 1) nextParams.set('page', String(page));
    setUrlSearchParams(nextParams, { replace: true });
  }, [blockFilter, page, roleFilter, searchTerm, setUrlSearchParams]);

  const requestChangeRole = (u: User, newRole: string) => {
    if (currentUser?.id === u.id && newRole !== 'Admin') {
      toast.error('Bạn không thể tự hạ quyền Quản trị viên của chính mình.');
      return;
    }

    setMutationError('');
    setConfirmModal({
      type: 'role',
      userId: u.id,
      userName: u.name,
      currentRole: u.role,
      newRole
      ,expectedVersion: u.version
    });
  };

  const requestToggleBlock = (u: User, targetBlocked: boolean) => {
    if (currentUser?.id === u.id && targetBlocked) {
      toast.error('Bạn không thể tự khóa tài khoản của chính mình.');
      return;
    }

    setMutationError('');
    setConfirmModal({
      type: 'block',
      userId: u.id,
      userName: u.name,
      targetBlocked
      ,expectedVersion: u.version
    });
  };

  const executeConfirmedAction = async () => {
    if (!confirmModal) return;
    setIsSubmitting(true);
    setMutationError('');

    try {
      if (confirmModal.type === 'role' && confirmModal.newRole) {
          const res = await api.put(`/api/admin/users/${confirmModal.userId}/role`, { 
            role: confirmModal.newRole,
            expectedVersion: confirmModal.expectedVersion
        });
        if (res.data.success) {
          toast.success(`Đã cập nhật vai trò của ${confirmModal.userName} thành ${confirmModal.newRole}`);
          await fetchUsers();
          setConfirmModal(null);
        } else {
          const message = res.data.message || 'Không thể cập nhật vai trò. Vui lòng thử lại.';
          setMutationError(message);
          toast.error(message);
        }
      } else if (confirmModal.type === 'block' && confirmModal.targetBlocked !== undefined) {
          const res = await api.put(`/api/admin/users/${confirmModal.userId}/block`, { 
            isBlocked: confirmModal.targetBlocked,
            expectedVersion: confirmModal.expectedVersion
        });
        if (res.data.success) {
          toast.success(`Đã ${confirmModal.targetBlocked ? 'khóa' : 'mở khóa'} tài khoản của ${confirmModal.userName}`);
          await fetchUsers();
          setConfirmModal(null);
        } else {
          const message = res.data.message || 'Không thể cập nhật trạng thái tài khoản. Vui lòng thử lại.';
          setMutationError(message);
          toast.error(message);
        }
      }
    } catch (err: unknown) {
      const apiErr = err as { response?: { status?: number; data?: { message?: string } } };
      const status = apiErr.response?.status;
      const message = apiErr.response?.data?.message || (status === 409 || status === 503
        ? 'Thao tác quản trị đang bận hoặc dữ liệu đã thay đổi. Hãy thử lại.'
        : 'Có lỗi xảy ra khi thực hiện thao tác.');
      setMutationError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-8 text-text-primary max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface-2/30 p-5 sm:p-6 rounded-2xl border border-border-subtle backdrop-blur-md">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-0.5">Quản Lý Người Dùng & Phân Quyền</h2>
          <p className="text-text-secondary text-xs sm:text-sm">
            Quản trị danh sách người dùng, phân quyền RBAC (Admin, Staff, Customer) và trạng thái tài khoản.
          </p>
        </div>
        <div className="w-10 h-10 bg-brand-primary/10 rounded-xl flex items-center justify-center border border-brand-primary/20 shadow-md shrink-0">
          <Users className="w-5 h-5 text-brand-primary" />
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="glass-card p-4 rounded-2xl border border-border-subtle flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input 
            id="user-search"
            type="text"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            placeholder="Tìm theo tên hoặc email..."
            aria-label="Tìm người dùng theo tên hoặc email"
            className="w-full bg-surface-2 border border-border-subtle rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus:border-brand-primary/50"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap">
          {/* Role Filter */}
          <select 
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
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
            onChange={(e) => { setBlockFilter(e.target.value); setPage(1); }}
            aria-label="Lọc theo trạng thái tài khoản"
            className="bg-surface-2 border border-border-subtle rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus:border-brand-primary cursor-pointer flex-1 sm:flex-initial"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="blocked">Đã bị khóa</option>
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {loadError && !loading && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-xs text-danger">
          <span>Không thể tải danh sách người dùng.</span>
          <button type="button" onClick={fetchUsers} className="rounded-lg border border-danger/30 px-3 py-1.5 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger">Thử lại</button>
        </div>
      )}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-brand-primary" />
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block glass-premium rounded-2xl border border-border-subtle overflow-hidden relative shadow-lg">
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
                    const isSelf = currentUser?.id === user.id;
                    return (
                      <tr key={user.id} className="hover:bg-surface-2/30 transition-colors group">
                        <td className="p-4 sm:p-5">
                          <div className="flex items-center gap-3">
                            {user.avatarUrl ? (
                              <img src={user.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover border border-surface-2 shadow-md shrink-0" />
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
                              onChange={(e) => requestChangeRole(user, e.target.value)}
                              className="bg-surface-1 border border-border-subtle hover:border-brand-primary rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary transition-colors cursor-pointer font-semibold whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <option value="Customer">Khách hàng (Customer)</option>
                              <option value="Staff">Nhân viên soát vé (Staff)</option>
                              <option value="Admin">Quản trị viên (Admin)</option>
                            </select>
                            
                            <button 
                              onClick={() => requestToggleBlock(user, !user.isBlocked)}
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
              const isSelf = currentUser?.id === user.id;
              return (
                <div key={user.id} className="glass-card p-4 rounded-2xl border border-border-subtle space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0 border border-surface-2" />
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
                      onChange={(e) => requestChangeRole(user, e.target.value)}
                      className="bg-surface-2 border border-border-subtle rounded-xl px-2.5 py-1.5 text-xs text-white flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:opacity-40"
                    >
                      <option value="Customer">Khách hàng</option>
                      <option value="Staff">Soát vé (Staff)</option>
                      <option value="Admin">Quản trị (Admin)</option>
                    </select>

                    <button
                      onClick={() => requestToggleBlock(user, !user.isBlocked)}
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
                onClick={() => setPage(p => Math.max(1, p - 1))}
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
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-white border border-border-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                title="Trang sau"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}

      <ConfirmModal
        isOpen={Boolean(confirmModal)}
        onClose={() => setConfirmModal(null)}
        onConfirm={executeConfirmedAction}
        title="Xác nhận thao tác quản trị"
        message={mutationError ? (
          <div><p className="text-danger" role="alert">{mutationError}</p><p className="mt-2 text-text-secondary">Dữ liệu cũ vẫn được giữ nguyên. Bạn có thể bấm “Xác nhận” để thử lại.</p></div>
        ) : confirmModal?.type === 'role' ? (
          <p>Bạn có chắc chắn muốn thay đổi vai trò của <span className="font-bold text-white break-words">{confirmModal.userName}</span> từ <span className="font-mono text-amber-400">{confirmModal.currentRole}</span> sang <span className="font-mono text-emerald-400">{confirmModal.newRole}</span> không?</p>
        ) : (
          <p>Bạn có chắc chắn muốn <span className="font-bold text-white">{confirmModal?.targetBlocked ? 'KHÓA' : 'MỞ KHÓA'}</span> tài khoản của <span className="font-bold text-white break-words">{confirmModal?.userName}</span> không?</p>
        )}
        confirmText="Xác nhận"
        type="warning"
        isLoading={isSubmitting}
      />
    </div>
  );
}
