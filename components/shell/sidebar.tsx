'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard, Package, Inbox, Users, Workflow,
  Settings2, Truck, Warehouse, FileText, Gauge, Command,
  BarChart3, Send, BellDot, LayoutList, BookUser,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { escalationsApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';

const nav = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Shipments', href: '/shipments', icon: Package },
  { label: 'Approvals', href: '/approvals', icon: Inbox },
  { label: 'Assignments', href: '/assignment-manager', icon: LayoutList },
  { label: 'Warehouse', href: '/warehouse', icon: Warehouse },
  { label: 'Documents', href: '/documents', icon: FileText },
  { label: 'Customers', href: '/crm', icon: BookUser },
  { label: 'Rates', href: '/rates', icon: Gauge },
  { label: 'Vendors', href: '/vendor-intelligence', icon: BarChart3 },
  { label: 'Rate Requests', href: '/vendor-quotes', icon: Send },
];

function EscalationBadge() {
  const { data } = useQuery({
    queryKey: queryKeys.escalationCount,
    queryFn: () => escalationsApi.list({ status: 'open', limit: 1 }),
    refetchInterval: 60000,
  });
  const count = data?.total ?? 0;
  if (count === 0) return null;
  return (
    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[#d45166] px-1.5 text-[10px] font-bold text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-[218px] shrink-0 flex-col border-r border-[#eeedf3] bg-white px-5 py-6 lg:flex">
      <div className="mb-10 flex items-center gap-2.5 px-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#746ad1] to-[#55b9cb] text-white shadow-[0_6px_14px_rgba(112,103,204,0.28)]">
          <Command size={19} />
        </span>
        <span className="font-display text-[17px] font-semibold tracking-[-0.04em]">
          Freight<span className="text-[#7770d4]">OS</span>
        </span>
      </div>

      <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#b4b4bf]">Workspace</div>
      <nav className="space-y-1">
        {nav.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition',
                active ? 'bg-[#f0effc] text-[#655dc4]' : 'text-[#777884] hover:bg-[#fafafd] hover:text-[#343444]'
              )}
            >
              <Icon size={17} strokeWidth={1.8} />
              {label}
            </Link>
          );
        })}
        <Link
          href="/escalations"
          className={cn(
            'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition',
            pathname.startsWith('/escalations') ? 'bg-[#f0effc] text-[#655dc4]' : 'text-[#777884] hover:bg-[#fafafd] hover:text-[#343444]'
          )}
        >
          <BellDot size={17} strokeWidth={1.8} />
          Escalations
          <EscalationBadge />
        </Link>
      </nav>

      <div className="mb-3 mt-8 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#b4b4bf]">Manage</div>
      <nav className="space-y-1">
        <Link href="/settings" className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition', pathname.startsWith('/settings') ? 'bg-[#f0effc] text-[#655dc4]' : 'text-[#777884] hover:bg-[#fafafd]')}>
          <Settings2 size={17} strokeWidth={1.8} />
          Settings
        </Link>
      </nav>
    </aside>
  );
}
