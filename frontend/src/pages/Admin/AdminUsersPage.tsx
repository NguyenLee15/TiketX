import { useState, useEffect, useCallback, useRef } from 'react';
import { Users } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { useAuthStore } from '../../stores/useAuthStore';
import ConfirmModal from '../../components/Admin/ConfirmModal';
import { adminUsersPagedResponseSchema } from '../../schemas/adminSchemas';
import { AdminUsersFilterBar } from './Users/AdminUsersFilterBar';
import { AdminUsersTable, AdminUserItem } from './Users/AdminUsersTable';
import { AdminUsersSkeleton } from './Users/AdminUsersSkeleton';

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

  const [users, setUsers] = useState<AdminUserItem[]>([]);
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
  const requestRef = useRef<AbortController | null>(null);

  const fetchUsers = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      setLoading(true);
      setLoadError(false);
      const params: Record<string, string | number> = { page, pageSize };
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (roleFilter) params.role = roleFilter;
      if (blockFilter === 'blocked') params.isBlocked = 'true';
      if (blockFilter === 'active') params.isBlocked = 'false';

      const res = await api.get('/api/admin/users', { params, signal: controller.signal });
      if (res.data?.success) {
        const parsed = adminUsersPagedResponseSchema.safeParse(res.data.data);
        if (parsed.success) {
          const data = parsed.data;
          if (Array.isArray(data)) {
            setUsers(data as AdminUserItem[]);
            setTotalCount(data.length);
            setTotalPages(1);
          } else if (data && data.items) {
            setUsers(data.items as AdminUserItem[]);
            setTotalCount(data.totalCount || 0);
            setTotalPages(data.totalPages || 1);
          }
        } else {
          setLoadError(true);
          toast.error('Dữ liệu người dùng từ máy chủ không đúng định dạng.');
        }
      } else {
        setLoadError(true);
        toast.error(res.data?.message || 'Không thể tải danh sách người dùng.');
      }
    } catch (error: unknown) {
      if ((error as { code?: string })?.code === 'ERR_CANCELED') return;
      setLoadError(true);
      toast.error('Không thể tải danh sách người dùng.');
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [page, pageSize, searchTerm, roleFilter, blockFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 300);
    return () => { clearTimeout(timer); requestRef.current?.abort(); };
  }, [fetchUsers]);

  useEffect(() => {
    const nextParams = new URLSearchParams();
    if (searchTerm.trim()) nextParams.set('search', searchTerm.trim());
    if (roleFilter) nextParams.set('role', roleFilter);
    if (blockFilter) nextParams.set('status', blockFilter);
    if (page > 1) nextParams.set('page', String(page));
    setUrlSearchParams(nextParams, { replace: true });
  }, [blockFilter, page, roleFilter, searchTerm, setUrlSearchParams]);

  const requestChangeRole = (u: AdminUserItem, newRole: string) => {
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
      newRole,
      expectedVersion: u.version
    });
  };

  const requestToggleBlock = (u: AdminUserItem, targetBlocked: boolean) => {
    if (currentUser?.id === u.id && targetBlocked) {
      toast.error('Bạn không thể tự khóa tài khoản của chính mình.');
      return;
    }

    setMutationError('');
    setConfirmModal({
      type: 'block',
      userId: u.id,
      userName: u.name,
      targetBlocked,
      expectedVersion: u.version
    });
  };

  const executeConfirmedAction = async () => {
    if (!confirmModal) return;
    setIsSubmitting(true);
    setMutationError('');

    try {
      if (confirmModal.type === 'role') {
        const res = await api.put(`/api/admin/users/${confirmModal.userId}/role`, {
          role: confirmModal.newRole,
          expectedVersion: confirmModal.expectedVersion
        });
        if (res.data.success) {
          toast.success(`Đã cập nhật vai trò của ${confirmModal.userName} thành "${confirmModal.newRole}"`);
          setConfirmModal(null);
          await fetchUsers();
        } else {
          setMutationError(res.data.message || 'Không thể thay đổi vai trò.');
        }
      } else if (confirmModal.type === 'block') {
        const res = await api.put(`/api/admin/users/${confirmModal.userId}/block`, {
          isBlocked: confirmModal.targetBlocked,
          expectedVersion: confirmModal.expectedVersion
        });
        if (res.data.success) {
          toast.success(`Đã ${confirmModal.targetBlocked ? 'khóa' : 'mở khóa'} tài khoản của ${confirmModal.userName}`);
          setConfirmModal(null);
          await fetchUsers();
        } else {
          setMutationError(res.data.message || 'Không thể cập nhật trạng thái khóa.');
        }
      }
    } catch (err: unknown) {
      const apiErr = err as { response?: { status?: number; data?: { code?: string; message?: string } } };
      if (apiErr.response?.data?.code === 'USER_CONCURRENCY_CONFLICT' || apiErr.response?.status === 409) {
        setMutationError('Dữ liệu người dùng đã bị thay đổi bởi phiên khác. Đang tải lại danh sách mới nhất...');
        await fetchUsers();
        setConfirmModal(null);
        toast.error('Dữ liệu đã thay đổi. Vui lòng chọn lại thao tác từ danh sách mới nhất.');
      } else {
        setMutationError(apiErr.response?.data?.message || 'Thao tác thất bại. Vui lòng thử lại.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8 animate-in fade-in duration-500">
      {/* Top Header */}
      <div className="surface-panel flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Quản Lý Người Dùng & Phân Quyền</h1>
          <p className="text-text-secondary text-xs sm:text-sm mt-0.5">
            Quản trị danh sách người dùng, phân quyền RBAC (Admin, Staff, Customer) và trạng thái tài khoản.
          </p>
        </div>
        <div className="w-10 h-10 bg-brand-primary/10 rounded-xl flex items-center justify-center border border-brand-primary/20 shadow-md shrink-0">
          <Users className="w-5 h-5 text-brand-readable" />
        </div>
      </div>

      {/* Filter & Search Bar */}
      <AdminUsersFilterBar
        searchTerm={searchTerm}
        onSearchChange={val => { setSearchTerm(val); setPage(1); }}
        roleFilter={roleFilter}
        onRoleChange={val => { setRoleFilter(val); setPage(1); }}
        blockFilter={blockFilter}
        onBlockChange={val => { setBlockFilter(val); setPage(1); }}
      />

      {/* Main Content Area */}
      {loadError && !loading && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-xs text-danger-readable">
          <span>Không thể tải danh sách người dùng.</span>
          <button type="button" onClick={fetchUsers} className="rounded-lg border border-danger/30 px-3 py-1.5 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger">Thử lại</button>
        </div>
      )}

      {loading ? (
        <AdminUsersSkeleton />
      ) : (
        <AdminUsersTable
          users={users}
          currentUserId={currentUser?.id}
          totalCount={totalCount}
          page={page}
          totalPages={totalPages}
          isSubmitting={isSubmitting}
          onPageChange={setPage}
          onRequestChangeRole={requestChangeRole}
          onRequestToggleBlock={requestToggleBlock}
        />
      )}

      {/* Custom Confirm Action Modal */}
      {confirmModal && (
        <ConfirmModal
          isOpen={true}
          onClose={() => setConfirmModal(null)}
          onConfirm={executeConfirmedAction}
          title={confirmModal.type === 'role' ? 'Thay đổi vai trò người dùng' : (confirmModal.targetBlocked ? 'Khóa tài khoản' : 'Mở khóa tài khoản')}
          message={
            <div className="space-y-2">
              <p>
                {confirmModal.type === 'role'
                  ? `Bạn có chắc chắn muốn chuyển vai trò của "${confirmModal.userName}" thành "${confirmModal.newRole}"?`
                  : `Bạn có chắc chắn muốn ${confirmModal.targetBlocked ? 'khóa' : 'mở khóa'} tài khoản của "${confirmModal.userName}"?`}
              </p>
              {mutationError && (
                <p className="text-xs text-danger-readable font-semibold bg-danger/10 p-2 rounded-lg border border-danger/20">
                  {mutationError}
                </p>
              )}
            </div>
          }
          confirmText={confirmModal.type === 'role' ? 'Xác nhận đổi quyền' : (confirmModal.targetBlocked ? 'Xác nhận khóa' : 'Mở khóa')}
          type={confirmModal.type === 'block' && confirmModal.targetBlocked ? 'danger' : 'warning'}
          isLoading={isSubmitting}
        />
      )}
    </div>
  );
}
