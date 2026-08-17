'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, TrendingUp, Clock, Package } from 'lucide-react';
import { vendorIntelligenceApi, crmApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { AppShell } from '@/components/shell/app-shell';
import { Card, SectionTitle } from '@/components/shell/card';
import { SlideOver } from '@/components/shell/slide-over';
import { TableSkeleton, ErrorState, EmptyState } from '@/components/shell/states';
import { formatISTDate } from '@/lib/date';
import { toApiError } from '@/lib/api-client';
import type { LaneStats, CarrierPerformance, CrmCarrier } from '@/lib/types';

const inputCls = 'rounded-lg border border-[#e9e9ef] bg-white px-3 py-2 text-[12px] font-medium text-[#393945] outline-none focus:border-[#746ad1] focus:ring-2 focus:ring-[#e8e5f7]';

function onTimeColor(rate: number): string {
  if (rate >= 90) return 'text-[#13945a]';
  if (rate >= 70) return 'text-[#b77912]';
  return 'text-[#d45166]';
}

function onTimeBg(rate: number): string {
  if (rate >= 90) return 'bg-[#eaf9f2]';
  if (rate >= 70) return 'bg-[#fff7e7]';
  return 'bg-[#fff0f2]';
}

export default function VendorIntelligencePage() {
  const [tab, setTab] = useState<'lane' | 'carrier'>('lane');
  const [filters, setFilters] = useState({ transport_mode: '', origin_country: '', dest_country: '' });
  const [selectedCarrier, setSelectedCarrier] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [perfSheet, setPerfSheet] = useState<LaneStats | null>(null);

  const laneQuery = useQuery({
    queryKey: queryKeys.laneStats(filters),
    queryFn: () => vendorIntelligenceApi.laneStats(filters),
    enabled: tab === 'lane',
  });

  const carriersQuery = useQuery({
    queryKey: queryKeys.crmCarriers({}),
    queryFn: () => crmApi.listCarriers({}),
    enabled: tab === 'carrier',
  });

  const perfQuery = useQuery({
    queryKey: queryKeys.carrierPerformance(selectedCarrier, dateFrom, dateTo),
    queryFn: () => vendorIntelligenceApi.carrierPerformance({
      carrier_id: selectedCarrier,
      from: dateFrom || undefined,
      to: dateTo || undefined,
    }),
    enabled: tab === 'carrier' && !!selectedCarrier,
  });

  return (
    <AppShell>
      <SectionTitle>Vendor Intelligence</SectionTitle>

      <div className="mb-5 flex gap-1 border-b border-[#f0f0f4]">
        {(['lane', 'carrier'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative px-4 py-2.5 text-[12px] font-semibold transition ${
              tab === t ? 'text-[#7068cf]' : 'text-[#777884] hover:text-[#393945]'
            }`}
          >
            {t === 'lane' ? 'Lane Performance' : 'Carrier Analysis'}
            {tab === t && <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[#7068cf]" />}
          </button>
        ))}
      </div>

      {tab === 'lane' && (
        <>
          <div className="mb-5 flex flex-wrap gap-3">
            <select
              value={filters.transport_mode}
              onChange={(e) => setFilters({ ...filters, transport_mode: e.target.value })}
              className={inputCls}
            >
              <option value="">All Modes</option>
              <option value="ocean">Ocean</option>
              <option value="air">Air</option>
              <option value="road">Road</option>
              <option value="rail">Rail</option>
            </select>
            <input
              placeholder="Origin Country"
              value={filters.origin_country}
              onChange={(e) => setFilters({ ...filters, origin_country: e.target.value })}
              className={inputCls}
            />
            <input
              placeholder="Destination Country"
              value={filters.dest_country}
              onChange={(e) => setFilters({ ...filters, dest_country: e.target.value })}
              className={inputCls}
            />
          </div>

          <Card>
            {laneQuery.isLoading ? (
              <TableSkeleton rows={6} cols={6} />
            ) : laneQuery.isError ? (
              <ErrorState message="Could not load lane stats" onRetry={() => laneQuery.refetch()} />
            ) : !laneQuery.data?.items?.length ? (
              <EmptyState title="No lane data" message="No carrier lane performance found for these filters." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-[#f0f0f4] text-left text-[10px] font-bold uppercase tracking-wide text-[#a0a0ac]">
                      <th className="pb-2 pr-4">Carrier</th>
                      <th className="pb-2 pr-4">Mode</th>
                      <th className="pb-2 pr-4">Route</th>
                      <th className="pb-2 pr-4 text-right">Shipments (90d)</th>
                      <th className="pb-2 pr-4 text-right">On-Time %</th>
                      <th className="pb-2 text-right">Avg Transit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {laneQuery.data.items.map((row: LaneStats) => (
                      <tr
                        key={`${row.carrier_id}-${row.origin_country}-${row.dest_country}`}
                        onClick={() => setPerfSheet(row)}
                        className="cursor-pointer border-b border-[#f5f5f8] hover:bg-[#fafafd]"
                      >
                        <td className="py-3 pr-4 font-semibold text-[#393945]">{row.carrier_name}</td>
                        <td className="py-3 pr-4 capitalize text-[#777884]">{row.transport_mode}</td>
                        <td className="py-3 pr-4 text-[#777884]">{row.origin_country} → {row.dest_country}</td>
                        <td className="py-3 pr-4 text-right font-semibold text-[#393945]">{row.shipments_90d}</td>
                        <td className="py-3 pr-4 text-right">
                          <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold ${onTimeBg(row.on_time_rate)} ${onTimeColor(row.on_time_rate)}`}>
                            {row.on_time_rate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 text-right text-[#777884]">{row.avg_transit_days.toFixed(1)}d</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {tab === 'carrier' && (
        <>
          <div className="mb-5 flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-[#393945]">Carrier</label>
              <select
                value={selectedCarrier}
                onChange={(e) => setSelectedCarrier(e.target.value)}
                className={inputCls}
              >
                <option value="">Select carrier…</option>
                {carriersQuery.data?.items?.map((c: CrmCarrier) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-[#393945]">From</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-[#393945]">To</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputCls} />
            </div>
          </div>

          {!selectedCarrier ? (
            <Card><EmptyState title="Select a carrier" message="Choose a carrier to view performance metrics." /></Card>
          ) : perfQuery.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-28 rounded-[18px] border border-[#e9eaf0] bg-white animate-pulse" />)}
            </div>
          ) : perfQuery.isError ? (
            <Card><ErrorState message="Could not load carrier performance" onRetry={() => perfQuery.refetch()} /></Card>
          ) : perfQuery.data ? (
            <CarrierAnalysisView data={perfQuery.data} />
          ) : null}
        </>
      )}

      <SlideOver
        open={!!perfSheet}
        onClose={() => setPerfSheet(null)}
        title={perfSheet?.carrier_name || 'Carrier Performance'}
      >
        {perfSheet && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[#f7f6fc] p-4">
                <p className="text-[10px] font-semibold uppercase text-[#a0a0ac]">Shipments (90d)</p>
                <p className="mt-1 font-display text-[20px] font-semibold text-[#393945]">{perfSheet.shipments_90d}</p>
              </div>
              <div className="rounded-xl bg-[#f7f6fc] p-4">
                <p className="text-[10px] font-semibold uppercase text-[#a0a0ac]">On-Time Rate</p>
                <p className={`mt-1 font-display text-[20px] font-semibold ${onTimeColor(perfSheet.on_time_rate)}`}>
                  {perfSheet.on_time_rate.toFixed(1)}%
                </p>
              </div>
              <div className="rounded-xl bg-[#f7f6fc] p-4">
                <p className="text-[10px] font-semibold uppercase text-[#a0a0ac]">Avg Transit</p>
                <p className="mt-1 font-display text-[20px] font-semibold text-[#393945]">{perfSheet.avg_transit_days.toFixed(1)}d</p>
              </div>
              <div className="rounded-xl bg-[#f7f6fc] p-4">
                <p className="text-[10px] font-semibold uppercase text-[#a0a0ac]">Route</p>
                <p className="mt-1 text-[13px] font-semibold text-[#393945]">{perfSheet.origin_country} → {perfSheet.dest_country}</p>
                <p className="text-[10px] capitalize text-[#9899a5]">{perfSheet.transport_mode}</p>
              </div>
            </div>
          </div>
        )}
      </SlideOver>
    </AppShell>
  );
}

function CarrierAnalysisView({ data }: { data: CarrierPerformance }) {
  return (
    <>
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <KpiCard icon={Package} label="Total Shipments" value={String(data.total_shipments)} />
        <KpiCard icon={TrendingUp} label="On-Time Rate" value={`${data.on_time_rate.toFixed(1)}%`} valueClass={onTimeColor(data.on_time_rate)} />
        <KpiCard icon={Clock} label="Avg Transit Days" value={`${data.avg_transit_days.toFixed(1)}d`} />
      </div>

      <Card>
        <h3 className="mb-4 font-display text-[15px] font-semibold">Lane Breakdown</h3>
        {data.lanes?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[#f0f0f4] text-left text-[10px] font-bold uppercase tracking-wide text-[#a0a0ac]">
                  <th className="pb-2 pr-4">Route</th>
                  <th className="pb-2 pr-4 text-right">Count</th>
                  <th className="pb-2 pr-4 text-right">On-Time %</th>
                  <th className="pb-2 text-right">Avg Days</th>
                </tr>
              </thead>
              <tbody>
                {data.lanes.map((lane, i) => (
                  <tr key={i} className="border-b border-[#f5f5f8]">
                    <td className="py-3 pr-4 font-semibold text-[#393945]">{lane.origin_country} → {lane.dest_country}</td>
                    <td className="py-3 pr-4 text-right text-[#393945]">{lane.count}</td>
                    <td className="py-3 pr-4 text-right">
                      <span className={`font-bold ${onTimeColor(lane.on_time_rate)}`}>{lane.on_time_rate.toFixed(1)}%</span>
                    </td>
                    <td className="py-3 text-right text-[#777884]">{lane.avg_transit_days.toFixed(1)}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No lane data" message="No lane breakdown available for this carrier in the selected period." />
        )}
      </Card>
    </>
  );
}

function KpiCard({ icon: Icon, label, value, valueClass }: { icon: typeof Package; label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-[18px] border border-[#e9eaf0] bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f0effd] text-[#756bd1]">
          <Icon size={16} />
        </span>
        <span className="text-[11px] font-semibold text-[#777884]">{label}</span>
      </div>
      <p className={`font-display text-[24px] font-semibold ${valueClass || 'text-[#393945]'}`}>{value}</p>
    </div>
  );
}
