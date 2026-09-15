import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import { LogOut, ShieldCheck, Zap, Ticket, Calendar, Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import api from '../../services/api';

export default function StandardLayout() {
  const { isAuthenticated, isAdmin, logout, user } = useAuthStore();
  const isAuth = isAuthenticated();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileNavRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const handleLogout = async () => {
    try { await api.post('/api/auth/logout', {}); } catch { /* server may already have expired the session */ }
    logout();
  };

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileOpen(false);
        menuButtonRef.current?.focus();
        return;
      }
      if (event.key !== 'Tab' || !mobileNavRef.current) return;
      const focusable = Array.from(mobileNavRef.current.querySelectorAll<HTMLElement>('a, button, [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    requestAnimationFrame(() => mobileNavRef.current?.querySelector<HTMLElement>('a, button')?.focus());
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-surface-1 text-text-primary font-sans flex flex-col relative overflow-hidden">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-white focus:text-black focus:rounded-lg">Bỏ qua đến nội dung chính</a>
      {/* Compact navigation shell */}
      <div className="fixed top-0 w-full z-50 pt-6 px-4 pointer-events-none">
        <div className="max-w-5xl mx-auto">
          <header className="surface-raised h-16 px-5 sm:px-6 flex items-center justify-between pointer-events-auto transition-colors duration-200 animate-slide-up shadow-lg">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-brand-primary/15 border border-brand-primary/40 flex items-center justify-center group-hover:bg-brand-primary/25 transition-colors">
                <Zap className="w-4 h-4 text-brand-primary" />
              </div>
              <span className="text-xl font-display font-bold text-white tracking-tight">TickeX</span>
            </Link>
            
            <nav className="hidden md:flex items-center gap-8">
              <Link to="/" className={`text-sm font-medium transition-colors relative flex items-center gap-1.5 group ${pathname === '/' ? 'text-white font-bold' : 'text-text-secondary hover:text-white'}`}>
                <Calendar className="w-4 h-4" />
                Sự kiện
              </Link>
              {isAuth && (
                <Link to="/my-tickets" className={`text-sm font-medium transition-colors relative flex items-center gap-1.5 group ${pathname === '/my-tickets' ? 'text-white font-bold' : 'text-text-secondary hover:text-white'}`}>
                  <Ticket className="w-4 h-4" />
                  Vé của tôi
                </Link>
              )}
              {isAdmin() && (
                <Link to="/admin" className="text-sm font-medium text-text-secondary hover:text-white flex items-center gap-1.5 transition-colors">
                  <ShieldCheck className="w-4 h-4 text-brand-primary" />
                  Quản trị
                </Link>
              )}
            </nav>

            <div className="flex items-center gap-4">
              {isAuth ? (
                <div className="flex items-center gap-3 border-l border-border-subtle pl-4 ml-4">
                  <Link to="/profile" className="flex items-center gap-2 hover:bg-surface-3 px-2.5 py-1.5 rounded-lg transition-colors group">
                    {user?.avatarUrl ? (
                      <img src={user.avatarUrl} alt="Ảnh đại diện" width="28" height="28" loading="lazy" className="w-7 h-7 rounded-full object-cover border border-border-subtle" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-surface-3 border border-border-subtle flex items-center justify-center">
                        <span className="text-xs font-bold text-white uppercase">{user?.name?.charAt(0)}</span>
                      </div>
                    )}
                    <span className="text-sm font-medium text-text-secondary group-hover:text-white transition-colors max-w-[120px] truncate">{user?.name}</span>
                  </Link>
                  <button 
                    onClick={handleLogout}
                    aria-label="Đăng xuất"
                    className="text-text-tertiary hover:text-danger transition-colors p-2 rounded-full hover:bg-danger/10 focus-visible:ring-2 focus-visible:ring-brand-primary"
                    title="Đăng xuất"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Link to="/login" className="text-sm font-medium text-text-secondary hover:text-white transition-colors px-3 py-2">
                    Đăng nhập
                  </Link>
                  <Link to="/register" className="text-sm font-bold px-5 py-2 bg-brand-primary text-white hover:bg-brand-primary/90 rounded-lg transition-[background-color,transform] active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-primary">
                    Đăng ký
                  </Link>
                </div>
              )}
              <button
                type="button"
                ref={menuButtonRef}
                aria-label={mobileOpen ? 'Đóng menu' : 'Mở menu'}
                aria-expanded={mobileOpen}
                onClick={() => setMobileOpen(value => !value)}
                className="md:hidden p-2 rounded-full text-text-secondary hover:text-white focus-visible:ring-2 focus-visible:ring-brand-primary"
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </header>
          {mobileOpen && (
            <nav ref={mobileNavRef} aria-label="Điều hướng chính" className="md:hidden mt-2 surface-raised p-3 flex flex-col gap-1 pointer-events-auto overscroll-contain">
              <Link onClick={() => setMobileOpen(false)} to="/" className="p-3 rounded-xl hover:bg-surface-2 flex items-center gap-2"><Calendar className="w-4 h-4" /> Sự kiện</Link>
              {isAuth && <Link onClick={() => setMobileOpen(false)} to="/my-tickets" className="p-3 rounded-xl hover:bg-surface-2 flex items-center gap-2"><Ticket className="w-4 h-4" /> Vé của tôi</Link>}
              {isAuth && <Link onClick={() => setMobileOpen(false)} to="/profile" className="p-3 rounded-xl hover:bg-surface-2">Hồ sơ</Link>}
            </nav>
          )}
        </div>
      </div>

      <main id="main-content" tabIndex={-1} className="flex-1 w-full flex flex-col z-10 pt-32 pb-12">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>

      <footer className="border-t border-border-subtle bg-surface-1 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 opacity-70">
            <Zap className="w-4 h-4 text-brand-primary" />
            <span className="font-display font-bold tracking-tight text-white">TickeX</span>
            <span className="text-xs text-text-tertiary ml-2">Nền tảng đặt vé & giữ chỗ sự kiện thời gian thực</span>
          </div>
          <p className="text-sm text-text-tertiary">© 2026 TickeX Inc. Bảo lưu mọi quyền.</p>
          <div className="flex gap-6">
            <Link to="/privacy" className="text-text-tertiary hover:text-white transition-colors text-sm">Chính sách bảo mật</Link>
            <Link to="/terms" className="text-text-tertiary hover:text-white transition-colors text-sm">Điều khoản sử dụng</Link>
            <a href="mailto:support@tickex.vn" className="text-text-tertiary hover:text-white transition-colors text-sm">Hỗ trợ khách hàng</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
