import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { jwtDecode } from 'jwt-decode';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
}

export const isTokenExpired = (token: string | null): boolean => {
  if (!token) return true;
  try {
    const decoded = jwtDecode<{ exp?: number }>(token);
    if (!decoded.exp) return false;
    return decoded.exp * 1000 < Date.now();
  } catch {
    return true;
  }
};

const getInitialHydrating = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem('auth-storage');
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed?.state?.user);
  } catch {
    return false;
  }
};

interface AuthState {
  user: User | null;
  token: string | null;
  isHydrating: boolean;
  setHydrating: (isHydrating: boolean) => void;
  setAuth: (user: User, token?: string | null) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
  isAdmin: () => boolean;
  canAccessAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isHydrating: getInitialHydrating(),
      setHydrating: (isHydrating: boolean) => set({ isHydrating }),
      setAuth: (user: User, token?: string | null) => {
        set({ user, token: token ?? null, isHydrating: false });
      },
      logout: () => set({ token: null, user: null, isHydrating: false }),
      isAuthenticated: () => {
        const { token, user, isHydrating } = get();
        if (isHydrating) return false;
        if (!user) return false;
        return !token || !isTokenExpired(token);
      },
      isAdmin: () => {
        const { user, isHydrating } = get();
        if (isHydrating) return false;
        return user?.role === 'Admin';
      },
      canAccessAdmin: () => {
        const { user, isHydrating } = get();
        if (isHydrating) return false;
        return user?.role === 'Admin' || user?.role === 'Staff';
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user }),
    }
  )
);
