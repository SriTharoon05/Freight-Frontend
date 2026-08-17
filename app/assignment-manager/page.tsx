'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight, Truck, AlertTriangle, Phone, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { assignmentManagerApi, crmApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { AppShell } from '@/components/shell/app-shell';
import { Card, SectionTitle } from '@/components/shell/card';
import { Modal } from '@/components/shell/modal';
import { StatusBadge } from '@/components/shell/badges';
import { TableSkeleton, ErrorState, EmptyState } from '@/components/shell/states';
import { timeAgo } from '@/lib/date';
import { toApiError } from '@/lib/api-client';
import { supabase } from '@/lib/supabase';
import type { AssignmentManagerRow, ShipmentStatus, CrmCarrier } from '@/lib/types';

const inputCls = 'rounded-lg border border-[#e9e9ef] bg-white px-3 py-2 text-[12px] font-medium text-[#393945] outline-none focus:border-[#746ad1] focus:ring-2 focus:ring-[#e8e5f7]';

const STATUS_OPTIONS: ShipmentStatus[] = [
  'draft', 'booked', 'assigned', 'picked_up', 'in_transit',
  'at_port', 'customs_hold', 'customs_cleared', 'loaded', 'departed',
  'arrived', 'unloaded', 'warehouse_received', 'out_for_delivery',
  'delivered', 'exception', 'cancelled', 'on_hold',
];

export default function AssignmentManagerPage() {
  const queryClient = useQueryClient();
  const [statusModal, setStatusModal] = useState<AssignmentManagerRow | null>(null);
  const [vendorModal, setVendorModal] = useState<AssignmentManagerRow | null>(null);

  const [filters, setFilters] = useState({ date: 'today', agent_id: '', carrier_id: '', status: '' });

  const statsQuery = useQuery({
    queryKey: queryKeys.assignmentManagerStats,
    queryFn: () => assignmentManagerApi.stats(),
  });

  const listQuery = useQuery({
    queryKey: queryKeys.assignmentManager(filters),
    queryFn: () => assignmentManagerApi.list(filters),
  });

  const carriersQuery = useQuery({
    queryKey: queryKeys.crmCarriers({}),
    queryFn: () => crmApi.listCarriers({}),
  });

  useEffect(() => {
    const channel = supabase
      .channel('shipments-assignment-mgr')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shipments' }, () => {
        queryClient.invalidateQueries({ queryKey: ['assignment-manager'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return (
    <AppShell>
      <SectionTitle>Assignment Manager</SectionTitle>

      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <StatChip label="Total Active" value={statsQuery.data?.total_active ?? '—'} />
        <StatChip label="Unassigned" value={statsQuery.data?.unassigned ?? '—'} danger />
        <StatChip label="Awaiting Vendor" value={statsQuery.data?.awaiting_vendor ?? '—'} warn />
        <StatChip label="Stale >30min" value={statsQuery.data?.stale_gt_30 ?? '—'} danger />
      </div>

      <div className="mb-5 flex flex-wrap gap-3">
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className={inputCls}>
          <option value="">All Status</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={filters.carrier_id} onChange={(e) => setFilters({ ...filters, carrier_id: e.target.value })} className={inputCls}>
          <option value="">All Carriers</option>
          {carriersQuery.data?.items?.map((c: CrmCarrier) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <Card>
        {listQuery.isLoading ? (
          <TableSkeleton rows={8} cols={8} />
        ) : listQuery.isError ? (
          <ErrorState message="Could not load assignments" onRetry={() => listQuery.refetch()} />
        ) : !listQuery.data?.items?.length ? (
          <EmptyState title="No assignments" message="No shipments match these filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[#f0f0f4] text-left text-[10px] font-bold uppercase tracking-wide text-[#a0a0ac]">
                  <th className="pb-2 pr-4">Shipment</th>
                  <th className="pb-2 pr-4">Route</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Agent</th>
                  <th className="pb-2 pr-4">Vendor</th>
                  <th className="pb-2 pr-4">Last Update</th>
                  <th className="pb-2 pr-4 text-center">!</th>
                  <th className="pb-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {listQuery.data.items.map((row: AssignmentManagerRow) => {
                  const stale = row.minutes_since_update > 30;
                  return (
                    <tr key={row.shipment_id} className="border-b border-[#f5f5f8] hover:bg-[#fafafd]">
                      <td className="py-3 pr-4">
                        <Link href={`/shipments/${row.shipment_id}`} className="font-semibold text-[#5185d8] hover:underline">
                          {row.shipment_ref}
                        </Link>
                      </td>
                      <td className="py-3 pr-4 text-[#777884]">{row.origin} → {row.destination}</td>
                      <td className="py-3 pr-4"><StatusBadge status={row.status} /></td>
                      <td className="py-3 pr-4">
                        {row.agent_name ? (
                          <div>
                            <p className="font-semibold text-[#393945]">{row.agent_name}</p>
                            {row.agent_phone && (
                              <a href={`tel:${row.agent_phone}`} className="text-[10px] text-[#5185d8] hover:underline">{row.agent_phone}</a>
                            )}
                          </div>
                        ) : <span className="text-[#a0a0ac]">—</span>}
                      </td>
                      <td className="py-3 pr-4 text-[#777884]">{row.carrier_name || '—'}</td>
                      <td className={`py-3 pr-4 ${stale ? 'text-[#d45166] font-semibold' : 'text-[#9899a5]'}`}>
                        {timeAgo(row.last_update)}
                      </td>
                      <td className="py-3 pr-4 text-center">
                        {row.escalation_count > 0 && (
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#d45166] text-[10px] font-bold text-white">
                            {row.escalation_count}
                          </span>
                        )}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setStatusModal(row)}
                            className="rounded-lg bg-[#edf5ff] p-1.5 text-[#5185d8] hover:bg-[#e0edff]"
                            title="Update Status"
                          >
                            <ArrowRight size={14} />
                          </button>
                          <button
                            onClick={() => setVendorModal(row)}
                            className="rounded-lg bg-[#f0effd] p-1.5 text-[#756bd1] hover:bg-[#e8e5f7]"
                            title="Change Vendor"
                          >
                            <Truck size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {statusModal && (
        <StatusUpdateModal
          row={statusModal}
          onClose={() => setStatusModal(null)}
        />
      )}
      {vendorModal && (
        <VendorModal
          row={vendorModal}
          onClose={() => setVendorModal(null)}
        />
      )}
    </AppShell>
  );
}

function StatChip({ label, value, danger, warn }: { label: string; value: number | string; danger?: boolean; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-[#e9eaf0] bg-white p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#a0a0ac]">{label}</p>
      <p className={`mt-1 font-display text-[22px] font-semibold ${danger ? 'text-[#d45166]' : warn ? 'text-[#b77912]' : 'text-[#393945]'}`}>
        {value}
      </p>
    </div>
  );
}

function StatusUpdateModal({ row, onClose }: { row: AssignmentManagerRow; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState(row.status);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');

  const mutation = useMutation({
    mutationFn: () => assignmentManagerApi.updateStatus(row.shipment_id, status, reason, note || undefined),
    onSuccess: () => {
      toast.success(`Status updated to ${status.replace(/_/g, ' ')}`);
      queryClient.invalidateQueries({ queryKey: ['assignment-manager'] });
      onClose();
    },
    onError: (err) => toast.error(toApiError(err as any).message),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Update Status · ${row.shipment_ref}`}
      footer={
        <>
          <button onClick={onClose} className="rounded-lg border border-[#e9e9ef] px-4 py-2 text-[12px] font-medium text-[#777884] hover:bg-[#f7f7fa]">Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={reason.trim().length < 10 || mutation.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-[#7068cf] px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
          >
            {mutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />}
            Update
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as ShipmentStatus)} className={`${inputCls} w-full`}>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">Reason (min 10 chars) *</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} className={`${inputCls} w-full`} placeholder="Why is the status changing?" />
        </div>
        <div>
          <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">Note (optional)</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={`${inputCls} w-full`} />
        </div>
      </div>
    </Modal>
  );
}

function VendorModal({ row, onClose }: { row: AssignmentManagerRow; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [carrierId, setCarrierId] = useState('');
  const [note, setNote] = useState('');

  const carriersQuery = useQuery({
    queryKey: queryKeys.crmCarriers({ transport_mode: row.transport_mode }),
    queryFn: () => crmApi.listCarriers({ transport_mode: row.transport_mode }),
  });

  const mutation = useMutation({
    mutationFn: () => assignmentManagerApi.changeVendor(row.shipment_id, carrierId, note || undefined),
    onSuccess: () => {
      toast.success('Vendor updated');
      queryClient.invalidateQueries({ queryKey: ['assignment-manager'] });
      onClose();
    },
    onError: (err) => toast.error(toApiError(err as any).message),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Change Vendor · ${row.shipment_ref}`}
      footer={
        <>
          <button onClick={onClose} className="rounded-lg border border-[#e9e9ef] px-4 py-2 text-[12px] font-medium text-[#777884] hover:bg-[#f7f7fa]">Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!carrierId || mutation.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-[#7068cf] px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
          >
            {mutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Truck size={13} />}
            Update Vendor
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">Carrier</label>
          <select value={carrierId} onChange={(e) => setCarrierId(e.target.value)} className={`${inputCls} w-full`}>
            <option value="">Select carrier…</option>
            {carriersQuery.data?.items?.map((c: CrmCarrier) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">Note</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={`${inputCls} w-full`} />
        </div>
      </div>
    </Modal>
  );
}
