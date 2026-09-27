import { afterEach, describe, expect, it } from 'vitest';
import { AxiosError, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import api from './api';

describe('api auth refresh', () => {
  const originalAdapter = api.defaults.adapter;

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
    document.cookie = 'XSRF-TOKEN=; Max-Age=0';
  });

  it('sends the CSRF header when refreshing after an expired access cookie', async () => {
    document.cookie = 'XSRF-TOKEN=csrf-refresh-token';
    const requests: AxiosRequestConfig[] = [];
    let protectedAttempts = 0;

    api.defaults.adapter = async (config) => {
      requests.push(config);
      if (config.url?.includes('/api/auth/refresh')) {
        return {
          data: { success: true, data: { userId: 'user-1', name: 'User', email: 'user@test.local', role: 'Customer', token: 'new-token' } },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse;
      }

      if (protectedAttempts++ === 0) {
        throw new AxiosError('expired', 'ERR_BAD_REQUEST', config, undefined, {
          data: { success: false },
          status: 401,
          statusText: 'Unauthorized',
          headers: {},
          config,
        });
      }

      return { data: { success: true }, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse;
    };

    await api.get('/api/protected');

    const refresh = requests.find((request) => request.url?.includes('/api/auth/refresh'));
    expect(refresh?.headers?.['X-CSRF-TOKEN']).toBe('csrf-refresh-token');
  });
});
