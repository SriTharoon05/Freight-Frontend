'use client';

import { type ReactNode } from 'react';
import { Sidebar } from './sidebar';
import { TopNav } from './top-nav';
import { useAuthHydration } from '@/lib/use-auth-hydration';
import { useAuthStore } from '@/lib/auth-store';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

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
      <div className="flex min-h-screen items-center justify-center bg-[#e8e9f6]">
        {error ? (
          <div className="max-w-md rounded-2xl bg-white p-6 text-center" role="alert">
            <h1 className="text-lg font-semibold">Could not open your workspace</h1>
            <p className="mt-2 text-sm text-slate-600">{error}</p>
            <button onClick={retry} className="mt-4 rounded-xl bg-[#7068cf] px-5 py-2 text-sm font-semibold text-white">Try again</button>
          </div>
        ) : (
          <div role="status" aria-label="Opening your workspace" className="h-8 w-8 animate-spin rounded-full border-2 border-[#c8c5e8] border-t-[#746ad1]" />
        )}
      </div>
    );
  }

  return (
    <main className="h-screen overflow-hidden bg-[#e8e9f6] text-[#171725]">
      <div className="flex h-full min-h-0 w-full overflow-hidden bg-[#fbfbfd]">
        <Sidebar />
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <TopNav />
          <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-8">{children}</div>
        </section>
      </div>
    </main>
  );
}
