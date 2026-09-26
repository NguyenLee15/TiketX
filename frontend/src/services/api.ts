import axios from 'axios';

import { useAuthStore } from '../stores/useAuthStore';
import { readCsrfToken } from '../utils/csrf';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (!['get', 'head', 'options'].includes((config.method || 'get').toLowerCase())) {
    const csrfToken = readCsrfToken();
    if (csrfToken) config.headers['X-CSRF-TOKEN'] = csrfToken;

    const existingKey =
      config.headers['Idempotency-Key'] ||
      config.headers['idempotency-key'] ||
      (typeof config.headers.get === 'function' ? config.headers.get('Idempotency-Key') : undefined);

    if (!existingKey) {
      config.headers['Idempotency-Key'] =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
              const r = (Math.random() * 16) | 0;
              const v = c === 'x' ? r : (r & 0x3) | 0x8;
              return v.toString(16);
            });
    }
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string | null) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && originalRequest) {
      const isAuthLogin = originalRequest.url?.includes('/auth/login');
      const isAuthRefresh = originalRequest.url?.includes('/auth/refresh');

      // If 401 is from login attempt, DO NOT clear storage or redirect;
      // let the LoginPage handle inline invalid credentials error.
      if (isAuthLogin) {
        return Promise.reject(error);
      }

      // If refresh itself failed or request was already retried, perform logout
      if (isAuthRefresh || originalRequest._retry) {
        processQueue(error, null);
        isRefreshing = false;
        useAuthStore.getState().logout();
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          const currentUrl = window.location.pathname + window.location.search + window.location.hash;
          window.location.href = `/login?from=${encodeURIComponent(currentUrl)}`;
        }
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise<unknown>((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string | null) => {
              if (token) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }
              resolve(api(originalRequest));
            },
            reject: (err: unknown) => reject(err),
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshResponse = await axios.post(
          `${API_BASE_URL}/api/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const refreshData = refreshResponse.data?.data;
        const newToken = refreshData?.token ?? null;

        if (refreshResponse.data?.success && refreshData) {
          useAuthStore.getState().setAuth(
            {
              id: refreshData.userId || refreshData.user?.id,
              name: refreshData.name || refreshData.user?.name || '',
              email: refreshData.email || refreshData.user?.email || '',
              role: refreshData.role || refreshData.user?.role || 'Customer',
            },
            newToken
          );

          if (newToken) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
          processQueue(null, newToken);
          return api(originalRequest);
        } else {
          throw new Error('Refresh response invalid');
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        useAuthStore.getState().logout();
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          const currentUrl = window.location.pathname + window.location.search + window.location.hash;
          window.location.href = `/login?from=${encodeURIComponent(currentUrl)}`;
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default api;
