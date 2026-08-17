'use client';

import { type ReactNode } from 'react';
import { Sidebar } from './sidebar';
import { TopNav } from './top-nav';
import { useAuthHydration } from '@/lib/use-auth-hydration';
import { useAuthStore } from '@/lib/auth-store';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function AppShell({ children }: { children: ReactNode }) {
  const hydrated = useAuthHydration();
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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#c8c5e8] border-t-[#746ad1]" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#e8e9f6] px-3 py-3 text-[#171725] sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-48px)] max-w-[1460px] overflow-hidden rounded-[24px] border border-white/80 bg-[#fbfbfd] shadow-[0_22px_80px_rgba(82,78,137,0.14)]">
        <Sidebar />
        <section className="flex min-w-0 flex-1 flex-col">
          <TopNav />
          <div className="flex-1 overflow-y-auto p-5 sm:p-8">{children}</div>
        </section>
      </div>
    </main>
  );
}
