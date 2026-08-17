'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, Plus, Ship, Plane, Truck, Train, ChevronLeft, ChevronRight } from 'lucide-react';
import { shipmentsApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { AppShell } from '@/components/shell/app-shell';
import { Card } from '@/components/shell/card';
import { SectionTitle } from '@/components/shell/card';
import { StatusBadge } from '@/components/shell/badges';
import { TableSkeleton, EmptyState, ErrorState } from '@/components/shell/states';
import type { Shipment, ShipmentStatus } from '@/lib/types';

const MODE_ICONS: Record<string, typeof Ship> = {
  ocean: Ship, air: Plane, road: Truck, rail: Train,
};

const STATUS_OPTIONS: { label: string; value: string }[] = [
  { label: 'All statuses', value: '' },
  { label: 'Draft', value: 'draft' },
  { label: 'Booked', value: 'booked' },
  { label: 'In transit', value: 'in_transit' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Exception', value: 'exception' },
];

const MODE_OPTIONS: { label: string; value: string }[] = [
  { label: 'All modes', value: '' },
  { label: 'Ocean', value: 'ocean' },
  { label: 'Air', value: 'air' },
  { label: 'Road', value: 'road' },
  { label: 'Rail', value: 'rail' },
];

export default function ShipmentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [mode, setMode] = useState('');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1'));
  const limit = 20;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (page > 1) params.set('page', String(page));
    router.replace(`/shipments${params.toString() ? `?${params}` : ''}`);
  }, [page, router]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.shipments({ page, limit, status, mode, search: debouncedSearch }),
    queryFn: () => shipmentsApi.list({ page, limit, status: status || undefined, mode: mode || undefined, search: debouncedSearch || undefined }),
  });

  const shipments = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <AppShell>
      <SectionTitle
        action={
          <button
            onClick={() => router.push('/shipments/new')}
            className="flex items-center gap-2 rounded-xl bg-[#7068cf] px-3.5 py-2.5 text-[11px] font-semibold text-white shadow-[0_6px_14px_rgba(112,104,207,0.2)] transition hover:bg-[#6259c1]"
          >
            <Plus size={14} />New shipment
          </button>
        }
      >
        Shipments
      </SectionTitle>

      <Card className="mb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-[#ededf2] px-3 py-2">
            <Search size={15} className="text-[#9b9aa6]" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search ref, BL, container, customer…"
              className="w-full bg-transparent text-[12px] outline-none placeholder:text-[#b0b0ba]"
            />
          </div>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-lg border border-[#ededf2] bg-white px-3 py-2 text-[12px] font-medium text-[#686975] outline-none">
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={mode} onChange={(e) => { setMode(e.target.value); setPage(1); }} className="rounded-lg border border-[#ededf2] bg-white px-3 py-2 text-[12px] font-medium text-[#686975] outline-none">
            {MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : isError ? (
          <ErrorState message="Could not load shipments" onRetry={() => refetch()} />
        ) : shipments.length === 0 ? (
          <EmptyState
            title="No shipments found"
            message="Try adjusting your filters or create a new shipment to get started."
            action={
              <button onClick={() => router.push('/shipments/new')} className="rounded-lg bg-[#7068cf] px-4 py-2 text-[12px] font-semibold text-white">
                New shipment
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#f0f0f4] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a2a2ad]">
                  <th className="pb-3 pl-1">Shipment</th>
                  <th className="pb-3">Route</th>
                  <th className="pb-3">Mode</th>
                  <th className="pb-3">ETA</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Approvals</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((s: Shipment) => {
                  const ModeIcon = MODE_ICONS[s.transport_mode] || Ship;
                  return (
                    <tr
                      key={s.id}
                      className="group cursor-pointer border-b border-[#f4f4f7] last:border-0"
                      onClick={() => router.push(`/shipments/${s.id}`)}
                    >
                      <td className="py-3.5 pl-1">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f0effd] text-[#756bd1]">
                            <ModeIcon size={15} />
                          </span>
                          <div>
                            <p className="text-[12px] font-semibold text-[#373743]">{s.ref_number}</p>
                            <p className="mt-0.5 text-[10px] text-[#999aa6]">{s.shipper_name || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 text-[11px] text-[#626370]">{s.origin} → {s.destination}</td>
                      <td className="py-3.5 text-[11px] text-[#777884] capitalize">{s.transport_mode}</td>
                      <td className="py-3.5 text-[11px] text-[#777884]">{s.eta ? new Date(s.eta).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                      <td className="py-3.5"><StatusBadge status={s.status} /></td>
                      <td className="py-3.5">
                        {s.has_pending_approvals ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#fff7e7] px-2 py-1 text-[10px] font-semibold text-[#b77912]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#d99a35]" />Pending
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#c0c0c8]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between border-t border-[#f0f0f4] pt-4">
            <p className="text-[11px] text-[#9899a5]">
              Page {page} of {totalPages} · {total} shipments
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-[#e9e9ef] p-2 text-[#777884] disabled:opacity-40 hover:bg-[#f7f7fa]"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-[#e9e9ef] p-2 text-[#777884] disabled:opacity-40 hover:bg-[#f7f7fa]"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </Card>
    </AppShell>
  );
}
