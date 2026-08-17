'use client';

import { useEffect } from 'react';
import { useAuthStore } from './auth-store';
import { authApi } from './api';
import { setToken } from './api-client';

export function useAuthHydration() {
  const { setAuth, clear, hydrated } = useAuthStore();

  useEffect(() => {
    if (hydrated) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('freightos_token') : null;
    if (!token) {
      clear();
      return;
    }
    authApi
      .me()
      .then((user) => {
        setToken(token);
        setAuth(token, user);
      })
      .catch(() => {
        setToken(null);
        clear();
      });
  }, [setAuth, clear, hydrated]);

  return hydrated;
}
