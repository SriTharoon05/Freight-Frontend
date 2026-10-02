import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { toApiError } from './api-errors';
export { toApiError } from './api-errors';
import { installMockAdapter } from './mock/mock-adapter';
const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1';

let refreshPromise: Promise<string> | null = null;

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('freightos_token');
}

function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  if (token) {
    localStorage.setItem('freightos_token', token);
    document.cookie = `freightos_token=${encodeURIComponent(token)}; Path=/; SameSite=Lax${secure}`;
  } else {
    localStorage.removeItem('freightos_token');
    localStorage.removeItem('freightos_refresh_token');
    document.cookie = `freightos_token=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
  }
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
  if (!refreshToken) throw { status: 401, message: 'Session expired. Please sign in again.' };
  const res = await axios.post(`${baseURL}/auth/refresh`, { refresh_token: refreshToken }, { timeout: 90000 });
  const newToken = res.data.access_token;
  setToken(newToken);
  if (res.data.refresh_token) localStorage.setItem('freightos_refresh_token', res.data.refresh_token);
  return newToken;
}

export function refreshSession(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => {
    const body = response.data;
    // Legacy API pagination uses "data"; freight screens use "items".
    if (body && !Array.isArray(body) && Array.isArray(body.data)
      && typeof body.total === 'number' && typeof body.page === 'number'
      && !Array.isArray(body.items)) {
      response.data = { ...body, items: body.data };
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retried?: boolean };

    if (originalRequest && error.response?.status === 401 && !originalRequest._retried && !/\/auth\/(login|refresh)(?:\?|$)/.test(originalRequest.url || '')) {
      originalRequest._retried = true;
      try {
        // A different request may have already rotated this expired token.
        const current = getToken();
        const newToken = current && originalRequest.headers.Authorization !== `Bearer ${current}`
          ? current : await refreshSession();
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        const normalized = toApiError(refreshError);
        if (normalized.status === 401 || normalized.status === 403) {
          setToken(null);
          if (typeof window !== 'undefined') window.location.href = '/login';
        }
        return Promise.reject(normalized);
      }
    }

    return Promise.reject(toApiError(error));
  }
);
