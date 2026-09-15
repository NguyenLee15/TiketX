import { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Calendar, LogOut, Ticket, Users, Home, QrCode, Menu, X } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useModalAccessibility } from '../Admin/useModalAccessibility';
import api from '../../services/api';

export default function AdminLayout() {
  const { pathname } = useLocation();
  const { logout, user } = useAuthStore();
  const handleLogout = async () => {
    try { await api.post('/api/auth/logout', {}); } catch { /* expired session is already logged out */ }
    logout();
  };
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileDrawerRef = useRef<HTMLDivElement>(null);
  useModalAccessibility(isMobileMenuOpen, false, () => setIsMobileMenuOpen(false), mobileDrawerRef);

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const allNavItems = [
    { name: 'Bảng điều khiển', href: '/admin', icon: LayoutDashboard, roles: ['Admin'] },
    { name: 'Quản lý sự kiện', href: '/admin/events', icon: Calendar, roles: ['Admin'] },
    { name: 'Trạm Soát vé QR', href: '/admin/scan-ticket', icon: QrCode, roles: ['Admin', 'Staff'] },
    { name: 'Quản lý người dùng', href: '/admin/users', icon: Users, roles: ['Admin'] },
  ];

  const currentRole = user?.role || 'Customer';
  const navItems = allNavItems.filter((item) => item.roles.includes(currentRole));

  const portalTitle = currentRole === 'Staff' ? 'Soát Vé TickeX' : 'Quản Trị TickeX';

  return (
    <div className="min-h-screen bg-surface-0 flex flex-col md:flex-row text-text-primary relative overflow-hidden">
      {/* Mobile Top App Bar (< md) */}
      <header className="md:hidden h-16 bg-surface-1 border-b border-border-subtle px-4 flex items-center justify-between shrink-0 sticky top-0 z-40">
        <Link to={currentRole === 'Staff' ? "/admin/scan-ticket" : "/admin"} className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-surface-2 border border-border-subtle flex items-center justify-center shrink-0">
            <Ticket className="w-4 h-4 text-brand-primary" />
          </div>
          <span className="text-base font-display font-bold tracking-tight text-white">
            {portalTitle}
          </span>
        </Link>

        <button
          onClick={() => setIsMobileMenuOpen(prev => !prev)}
          className="min-h-11 min-w-11 p-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-white transition-colors border border-border-subtle"
          aria-label={isMobileMenuOpen ? "Đóng menu" : "Mở menu"}
          aria-controls="admin-mobile-navigation"
          aria-expanded={isMobileMenuOpen}
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Off-Canvas Drawer Backdrop */}
      {isMobileMenuOpen && (
        <button
          type="button"
          aria-label="Đóng menu quản trị"
          className="fixed inset-0 z-50 bg-surface-1/85 md:hidden animate-in fade-in duration-200"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Slide-over Drawer (< md) */}
      <div id="admin-mobile-navigation" ref={mobileDrawerRef} role="dialog" aria-modal="true" aria-hidden={!isMobileMenuOpen} inert={!isMobileMenuOpen || undefined} aria-label="Điều hướng quản trị" className={`fixed top-0 left-0 bottom-0 w-72 bg-surface-1 border-r border-border-subtle z-50 flex flex-col md:hidden transition-transform duration-300 ease-in-out motion-reduce:transition-none shadow-2xl ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="h-16 flex items-center justify-between px-5 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-surface-2 border border-border-subtle flex items-center justify-center shrink-0">
              <Ticket className="w-4 h-4 text-brand-primary" />
            </div>
            <span className="text-base font-display font-bold tracking-tight text-white">
              {portalTitle}
            </span>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Đóng menu"
            className="min-h-11 min-w-11 p-1.5 rounded-lg text-text-tertiary hover:text-white hover:bg-surface-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-5 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${
                  isActive 
                    ? 'bg-brand-primary/15 text-brand-primary border border-brand-primary/30 font-bold' 
                    : 'text-text-secondary hover:text-white hover:bg-surface-2 border border-transparent'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </Link>
            );
          })}
        </div>

        <div className="p-4 border-t border-border-subtle bg-surface-1/90 space-y-3">
          <Link 
            to="/"
            onClick={() => setIsMobileMenuOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-text-secondary hover:text-white hover:bg-surface-2 font-medium transition-colors"
          >
            <Home className="w-4 h-4 text-brand-primary" />
            Về Trang Khách Hàng
          </Link>

          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-surface-2 border border-border-subtle">
            <div className="w-8 h-8 rounded-full bg-surface-3 flex items-center justify-center font-bold text-xs text-white uppercase shrink-0">
              {user?.name?.[0] || 'U'}
            </div>
            <div className="flex-1 overflow-hidden min-w-0">
              <p className="text-xs font-bold text-white truncate">{user?.name}</p>
              <p className="text-[10px] text-text-tertiary truncate">{user?.email}</p>
            </div>
            <button 
              onClick={() => { setIsMobileMenuOpen(false); void handleLogout(); }}
              aria-label="Đăng xuất"
              className="text-text-tertiary hover:text-danger transition-colors p-1.5 rounded-lg hover:bg-danger/10"
              title="Đăng xuất"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Desktop Sidebar (>= md) */}
      <aside className="hidden md:flex w-64 bg-surface-1 border-r border-border-subtle flex-col relative z-10 shrink-0 shadow-2xl">
        {/* Header */}
        <div className="h-20 flex items-center px-6 border-b border-border-subtle shrink-0">
          <Link to={currentRole === 'Staff' ? "/admin/scan-ticket" : "/admin"} className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded bg-surface-2 border border-border-subtle flex items-center justify-center shrink-0 group-hover:border-brand-primary transition-colors">
              <Ticket className="w-4 h-4 text-text-primary group-hover:text-brand-primary transition-colors" />
            </div>
            <span className="text-xl font-display font-bold tracking-tight text-text-primary group-hover:text-white transition-colors">
              {portalTitle}
            </span>
          </Link>
        </div>
        
        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                to={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary group ${
                  isActive 
                    ? 'bg-surface-2 text-white border border-border-focus shadow-sm font-bold' 
                    : 'text-text-secondary hover:text-white hover:bg-surface-2/50 border border-transparent'
                }`}
              >
                <item.icon className={`w-4 h-4 transition-transform ${isActive ? 'text-brand-primary' : 'group-hover:scale-110'}`} />
                {item.name}
              </Link>
            );
          })}
        </div>
        
        {/* Quick Links & Profile */}
        <div className="p-4 border-t border-border-subtle bg-surface-1">
          <Link 
            to="/"
            className="flex items-center gap-3 px-3 py-2.5 mb-2 rounded-lg text-sm text-text-secondary hover:text-white hover:bg-surface-2/50 font-medium transition-colors"
          >
            <Home className="w-4 h-4" />
            Về Trang Khách Hàng
          </Link>

          <div className="flex items-center gap-3 px-3 py-2 mt-2 rounded-lg bg-surface-2 border border-border-subtle">
            <div className="w-8 h-8 rounded bg-surface-3 flex items-center justify-center font-bold text-xs text-white uppercase shrink-0">
              {user?.name?.[0] || 'U'}
            </div>
            <div className="flex-1 overflow-hidden min-w-0">
              <p className="text-xs font-bold text-white truncate">{user?.name}</p>
              <p className="text-[10px] text-text-tertiary truncate">{user?.email}</p>
            </div>
            <button 
              onClick={() => void handleLogout()}
              aria-label="Đăng xuất"
              className="text-text-tertiary hover:text-danger transition-colors p-1.5 rounded hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
              title="Đăng xuất"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative z-10 bg-surface-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 min-h-full">
          <div className="animate-slide-up">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
