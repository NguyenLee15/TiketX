import { Link } from 'react-router-dom';
export default function NotFoundPage() {
  return <div className="glass-premium mx-auto max-w-xl rounded-3xl p-10 text-center" role="alert">
    <p className="font-mono text-brand-primary">404</p>
    <h1 className="mt-2 text-3xl font-display font-black text-white">Không Tìm Thấy Trang</h1>
    <p className="mt-3 text-text-secondary">Đường dẫn không tồn tại hoặc đã được thay đổi.</p>
    <Link to="/" className="mt-6 inline-flex rounded-xl bg-brand-primary px-5 py-3 font-bold text-white hover:opacity-90 focus-visible:ring-2 focus-visible:ring-white transition-opacity">Xem Sự Kiện</Link>
  </div>;
}
