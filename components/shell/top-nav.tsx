'use client';

import { useQuery } from '@tanstack/react-query';
import { Bell, ChevronDown, LogOut, Navigation, Plus, Settings } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/auth-store';
import { authApi } from '@/lib/api';
import { setToken } from '@/lib/api-client';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { freight, type Page } from '@/lib/freight';
import { MobileNavigation } from './mobile-navigation';

export function TopNav() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  async function signOut() {
    setSigningOut(true);
    try {
      await authApi.logout();
    } catch {
      toast.error('Signed out on this device. The server session could not be revoked; please try again when connected.');
    } finally {
      setToken(null);
      useAuthStore.getState().clear();
      router.replace('/login');
    }
  }
  const { data: alerts } = useQuery<Page<Record<string, unknown>>>({
    queryKey: ['freight', user?.tenant_id, 'alerts'],
    queryFn: () => freight.get<Page<Record<string, unknown>>>('/alerts', { limit: 1 }),
    refetchInterval: 60000,
  });

  const pendingCount = alerts?.total ?? 0;
  const initials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  return (
    <header className="sticky top-0 z-30 flex h-[66px] shrink-0 items-center justify-between border-b border-slate-200/85 bg-white/88 px-5 backdrop-blur-md sm:px-8">
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3.5">
        <MobileNavigation />
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold tracking-[-0.02em] text-slate-900 sm:text-[16px]">
            {greeting()}, {user?.full_name?.split(' ')[0] || 'there'}
          </p>
          <p className="mt-0.5 hidden text-[11px] font-medium text-slate-500 sm:block">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden items-center gap-2 lg:flex">
          <Link
            href="/partners"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:border-[#7068cf]/40 hover:bg-[#f5f3ff] hover:text-[#5b52c4]"
          >
            <Navigation size={13} className="text-[#0284c7]" />
            Live Fleet
          </Link>
          <Link
            href="/shipments/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#6c63d4] to-[#5472de] px-3 py-1.5 text-[11px] font-semibold text-white shadow-[0_4px_12px_rgba(99,91,210,0.26)] transition hover:brightness-105"
          >
            <Plus size={13} />
            New Job
          </Link>
        </div>

        <Link href="/alerts" aria-label="Notifications" className="relative rounded-xl border border-slate-200/80 bg-white p-2 text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900">
          <Bell size={17} strokeWidth={1.9} />
          {pendingCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">
              {pendingCount}
            </span>
          )}
        </Link>
        <div className="flex items-center gap-2.5 border-l border-slate-200 pl-3 sm:pl-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#1e293b] to-[#334155] text-[11px] font-bold text-white shadow-sm">
            {initials}
          </div>
          <div className="hidden sm:block">
            <p className="text-[11.5px] font-semibold leading-tight text-slate-900">{user?.full_name || 'User'}</p>
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{user?.role?.replace('_', ' ') || 'Guest'}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button aria-label="Account menu" disabled={signingOut} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#746ad1]">
                <ChevronDown size={14} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild><Link href="/settings"><Settings size={14} className="mr-2" />Account settings</Link></DropdownMenuItem>
              <DropdownMenuItem onSelect={() => { void signOut(); }} disabled={signingOut}><LogOut size={14} className="mr-2" />Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
