'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Package, CircleHelp, Clock3, Truck, ArrowUpRight, ArrowDownRight,
  Plus, Ship, Plane, Activity,
} from 'lucide-react';
import { dashboardApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { formatINR } from '@/lib/format';
import { timeAgo, formatIST } from '@/lib/date';
import { Card, CardHeader, SectionTitle } from '@/components/shell/card';
import { KpiSkeleton, ListSkeleton, EmptyState, ErrorState } from '@/components/shell/states';
import { SeverityBadge } from '@/components/shell/badges';
import { AppShell } from '@/components/shell/app-shell';
import type { Shipment, Exception } from '@/lib/types';

function MetricCard({ label, value, comparison, trend, tone, icon: Icon }: {
  label: string; value: string; comparison: string; trend: string;
  tone: 'green' | 'red' | 'blue'; icon: typeof Activity;
}) {
  const palette = {
    green: 'bg-[#edfaf4] text-[#26ae72]',
    red: 'bg-[#fff1f3] text-[#de6678]',
    blue: 'bg-[#eff6ff] text-[#6193de]',
  };
  const positive = tone !== 'red';
  return (
    <Card>
      <div className="mb-8 flex items-start justify-between">
        <div className="flex items-center gap-2.5 text-[13px] font-medium text-[#6f7180]">
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${palette[tone]}`}>
            <Icon size={16} strokeWidth={2.2} />
          </span>
          {label}
        </div>
        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${palette[tone]}`}>{trend}</span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className="font-display text-[30px] font-semibold tracking-[-0.04em] text-[#161724]">{value}</p>
        <span className={`mb-1 flex items-center gap-1 text-[11px] font-medium ${positive ? 'text-[#22a76d]' : 'text-[#dc6275]'}`}>
          {positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {comparison}
        </span>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const router = useRouter();

  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: dashboardApi.stats,
    refetchInterval: 60_000,
  });

  const { data: exceptions, isLoading: exLoading } = useQuery({
    queryKey: queryKeys.openExceptions(10),
    queryFn: () => dashboardApi.openExceptions(10),
  });

  const { data: recent, isLoading: recLoading } = useQuery({
    queryKey: queryKeys.recentShipments(20),
    queryFn: () => dashboardApi.recentShipments(20),
  });

  return (
    <AppShell>
      <SectionTitle
        action={
          <>
            <button className="flex items-center gap-2 rounded-xl border border-[#e7e7ed] bg-white px-3 py-2.5 text-[11px] font-medium text-[#777884] shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-[#34bf87]" />Last 30 days
            </button>
            <button
              onClick={() => router.push('/shipments/new')}
              className="flex items-center gap-2 rounded-xl bg-[#7068cf] px-3.5 py-2.5 text-[11px] font-semibold text-white shadow-[0_6px_14px_rgba(112,104,207,0.2)] transition hover:bg-[#6259c1]"
            >
              <Plus size={14} />New shipment
            </button>
          </>
        }
      >
        Operations overview
      </SectionTitle>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : statsError ? (
          <div className="col-span-full">
            <ErrorState message="Could not load dashboard stats" onRetry={() => refetchStats()} />
          </div>
        ) : stats ? (
          <>
            <MetricCard label="Active shipments" value={String(stats.active_count)} comparison="+12.4%" trend="+16" tone="blue" icon={Package} />
            <MetricCard label="Open exceptions" value={String(stats.exceptions_open).padStart(2, '0')} comparison="-8.2%" trend="-3" tone="green" icon={CircleHelp} />
            <MetricCard label="D&D risk today" value={formatINR(stats.dd_risk_paise)} comparison="+6.8%" trend="+₹28K" tone="red" icon={Clock3} />
            <MetricCard label="Pickups due today" value={String(stats.pickups_due_today)} comparison="+4.1%" trend="+6" tone="green" icon={Truck} />
          </>
        ) : null}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Exception alerts" subtitle="Severity-sorted, live from the warehouse" />
          {exLoading ? (
            <ListSkeleton rows={5} />
          ) : exceptions && exceptions.length > 0 ? (
            <div className="space-y-2">
              {exceptions.map((ex: Exception) => (
                <div
                  key={ex.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl bg-[#fbfbfd] p-3 transition hover:bg-[#f6f5fd]"
                  onClick={() => router.push(`/shipments/${ex.shipment_id}`)}
                >
                  <SeverityBadge severity={ex.severity} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-[#393945]">{ex.title}</p>
                    <p className="truncate text-[11px] text-[#9899a5]">{ex.shipment_ref || ex.shipment_id}</p>
                  </div>
                  {ex.dd_exposure_paise ? (
                    <span className="text-[11px] font-semibold text-[#d45166]">{formatINR(ex.dd_exposure_paise)}</span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No exceptions open" message="All shipments are on track. Exceptions will appear here in real time." />
          )}
        </Card>

        <Card>
          <CardHeader title="Recent activity" subtitle="Latest shipment updates" />
          {recLoading ? (
            <ListSkeleton rows={5} />
          ) : recent && recent.length > 0 ? (
            <div className="space-y-2">
              {recent.slice(0, 8).map((s: Shipment) => (
                <div
                  key={s.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl bg-[#fbfbfd] p-3 transition hover:bg-[#f6f5fd]"
                  onClick={() => router.push(`/shipments/${s.id}`)}
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${s.transport_mode === 'air' ? 'bg-[#edf6ff] text-[#5d90d7]' : 'bg-[#eaf9f2] text-[#38ae83]'}`}>
                    {s.transport_mode === 'air' ? <Plane size={15} /> : <Ship size={15} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-[#393945]">{s.ref_number}</p>
                    <p className="truncate text-[11px] text-[#9899a5]">{s.origin} → {s.destination}</p>
                  </div>
                  <span className="text-right text-[10px] text-[#a0a0ad]">{s.updated_at ? timeAgo(s.updated_at) : timeAgo(s.created_at)}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No recent activity" message="Shipment updates will appear here as they happen." />
          )}
        </Card>
      </div>
    </AppShell>
  );
}
