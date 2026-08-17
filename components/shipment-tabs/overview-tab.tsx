'use client';

import { useQuery } from '@tanstack/react-query';
import { Clock3, AlertTriangle } from 'lucide-react';
import { shipmentsApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { formatINR } from '@/lib/format';
import { formatIST } from '@/lib/date';
import { Card } from '@/components/shell/card';
import { EmptyState, ErrorState } from '@/components/shell/states';
import type { ShipmentDetail, Quote } from '@/lib/types';

export function OverviewTab({ shipmentId, detail }: { shipmentId: string; detail: ShipmentDetail }) {
  const freeTimeMs = detail.free_time_expires_at
    ? new Date(detail.free_time_expires_at).getTime() - Date.now()
    : null;
  const within48h = freeTimeMs !== null && freeTimeMs > 0 && freeTimeMs < 48 * 60 * 60 * 1000;

  const { data: quotes, isLoading: qLoading } = useQuery({
    queryKey: queryKeys.shipmentQuotes(shipmentId),
    queryFn: () => shipmentsApi.quotes(shipmentId),
  });

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <h3 className="mb-4 font-display text-[15px] font-semibold">Cargo & booking</h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-[12px] sm:grid-cols-3">
          <Field label="Cargo" value={detail.cargo_description || '—'} />
          <Field label="Weight" value={detail.weight_kg ? `${detail.weight_kg} kg` : '—'} />
          <Field label="Packages" value={detail.packages ? String(detail.packages) : '—'} />
          <Field label="Volume" value={detail.volume_cbm ? `${detail.volume_cbm} CBM` : '—'} />
          <Field label="Incoterm" value={detail.incoterm || '—'} />
          <Field label="Booking #" value={detail.booking_number || '—'} />
          <Field label="BL #" value={detail.bl_number || '—'} />
          <Field label="Container #" value={detail.container_number || '—'} />
          <Field label="Value" value={detail.value_paise ? formatINR(detail.value_paise) : '—'} />
        </div>

        <h3 className="mb-4 mt-6 font-display text-[15px] font-semibold">Parties</h3>
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 text-[12px] sm:grid-cols-2">
          <Field label="Shipper" value={detail.shipper_name || '—'} />
          <Field label="Shipper address" value={detail.shipper_address || '—'} />
          <Field label="Consignee" value={detail.consignee || '—'} />
          <Field label="Consignee address" value={detail.consignee_address || '—'} />
          <Field label="Carrier" value={detail.carrier_name || '—'} />
          <Field label="ICEGATE status" value={detail.icegate_status || '—'} />
        </div>
      </Card>

      <div className="space-y-5">
        {within48h && (
          <Card className="border-[#f6d4da] bg-[#fff5f6]">
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle size={18} className="text-[#d45166]" />
              <h3 className="font-display text-[14px] font-semibold text-[#d45166]">D&D risk</h3>
            </div>
            <p className="text-[12px] text-[#a04050]">
              Free time expires in {Math.ceil((freeTimeMs || 0) / (60 * 60 * 1000))} hours.
              Demurrage charges may apply after {detail.free_time_expires_at ? formatIST(detail.free_time_expires_at) : '—'}.
            </p>
          </Card>
        )}

        <Card>
          <h3 className="mb-4 font-display text-[15px] font-semibold">Quotes</h3>
          {qLoading ? (
            <p className="text-[12px] text-[#9899a5]">Loading…</p>
          ) : quotes && quotes.length > 0 ? (
            <div className="space-y-2">
              {quotes.map((q: Quote) => (
                <div key={q.id} className="flex items-center justify-between rounded-lg bg-[#fbfbfd] px-3 py-2">
                  <div>
                    <p className="text-[12px] font-semibold text-[#393945]">{q.carrier_name || 'Carrier'}</p>
                    <p className="text-[10px] text-[#9899a5]">{q.status}</p>
                  </div>
                  <span className="font-display text-[14px] font-semibold text-[#393945]">{formatINR(q.amount_paise)}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No quotes" message="Quotes will appear here once generated." />
          )}
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#a0a0ac]">{label}</p>
      <p className="mt-0.5 text-[12px] text-[#393945]">{value}</p>
    </div>
  );
}
