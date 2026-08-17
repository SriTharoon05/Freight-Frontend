'use client';

import { useQuery } from '@tanstack/react-query';
import { Bell, ChevronDown } from 'lucide-react';
import { approvalsApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/lib/auth-store';
import { authApi } from '@/lib/api';
import { api } from '@/lib/api-client';

export function TopNav() {
  const { user } = useAuthStore();
  const { data: approvals } = useQuery({
    queryKey: queryKeys.approvals('pending'),
    queryFn: () => approvalsApi.list('pending', 50),
  });

  const pendingCount = approvals?.length ?? 0;
  const initials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  return (
    <header className="flex h-[72px] items-center justify-between border-b border-[#f0eff4] px-5 sm:px-8">
      <div>
        <p className="font-display text-[18px] font-semibold tracking-[-0.03em]">
          {greeting()}, {user?.full_name?.split(' ')[0] || 'there'}
        </p>
        <p className="mt-0.5 text-[11px] text-[#9798a4]">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <button className="hidden items-center gap-2 rounded-lg border border-[#e9e9ef] bg-white px-3 py-2 text-[11px] font-medium text-[#777884] sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-[#34bf87]" />
          Live systems
        </button>
        <button className="relative rounded-lg p-2 text-[#858592] transition hover:bg-[#f5f5fa]">
          <Bell size={18} strokeWidth={1.8} />
          {pendingCount > 0 && (
            <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#e4697c] px-1 text-[9px] font-bold text-white">
              {pendingCount}
            </span>
          )}
        </button>
        <div className="flex items-center gap-2 border-l border-[#eeeef3] pl-3 sm:pl-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d8e8f0] text-[11px] font-bold text-[#3e7086]">
            {initials}
          </div>
          <div className="hidden sm:block">
            <p className="text-[11px] font-semibold text-[#3d3d4a]">{user?.full_name || 'User'}</p>
            <p className="text-[10px] text-[#a0a0ac]">{user?.role?.replace('_', ' ') || 'Guest'}</p>
          </div>
          <ChevronDown size={13} className="text-[#a6a6b0]" />
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
