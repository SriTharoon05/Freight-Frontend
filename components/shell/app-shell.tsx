'use client';

import { type ReactNode, useEffect } from 'react';
import { Sidebar } from './sidebar';
import { TopNav } from './top-nav';
import { useAuthHydration } from '@/lib/use-auth-hydration';
import { useAuthStore } from '@/lib/auth-store';
import { useRouter } from 'next/navigation';

export function AppShell({ children }: { children: ReactNode }) {
  const { hydrated, error, retry } = useAuthHydration();
  const { user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !user) {
      router.replace('/login');
    }
  }, [hydrated, user, router]);

  if (!hydrated || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0e1224]">
        {error ? (
          <div className="max-w-md rounded-2xl border border-white/10 bg-[#151b35] p-6 text-center text-white shadow-2xl" role="alert">
            <h1 className="text-lg font-semibold">Could not open your workspace</h1>
            <p className="mt-2 text-sm text-slate-300">{error}</p>
            <button onClick={retry} className="mt-4 rounded-xl bg-gradient-to-r from-[#6e65d6] to-[#4f86e8] px-5 py-2 text-sm font-semibold text-white shadow-md">Try again</button>
          </div>
        ) : (
          <div role="status" aria-label="Opening your workspace" className="h-9 w-9 animate-spin rounded-full border-2 border-white/15 border-t-[#38bdf8]" />
        )}
      </div>
    );
  }

  return (
    <main className="h-screen overflow-hidden bg-[#0e1224] text-[#111827]">
      <div className="flex h-full min-h-0 w-full overflow-hidden">
        <Sidebar />
        <section className="meridian-canvas flex min-h-0 min-w-0 flex-1 flex-col">
          <TopNav />
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-7">
            <div className="mx-auto max-w-[1640px]">{children}</div>
          </div>
        </section>
      </div>
    </main>
  );
}
