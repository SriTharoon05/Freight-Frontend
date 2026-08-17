'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, ArrowUp, Loader2 } from 'lucide-react';
import { shipmentsApi, exceptionsApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { formatINR } from '@/lib/format';
import { formatIST } from '@/lib/date';
import { Card } from '@/components/shell/card';
import { SeverityBadge } from '@/components/shell/badges';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/shell/states';
import { Modal } from '@/components/shell/modal';
import { useAuthStore } from '@/lib/auth-store';
import { toApiError } from '@/lib/api-client';
import type { Exception } from '@/lib/types';

export function ExceptionsTab({ shipmentId }: { shipmentId: string }) {
  const queryClient = useQueryClient();
  const { canApprove } = useAuthStore();
  const [resolveItem, setResolveItem] = useState<Exception | null>(null);
  const [resolveNotes, setResolveNotes] = useState('');
  const [escalateItem, setEscalateItem] = useState<Exception | null>(null);
  const [escalateTo, setEscalateTo] = useState('');
  const [escalateNote, setEscalateNote] = useState('');

  const { data: exceptions, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.shipmentExceptions(shipmentId),
    queryFn: () => shipmentsApi.exceptions(shipmentId),
  });

  const ackMutation = useMutation({
    mutationFn: (id: string) => exceptionsApi.acknowledge(id),
    onSuccess: () => {
      toast.success('Exception acknowledged');
      queryClient.invalidateQueries({ queryKey: queryKeys.shipmentExceptions(shipmentId) });
      queryClient.invalidateQueries({ queryKey: ['exceptions'] });
    },
    onError: (err) => { const e = toApiError(err as any); toast.error(e.message); },
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) => exceptionsApi.resolve(id, notes),
    onSuccess: () => {
      toast.success('Exception resolved');
      setResolveItem(null); setResolveNotes('');
      queryClient.invalidateQueries({ queryKey: queryKeys.shipmentExceptions(shipmentId) });
      queryClient.invalidateQueries({ queryKey: ['exceptions'] });
    },
    onError: (err) => { const e = toApiError(err as any); toast.error(e.message); },
  });

  const escalateMutation = useMutation({
    mutationFn: ({ id, to, note }: { id: string; to: string; note: string }) => exceptionsApi.escalate(id, to, note),
    onSuccess: () => {
      toast.success('Exception escalated');
      setEscalateItem(null); setEscalateTo(''); setEscalateNote('');
      queryClient.invalidateQueries({ queryKey: queryKeys.shipmentExceptions(shipmentId) });
    },
    onError: (err) => { const e = toApiError(err as any); toast.error(e.message); },
  });

  if (isLoading) return <Card><ListSkeleton rows={3} /></Card>;
  if (isError) return <Card><ErrorState message="Could not load exceptions" onRetry={() => refetch()} /></Card>;

  return (
    <>
      <Card>
        <h3 className="mb-4 font-display text-[15px] font-semibold">Exceptions</h3>
        {exceptions && exceptions.length > 0 ? (
          <div className="space-y-3">
            {exceptions.map((ex: Exception) => (
              <div key={ex.id} className="rounded-xl border border-[#eeedf3] bg-[#fbfbfd] p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={ex.severity} />
                    <p className="text-[13px] font-semibold text-[#393945]">{ex.title}</p>
                  </div>
                  {ex.dd_exposure_paise ? (
                    <span className="text-[12px] font-semibold text-[#d45166]">{formatINR(ex.dd_exposure_paise)}</span>
                  ) : null}
                </div>
                {ex.description && <p className="mb-2 text-[12px] text-[#6f7180]">{ex.description}</p>}
                {ex.recommended_action && (
                  <p className="mb-3 rounded-lg bg-[#fffbeb] px-3 py-2 text-[11px] text-[#a07c18]">
                    Recommended: {ex.recommended_action}
                  </p>
                )}
                {ex.status === 'open' && canApprove() && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => ackMutation.mutate(ex.id)}
                      disabled={ackMutation.isPending}
                      className="rounded-lg bg-[#edf5ff] px-3 py-1.5 text-[11px] font-semibold text-[#5185d8] hover:bg-[#e0edff]"
                    >
                      Acknowledge
                    </button>
                    <button
                      onClick={() => { setResolveItem(ex); setResolveNotes(''); }}
                      className="flex items-center gap-1 rounded-lg bg-[#eaf9f2] px-3 py-1.5 text-[11px] font-semibold text-[#13945a] hover:bg-[#dcf3e8]"
                    >
                      <Check size={12} />Resolve
                    </button>
                    <button
                      onClick={() => { setEscalateItem(ex); setEscalateTo(''); setEscalateNote(''); }}
                      className="flex items-center gap-1 rounded-lg bg-[#fff7e7] px-3 py-1.5 text-[11px] font-semibold text-[#b77912] hover:bg-[#fde9bc]"
                    >
                      <ArrowUp size={12} />Escalate
                    </button>
                  </div>
                )}
                {ex.status !== 'open' && (
                  <span className="text-[11px] font-semibold capitalize text-[#9899a5]">{ex.status}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No exceptions" message="This shipment has no exceptions. Everything looks on track." />
        )}
      </Card>

      <Modal
        open={!!resolveItem}
        onClose={() => setResolveItem(null)}
        title="Resolve exception"
        footer={
          <>
            <button onClick={() => setResolveItem(null)} className="rounded-lg border border-[#e9e9ef] px-4 py-2 text-[12px] font-medium text-[#777884]">Cancel</button>
            <button
              onClick={() => resolveItem && resolveMutation.mutate({ id: resolveItem.id, notes: resolveNotes })}
              disabled={!resolveNotes.trim() || resolveMutation.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-[#13945a] px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
            >
              {resolveMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Confirm resolution
            </button>
          </>
        }
      >
        <p className="mb-3 text-[12px] text-[#777884]">{resolveItem?.title}</p>
        <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">Resolution notes (required)</label>
        <textarea
          value={resolveNotes}
          onChange={(e) => setResolveNotes(e.target.value)}
          rows={3}
          placeholder="How was this resolved?"
          className="w-full rounded-xl border border-[#e9e9ef] bg-white px-3.5 py-2.5 text-[13px] outline-none focus:border-[#746ad1] focus:ring-2 focus:ring-[#e8e5f7]"
        />
      </Modal>

      <Modal
        open={!!escalateItem}
        onClose={() => setEscalateItem(null)}
        title="Escalate exception"
        footer={
          <>
            <button onClick={() => setEscalateItem(null)} className="rounded-lg border border-[#e9e9ef] px-4 py-2 text-[12px] font-medium text-[#777884]">Cancel</button>
            <button
              onClick={() => escalateItem && escalateMutation.mutate({ id: escalateItem.id, to: escalateTo, note: escalateNote })}
              disabled={!escalateTo.trim() || !escalateNote.trim() || escalateMutation.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-[#b77912] px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
            >
              {escalateMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <ArrowUp size={13} />}
              Confirm escalation
            </button>
          </>
        }
      >
        <p className="mb-3 text-[12px] text-[#777884]">{escalateItem?.title}</p>
        <div className="mb-3">
          <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">Escalate to (user)</label>
          <input
            value={escalateTo}
            onChange={(e) => setEscalateTo(e.target.value)}
            placeholder="User ID or email"
            className="w-full rounded-xl border border-[#e9e9ef] bg-white px-3.5 py-2.5 text-[13px] outline-none focus:border-[#746ad1] focus:ring-2 focus:ring-[#e8e5f7]"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">Note</label>
          <textarea
            value={escalateNote}
            onChange={(e) => setEscalateNote(e.target.value)}
            rows={2}
            placeholder="Context for the escalation…"
            className="w-full rounded-xl border border-[#e9e9ef] bg-white px-3.5 py-2.5 text-[13px] outline-none focus:border-[#746ad1] focus:ring-2 focus:ring-[#e8e5f7]"
          />
        </div>
      </Modal>
    </>
  );
}
