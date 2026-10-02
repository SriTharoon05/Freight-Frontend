'use client';

import { useQuery } from '@tanstack/react-query';
import { Bell, ChevronDown, LogOut, Settings } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/auth-store';
import { authApi } from '@/lib/api';
import { setToken } from '@/lib/api-client';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { freight, type Page } from '@/lib/freight';

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
    <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-[#e2def2] bg-[#f4f2ff] px-5 sm:px-8">
      <div>
        <p className="font-display text-[18px] font-semibold tracking-[-0.03em]">
          {greeting()}, {user?.full_name?.split(' ')[0] || 'there'}
        </p>
        <p className="mt-0.5 text-[11px] text-[#9798a4]">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <Link href="/alerts" aria-label="Notifications" className="relative rounded-lg p-2 text-[#858592] transition hover:bg-[#f5f5fa]">
          <Bell size={18} strokeWidth={1.8} />
          {pendingCount > 0 && (
            <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#e4697c] px-1 text-[9px] font-bold text-white">
              {pendingCount}
            </span>
          )}
        </Link>
        <div className="flex items-center gap-2 border-l border-[#eeeef3] pl-3 sm:pl-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d8e8f0] text-[11px] font-bold text-[#3e7086]">
            {initials}
          </div>
          <div className="hidden sm:block">
            <p className="text-[11px] font-semibold text-[#3d3d4a]">{user?.full_name || 'User'}</p>
            <p className="text-[10px] text-[#a0a0ac]">{user?.role?.replace('_', ' ') || 'Guest'}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button aria-label="Account menu" disabled={signingOut} className="rounded-lg p-2 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#746ad1]">
                <ChevronDown size={13} className="text-[#777884]" />
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
