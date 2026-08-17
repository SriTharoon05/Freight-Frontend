'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Warehouse, Package } from 'lucide-react';
import { warehouseApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { AppShell } from '@/components/shell/app-shell';
import { Card, SectionTitle } from '@/components/shell/card';
import { EmptyState, ErrorState, TableSkeleton, ListSkeleton } from '@/components/shell/states';
import { formatIST } from '@/lib/date';
import type { BayStatus, WarehouseBay, WarehouseInventory } from '@/lib/types';

const BAY_STYLES: Record<BayStatus, { bg: string; text: string; label: string }> = {
  available: { bg: 'bg-[#eaf9f2]', text: 'text-[#13945a]', label: 'Available' },
  occupied: { bg: 'bg-[#fff7e7]', text: 'text-[#b77912]', label: 'Occupied' },
  reserved: { bg: 'bg-[#edf5ff]', text: 'text-[#5185d8]', label: 'Reserved' },
  maintenance: { bg: 'bg-slate-100', text: 'text-slate-500', label: 'Maintenance' },
};

export default function WarehousePage() {
  const [warehouseId, setWarehouseId] = useState('');

  const { data: bays, isLoading: bLoading, isError: bError, refetch: bRefetch } = useQuery({
    queryKey: queryKeys.warehouseBays(warehouseId || undefined),
    queryFn: () => warehouseApi.bays(warehouseId || undefined),
  });

  const { data: inventory, isLoading: iLoading } = useQuery({
    queryKey: queryKeys.warehouseInventory(warehouseId || undefined),
    queryFn: () => warehouseApi.inventory(warehouseId || undefined),
  });

  return (
    <AppShell>
      <SectionTitle
        action={
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="rounded-xl border border-[#e9e9ef] bg-white px-3 py-2.5 text-[11px] font-medium text-[#777884] outline-none"
          >
            <option value="">All warehouses</option>
            <option value="wh-1">Warehouse 1</option>
            <option value="wh-2">Warehouse 2</option>
          </select>
        }
      >
        Warehouse
      </SectionTitle>

      <Card className="mb-5">
        <h3 className="mb-4 font-display text-[15px] font-semibold">Bay status</h3>
        {bLoading ? (
          <div className="grid grid-cols-6 gap-3 sm:grid-cols-8 md:grid-cols-12">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-xl bg-[#f0f0f5]" />
            ))}
          </div>
        ) : bError ? (
          <ErrorState message="Could not load warehouse bays" onRetry={() => bRefetch()} />
        ) : bays && bays.length > 0 ? (
          <>
            <div className="mb-4 flex gap-4">
              {(Object.keys(BAY_STYLES) as BayStatus[]).map((status) => (
                <span key={status} className="flex items-center gap-1.5 text-[11px] font-medium text-[#555]">
                  <span className={`h-3 w-3 rounded ${BAY_STYLES[status].bg} border border-[#e9e9ef]`} />
                  {BAY_STYLES[status].label}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-6 gap-3 sm:grid-cols-8 md:grid-cols-12">
              {bays.map((bay: WarehouseBay) => {
                const style = BAY_STYLES[bay.status];
                return (
                  <div
                    key={bay.id}
                    className={`flex aspect-square flex-col items-center justify-center rounded-xl border border-[#e9e9ef] ${style.bg} ${style.text} transition hover:scale-105`}
                    title={`${bay.bay_number} · ${style.label}${bay.shipment_ref ? ` · ${bay.shipment_ref}` : ''}`}
                  >
                    <Warehouse size={16} className="opacity-60" />
                    <span className="mt-1 text-[10px] font-bold">{bay.bay_number}</span>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <EmptyState title="No bays found" message="Warehouse bay data will appear here once configured." />
        )}
      </Card>

      <Card>
        <h3 className="mb-4 flex items-center gap-2 font-display text-[15px] font-semibold">
          <Package size={16} className="text-[#756bd1]" />
          Inventory
        </h3>
        {iLoading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : inventory && inventory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#f0f0f4] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a2a2ad]">
                  <th className="pb-3">Shipment</th>
                  <th className="pb-3">Cargo</th>
                  <th className="pb-3">Packages</th>
                  <th className="pb-3">Weight</th>
                  <th className="pb-3">Received</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((item: WarehouseInventory) => (
                  <tr key={item.id} className="border-b border-[#f4f4f7] last:border-0">
                    <td className="py-3 text-[12px] font-semibold text-[#393945]">{item.shipment_ref || item.shipment_id}</td>
                    <td className="py-3 text-[11px] text-[#777884]">{item.cargo_description || '—'}</td>
                    <td className="py-3 text-[11px] text-[#777884]">{item.packages}</td>
                    <td className="py-3 text-[11px] text-[#777884]">{item.weight_kg ? `${item.weight_kg} kg` : '—'}</td>
                    <td className="py-3 text-[11px] text-[#9899a5]">{formatIST(item.received_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No inventory" message="Received cargo will appear here as it arrives at the warehouse." />
        )}
      </Card>
    </AppShell>
  );
}
