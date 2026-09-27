import { Plus } from 'lucide-react';

interface AdminEventsHeaderProps {
  onCreate: () => void;
}

export function AdminEventsHeader({ onCreate }: AdminEventsHeaderProps) {
  return (
    <div className="surface-panel flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Quản Lý Sự Kiện & Sơ Đồ Ghế</h1>
        <p className="text-text-secondary text-xs sm:text-sm mt-0.5">
          Quản trị danh mục sự kiện, kiểm soát trạng thái phát hành và khởi tạo ma trận ghế tự động.
        </p>
      </div>
      <button
        onClick={onCreate}
        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-primary hover:bg-brand-primary/90 text-white font-bold rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary shadow-md shadow-brand-glow text-xs sm:text-sm shrink-0 active:scale-95 whitespace-nowrap"
      >
        <Plus className="w-4 h-4" />
        <span>Tạo Sự Kiện Mới</span>
      </button>
    </div>
  );
}
