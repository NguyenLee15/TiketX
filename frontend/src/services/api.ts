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

    if (!config.headers['Idempotency-Key']) {
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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isAuthLogin = error.config?.url?.includes('/auth/login');
      const isAuthRefresh = error.config?.url?.includes('/auth/refresh');
      // If 401 is from login attempt, DO NOT clear storage or redirect;
      // let the LoginPage handle inline invalid credentials error.
      if (!isAuthLogin && !isAuthRefresh) {
        useAuthStore.getState().logout();
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          const currentUrl = window.location.pathname + window.location.search + window.location.hash;
          window.location.href = `/login?from=${encodeURIComponent(currentUrl)}`;
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
