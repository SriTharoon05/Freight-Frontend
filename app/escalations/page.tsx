'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Phone, Clock, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { escalationsApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { AppShell } from '@/components/shell/app-shell';
import { Card, SectionTitle } from '@/components/shell/card';
import { TableSkeleton, ErrorState, EmptyState } from '@/components/shell/states';
import { toApiError } from '@/lib/api-client';
import { supabase } from '@/lib/supabase';
import type { Escalation, EscalationType } from '@/lib/types';

const TYPE_LABELS: Record<string, { label: string; icon: typeof Phone }> = {
  vendor_no_response: { label: 'Call Vendor', icon: Phone },
  stale_shipment: { label: 'Stale Update', icon: Clock },
  approval_timeout: { label: 'Approval Timeout', icon: AlertCircle },
};

const FILTERS = [
  { label: 'Open', value: 'open' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'All', value: '' },
] as const;

export default function EscalationsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>('open');

  const listQuery = useQuery({
    queryKey: queryKeys.escalations({ status: filter, page: 1, limit: 100 }),
    queryFn: () => escalationsApi.list({ status: filter || undefined, page: 1, limit: 100 }),
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => escalationsApi.resolve(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.escalations({ status: filter, page: 1, limit: 100 }) });
      const key = queryKeys.escalations({ status: filter, page: 1, limit: 100 });
      const prev = queryClient.getQueryData(key);
      queryClient.setQueryData(key, (old: any) => ({
        ...old,
        items: (old?.items || []).map((e: Escalation) => e.id === id ? { ...e, status: 'resolved' } : e),
      }));
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKeys.escalations({ status: filter, page: 1, limit: 100 }), ctx.prev);
      toast.error('Failed to resolve escalation');
    },
    onSuccess: () => {
      toast.success('Escalation resolved');
      queryClient.invalidateQueries({ queryKey: ['escalations'] });
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel('escalation_logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'escalation_logs' }, (payload) => {
        const newEsc = payload.new as Escalation;
        toast.info(`New escalation: ${TYPE_LABELS[newEsc.type]?.label || newEsc.type} on ${newEsc.shipment_ref || 'shipment'}`);
        queryClient.invalidateQueries({ queryKey: ['escalations'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return (
    <AppShell>
      <SectionTitle>Escalations</SectionTitle>

      <div className="mb-5 flex gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${
              filter === f.value ? 'bg-[#7068cf] text-white' : 'bg-white border border-[#e9e9ef] text-[#777884] hover:bg-[#f7f7fa]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Card>
        {listQuery.isLoading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : listQuery.isError ? (
          <ErrorState message="Could not load escalations" onRetry={() => listQuery.refetch()} />
        ) : !listQuery.data?.items?.length ? (
          <EmptyState title="No escalations" message="No escalations match this filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[#f0f0f4] text-left text-[10px] font-bold uppercase tracking-wide text-[#a0a0ac]">
                  <th className="pb-2 pr-4">Type</th>
                  <th className="pb-2 pr-4">Shipment</th>
                  <th className="pb-2 pr-4">Triggered At</th>
                  <th className="pb-2 pr-4 text-right">Min Open</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 text-right">Resolve</th>
                </tr>
              </thead>
              <tbody>
                {listQuery.data.items.map((esc: Escalation) => {
                  const typeInfo = TYPE_LABELS[esc.type] || { label: esc.type, icon: AlertCircle };
                  const Icon = typeInfo.icon;
                  const isOverdue = esc.minutes_open > 60 && esc.status === 'open';
                  return (
                    <tr key={esc.id} className="border-b border-[#f5f5f8] hover:bg-[#fafafd]">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <Icon size={14} className="text-[#b77912]" />
                          <span className="font-semibold text-[#393945]">{typeInfo.label}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <Link href={`/shipments/${esc.shipment_id}`} className="font-semibold text-[#5185d8] hover:underline">
                          {esc.shipment_ref || esc.shipment_id}
                        </Link>
                      </td>
                      <td className="py-3 pr-4 text-[#9899a5]">{new Date(esc.triggered_at).toLocaleString('en-IN')}</td>
                      <td className={`py-3 pr-4 text-right font-semibold ${isOverdue ? 'text-[#d45166]' : 'text-[#393945]'}`}>
                        {esc.minutes_open}m
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${
                          esc.status === 'open' ? 'bg-[#fff0f2] text-[#d45166]' : 'bg-[#eaf9f2] text-[#13945a]'
                        }`}>
                          {esc.status}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        {esc.status === 'open' && (
                          <button
                            onClick={() => resolveMutation.mutate(esc.id)}
                            disabled={resolveMutation.isPending}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#eaf9f2] px-2.5 py-1.5 text-[10px] font-semibold text-[#13945a] hover:bg-[#dcf3e8] disabled:opacity-50"
                          >
                            <Check size={12} /> Resolve
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AppShell>
  );
}
