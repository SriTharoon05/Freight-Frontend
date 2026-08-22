import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import type { ApiError } from './types';
import { installMockAdapter } from './mock/mock-adapter';
const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1';

let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('freightos_token');
}

function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem('freightos_token', token);
  else localStorage.removeItem('freightos_token');
}

function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('freightos_refresh_token');
}

export { getToken, setToken };

export const api: AxiosInstance = axios.create({
  baseURL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});
if (process.env.NEXT_PUBLIC_USE_MOCK === 'true') installMockAdapter(api);
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const method = (config.method || 'get').toLowerCase();
  if (['post', 'patch', 'put', 'delete'].includes(method)) {
    config.headers['X-Requested-With'] = 'XMLHttpRequest';
  }
  return config;
});

async function doRefresh(): Promise<string> {
  const refreshToken = getRefreshToken();
  const res = await axios.post(`${baseURL}/auth/refresh`, {}, {
    headers: refreshToken ? { Authorization: `Bearer ${refreshToken}` } : {},
  });
  const newToken = res.data.access_token;
  setToken(newToken);
  return newToken;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retried?: boolean };

    if (error.response?.status === 401 && !originalRequest._retried && !originalRequest.url?.includes('/')) {
      originalRequest._retried = true;
      try {
        if (!isRefreshing) {
          isRefreshing = true;
          refreshPromise = doRefresh().finally(() => {
            isRefreshing = false;
          });
        }
        const newToken = await refreshPromise;
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch {
        setToken(null);
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(toApiError(error));
      }
    }

    return Promise.reject(toApiError(error));
  }
);

export function toApiError(error: AxiosError): ApiError {
  if (error.response) {
    const status = error.response.status;
    const data = error.response.data as Record<string, unknown>;
    const message = (data.detail as string) || (data.message as string) || error.message;

    let fieldErrors: Record<string, string[]> | undefined;
    if (Array.isArray(data.detail)) {
      fieldErrors = {};
      for (const item of data.detail as Array<{ loc: string[]; msg: string }>) {
        const field = item.loc?.[item.loc.length - 1];
        if (field) {
          if (!fieldErrors[field]) fieldErrors[field] = [];
          fieldErrors[field].push(item.msg);
        }
      }
    }

    return { status, message, detail: data, fieldErrors };
  }
  if (error.request) {
    return { status: 0, message: 'Network error — please check your connection and try again.' };
  }
  return { status: -1, message: error.message };
}
