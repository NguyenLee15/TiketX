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

interface AuthState {
  user: User | null;
  token: string | null;
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
      setAuth: (user: User, token?: string | null) => {
        set({ user, token: token ?? null });
      },
      logout: () => set({ token: null, user: null }),
      isAuthenticated: () => {
        const { token, user } = get();
        if (!user) return false;
        return !token || !isTokenExpired(token);
      },
      isAdmin: () => {
        const { user } = get();
        return user?.role === 'Admin';
      },
      canAccessAdmin: () => {
        const { user } = get();
        return user?.role === 'Admin' || user?.role === 'Staff';
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user }),
    }
  )
);
