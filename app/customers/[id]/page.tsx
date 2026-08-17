'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Mail, Phone, MapPin, Building2 } from 'lucide-react';
import { customersApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { AppShell } from '@/components/shell/app-shell';
import { Card } from '@/components/shell/card';
import { StatusBadge } from '@/components/shell/badges';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/shell/states';
import { formatINR } from '@/lib/format';

import type { Shipment } from '@/lib/types';

export default function CustomerDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();

  const { data: customer, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.customerDetail(params.id),
    queryFn: () => customersApi.get(params.id),
  });

  const { data: shipments } = useQuery({
    queryKey: queryKeys.customerShipments(params.id),
    queryFn: () => customersApi.shipments(params.id),
  });

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#c8c5e8] border-t-[#746ad1]" />
        </div>
      </AppShell>
    );
  }

  if (isError || !customer) {
    return (
      <AppShell>
        <Card><ErrorState message="Could not load this customer" onRetry={() => refetch()} /></Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <button onClick={() => router.push('/customers')} className="mb-4 flex items-center gap-1.5 text-[12px] font-medium text-[#777884] hover:text-[#393945]">
        <ArrowLeft size={15} />Back to customers
      </button>

      <Card className="mb-5">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f0effd] text-[#756bd1]">
            <Building2 size={24} />
          </span>
          <div className="flex-1">
            <h1 className="font-display text-[22px] font-semibold tracking-[-0.03em] text-[#171725]">{customer.name}</h1>
            <div className="mt-2 flex flex-wrap gap-4 text-[12px] text-[#777884]">
              {customer.email && <span className="flex items-center gap-1.5"><Mail size={13} className="text-[#a0a0ac]" />{customer.email}</span>}
              {customer.phone && <span className="flex items-center gap-1.5"><Phone size={13} className="text-[#a0a0ac]" />{customer.phone}</span>}
              {customer.gstin && <span className="flex items-center gap-1.5"><Building2 size={13} className="text-[#a0a0ac]" />GSTIN: {customer.gstin}</span>}
              {customer.city && <span className="flex items-center gap-1.5"><MapPin size={13} className="text-[#a0a0ac]" />{customer.city}</span>}
            </div>
            {customer.address && <p className="mt-2 text-[12px] text-[#9899a5]">{customer.address}</p>}
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-[#f0f0f4] pt-4 sm:grid-cols-4">
          <Stat label="Credit limit" value={customer.credit_limit_paise ? formatINR(customer.credit_limit_paise) : '—'} />
          <Stat label="Outstanding" value={customer.outstanding_paise ? formatINR(customer.outstanding_paise) : '—'} danger={!!customer.outstanding_paise} />
          <Stat label="Total shipments" value={String(customer.total_shipments || 0)} />
          <Stat label="Active" value={String(customer.active_shipments || 0)} />
        </div>
      </Card>

      <Card>
        <h3 className="mb-4 font-display text-[15px] font-semibold">Shipment history</h3>
        {shipments && shipments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#f0f0f4] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a2a2ad]">
                  <th className="pb-3">Ref</th>
                  <th className="pb-3">Route</th>
                  <th className="pb-3">Mode</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((s: Shipment) => (
                  <tr
                    key={s.id}
                    className="cursor-pointer border-b border-[#f4f4f7] last:border-0 hover:bg-[#fbfbfd]"
                    onClick={() => router.push(`/shipments/${s.id}`)}
                  >
                    <td className="py-3 text-[12px] font-semibold text-[#393945]">{s.ref_number}</td>
                    <td className="py-3 text-[11px] text-[#777884]">{s.origin} → {s.destination}</td>
                    <td className="py-3 text-[11px] text-[#777884] capitalize">{s.transport_mode}</td>
                    <td className="py-3"><StatusBadge status={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No shipments" message="This customer has no shipments yet." />
        )}
      </Card>
    </AppShell>
  );
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#a0a0ac]">{label}</p>
      <p className={`mt-0.5 font-display text-[18px] font-semibold ${danger ? 'text-[#d45166]' : 'text-[#393945]'}`}>{value}</p>
    </div>
  );
}
