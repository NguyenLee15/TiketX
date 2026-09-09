import { Link, useLocation } from 'react-router-dom';

export default function LegalPage() {
  const privacy = useLocation().pathname === '/privacy';
  return <article className="glass-premium mx-auto max-w-3xl rounded-3xl border border-border-subtle p-6 sm:p-10">
    <h1 className="text-3xl font-display font-black text-white text-balance">{privacy ? 'Chính Sách Bảo Mật' : 'Điều Khoản Sử Dụng'}</h1>
    <p className="mt-3 text-sm text-text-tertiary">Cập nhật ngày 09/09/2026</p>
    <div className="mt-8 space-y-6 text-sm leading-7 text-text-secondary">
      <section><h2 className="text-xl font-bold text-white">Thông Tin TickeX Xử Lý</h2><p className="mt-2">TickeX xử lý thông tin tài khoản, đơn hàng và giao dịch cần thiết để đặt vé, hỗ trợ khách hàng và bảo vệ hệ thống.</p></section>
      <section><h2 className="text-xl font-bold text-white">Quyền & Trách Nhiệm</h2><p className="mt-2">Khách hàng cần cung cấp thông tin chính xác, bảo vệ tài khoản và chỉ sử dụng vé theo trạng thái do hệ thống xác nhận.</p></section>
      <section><h2 className="text-xl font-bold text-white">Thanh Toán & Hoàn Vé</h2><p className="mt-2">Thanh toán và hoàn vé tuân theo trạng thái từ nhà cung cấp thanh toán, thời hạn hoàn vé của từng sự kiện và quy định pháp luật áp dụng.</p></section>
      <section><h2 className="text-xl font-bold text-white">Liên Hệ</h2><p className="mt-2">Gửi yêu cầu đến <a className="text-brand-primary underline underline-offset-4" href="mailto:support@tickex.vn">support@tickex.vn</a>.</p></section>
    </div>
    <Link to="/" className="mt-8 inline-flex rounded-xl bg-surface-2 px-4 py-2 text-white hover:bg-surface-3 focus-visible:ring-2 focus-visible:ring-brand-primary transition-colors">Về Trang Chủ</Link>
  </article>;
}
