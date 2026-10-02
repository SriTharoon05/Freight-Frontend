'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useState, type ReactNode } from 'react';
import { useRealtime } from '@/lib/use-realtime';
import { useAuthStore } from '@/lib/auth-store';

export function Providers({ children }: { children: ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const identity = user ? `${user.tenant_id}:${user.id}` : 'anonymous';
  // Each signed-in identity gets its own cache; another staff member cannot
  // briefly see cached records from the previous session on a shared device.
  return <SessionProviders key={identity}>{children}</SessionProviders>;
}

function SessionProviders({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={client}>
      <RealtimeLayer>{children}</RealtimeLayer>
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  );
}

function RealtimeLayer({ children }: { children: ReactNode }) {
  useRealtime();
  return <>{children}</>;
}
