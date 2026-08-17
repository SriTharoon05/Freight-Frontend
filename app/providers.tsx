'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useState, type ReactNode } from 'react';
import { useRealtime } from '@/lib/use-realtime';

export function Providers({ children }: { children: ReactNode }) {
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
