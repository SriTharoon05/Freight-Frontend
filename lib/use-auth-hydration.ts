'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from './auth-store';
import { authApi } from './api';
import { getToken, setToken, toApiError } from './api-client';

export function useAuthHydration() {
  const { setAuth, clear, hydrated } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (hydrated) return;
    const token = getToken();
    if (!token) {
      clear();
      return;
    }
    let active = true;
    setError(null);
    authApi
      .me()
      .then((user) => {
        if (active) setAuth(getToken() || token, user);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        const failure = toApiError(reason);
        if (failure.status === 401 || failure.status === 403) {
          setToken(null);
          clear();
        } else {
          setError(failure.message);
        }
      });
    return () => { active = false; };
  }, [setAuth, clear, hydrated, attempt]);

  return { hydrated, error, retry: () => setAttempt((value) => value + 1) };
}
