'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  FileCheck2, Truck, FileText, Milestone, CircleHelp,
  Receipt, Check, X, Clock3, Bot, Loader2, Edit3, AlertCircle,
} from 'lucide-react';
import { approvalsApi, approvalExtensionsApi, assignmentsApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { formatINR } from '@/lib/format';
import { timeAgo } from '@/lib/date';
import { useAuthStore } from '@/lib/auth-store';
import { toApiError } from '@/lib/api-client';
import { AppShell } from '@/components/shell/app-shell';
import { Card } from '@/components/shell/card';
import { SectionTitle } from '@/components/shell/card';
import { Modal } from '@/components/shell/modal';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/shell/states';
import type { ApprovalQueueItem, ApprovalActionType, AvailableAgent } from '@/lib/types';

const FILTERS: { label: string; value: ApprovalActionType | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Quote', value: 'quote' },
  { label: 'Assignment', value: 'assignment' },
  { label: 'Document', value: 'document' },
  { label: 'Milestone', value: 'milestone' },
  { label: 'Exception', value: 'exception' },
  { label: 'Invoice', value: 'invoice' },
];

const SORTS = [
  { label: 'Priority', value: 'priority' },
  { label: 'Oldest first', value: 'oldest' },
  { label: 'Expiring soonest', value: 'expiring' },
];

const ACTION_ICONS: Record<string, typeof FileCheck2> = {
  quote: FileCheck2,
  assignment: Truck,
  document: FileText,
  milestone: Milestone,
  exception: CircleHelp,
  invoice: Receipt,
};

function formatPreparedData(item: ApprovalQueueItem): string {
  const d = item.prepared_data;
  if (!d) return '';
  if (item.action_type === 'quote') {
    const amount = d.amount_paise ? formatINR(d.amount_paise as number) : '—';
    const recipient = d.recipient_email || d.carrier_name || '';
    return `${amount}${recipient ? ` · ${recipient}` : ''}`;
  }
  if (item.action_type === 'assignment') {
    const agent = d.agent_name || '';
    const dist = d.distance_km ? `${d.distance_km} km` : '';
    const score = d.score ? `score ${d.score}` : '';
    return [agent, dist, score].filter(Boolean).join(' · ') || '';
  }
  if (item.action_type === 'document') {
    return `${d.document_type || ''}${d.shipment_ref ? ` · ${d.shipment_ref}` : ''}`;
  }
  return '';
}

function getCountdown(expiresAt?: string): { text: string; urgent: boolean } {
  if (!expiresAt) return { text: '', urgent: false };
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return { text: 'Expired', urgent: true };
  const mins = Math.floor(ms / 60000);
  if (mins < 60) {
    return { text: `${mins} min left`, urgent: mins < 15 };
  }
  const hrs = Math.floor(mins / 60);
  return { text: `${hrs}h ${mins % 60}m left`, urgent: false };
}

export default function ApprovalsPage() {
  const [filter, setFilter] = useState<ApprovalActionType | 'all'>('all');
  const [sort, setSort] = useState('priority');
  const [rejectItem, setRejectItem] = useState<ApprovalQueueItem | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [modifyItem, setModifyItem] = useState<ApprovalQueueItem | null>(null);
  const [modifyNote, setModifyNote] = useState('');
  const [modifyAmount, setModifyAmount] = useState('');
  const [modifyRecipient, setModifyRecipient] = useState('');
  const [modifyAgent, setModifyAgent] = useState('');
  const { canApprove } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: items, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.approvals('pending'),
    queryFn: () => approvalsApi.list('pending', 50),
  });

  const { data: summary } = useQuery({
    queryKey: queryKeys.approvalSummary,
    queryFn: () => approvalExtensionsApi.summary(),
  });

  const { data: availableAgents } = useQuery({
    queryKey: queryKeys.agentsAvailable,
    queryFn: () => assignmentsApi.agentsAvailable(),
    enabled: !!modifyItem && modifyItem.action_type === 'assignment',
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => approvalsApi.approve(id, note),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.approvals('pending') });
      const prev = queryClient.getQueryData<ApprovalQueueItem[]>(queryKeys.approvals('pending'));
      queryClient.setQueryData<ApprovalQueueItem[]>(queryKeys.approvals('pending'), (old: ApprovalQueueItem[] | undefined) => (old || []).filter((i) => i.id !== id));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKeys.approvals('pending'), ctx.prev);
      toast.error('Failed to approve. Please try again.');
    },
    onSuccess: () => {
      toast.success('Approved');
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => approvalsApi.reject(id, note),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.approvals('pending') });
      const prev = queryClient.getQueryData<ApprovalQueueItem[]>(queryKeys.approvals('pending'));
      queryClient.setQueryData<ApprovalQueueItem[]>(queryKeys.approvals('pending'), (old: ApprovalQueueItem[] | undefined) => (old || []).filter((i) => i.id !== id));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKeys.approvals('pending'), ctx.prev);
      toast.error('Failed to reject. Please try again.');
    },
    onSuccess: () => {
      toast.success('Rejected');
      setRejectItem(null);
      setRejectNote('');
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
    },
  });

  const modifyMutation = useMutation({
    mutationFn: ({ id, modifications, note }: { id: string; modifications: Record<string, unknown>; note: string }) =>
      approvalExtensionsApi.modify(id, modifications, note),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.approvals('pending') });
      const prev = queryClient.getQueryData<ApprovalQueueItem[]>(queryKeys.approvals('pending'));
      queryClient.setQueryData<ApprovalQueueItem[]>(queryKeys.approvals('pending'), (old: ApprovalQueueItem[] | undefined) => (old || []).filter((i) => i.id !== id));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKeys.approvals('pending'), ctx.prev);
      toast.error('Failed to modify. Please try again.');
    },
    onSuccess: () => {
      toast.success('Approved with modifications');
      setModifyItem(null);
      setModifyNote('');
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
    },
  });

  function handleModify() {
    if (!modifyItem) return;
    const modifications: Record<string, unknown> = {};
    if (modifyItem.action_type === 'quote') {
      if (modifyAmount) modifications.amount_paise = Math.round(parseFloat(modifyAmount) * 100);
      if (modifyRecipient) modifications.recipient_email = modifyRecipient;
    }
    if (modifyItem.action_type === 'assignment') {
      if (modifyAgent) modifications.agent_id = modifyAgent;
    }
    modifyMutation.mutate({ id: modifyItem.id, modifications, note: modifyNote });
  }

  const filtered = useMemo(() => {
    let list: ApprovalQueueItem[] = items || [];
    if (filter !== 'all') list = list.filter((i) => i.action_type === filter);
    if (sort === 'oldest') {
      list = [...list].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else if (sort === 'expiring') {
      list = [...list].sort((a, b) => {
        const ae = a.expires_at ? new Date(a.expires_at).getTime() : Infinity;
        const be = b.expires_at ? new Date(b.expires_at).getTime() : Infinity;
        return ae - be;
      });
    }
    return list;
  }, [items, filter, sort]);

  return (
    <AppShell>
      <SectionTitle>Approvals inbox</SectionTitle>

      {summary && (summary.pending_count > 0 || summary.urgent_count > 0) && (
        <div className="mb-5 flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-[#e9eaf0] bg-white px-4 py-2.5">
            <Clock3 size={15} className="text-[#756bd1]" />
            <span className="text-[11px] font-semibold text-[#393945]">{summary.pending_count} pending</span>
          </div>
          {summary.urgent_count > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-[#f6d4da] bg-[#fff0f2] px-4 py-2.5">
              <AlertCircle size={15} className="text-[#d45166]" />
              <span className="text-[11px] font-semibold text-[#d45166]">{summary.urgent_count} expiring soon</span>
            </div>
          )}
          {summary.by_type && Object.entries(summary.by_type).map(([type, count]) => (
            <div key={type} className="flex items-center gap-2 rounded-xl border border-[#e9eaf0] bg-white px-4 py-2.5">
              <span className="text-[11px] font-semibold capitalize text-[#777884]">{type.replace('_', ' ')}</span>
              <span className="text-[11px] font-bold text-[#393945]">{count as number}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
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
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded-lg border border-[#e9e9ef] bg-white px-3 py-2 text-[11px] font-medium text-[#777884] outline-none"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : isError ? (
        <Card><ErrorState message="Could not load approval queue" onRetry={() => refetch()} /></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            title="No pending approvals"
            message="When the AI needs your sign-off, requests will appear here in real time."
          />
        </Card>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {filtered.map((item) => {
            const Icon = ACTION_ICONS[item.action_type] || FileCheck2;
            const countdown = getCountdown(item.expires_at);
            const prepared = formatPreparedData(item);
            return (
              <Card key={item.id}>
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f0effd] text-[#756bd1]">
                      <Icon size={16} />
                    </span>
                    <div>
                      <span className="inline-flex rounded-md bg-[#f1f0fd] px-2 py-0.5 text-[10px] font-bold capitalize text-[#736bd0]">
                        {item.action_type.replace('_', ' ')}
                      </span>
                      {item.shipment_ref && (
                        <p className="mt-1 text-[11px] text-[#9899a5]">{item.shipment_ref}</p>
                      )}
                    </div>
                  </div>
                  <span className={`text-[10px] font-semibold ${countdown.urgent ? 'text-[#d45166]' : 'text-[#a0a0ad]'}`}>
                    {countdown.text || timeAgo(item.created_at)}
                  </span>
                </div>

                <p className="mb-2 text-[13px] font-semibold text-[#393945]">{item.summary}</p>

                {prepared && (
                  <p className="mb-2 rounded-lg bg-[#f7f6fc] px-3 py-2 text-[12px] text-[#555566]">{prepared}</p>
                )}

                {item.ai_recommendation && (
                  <div className="mb-3 flex items-start gap-2 rounded-lg border border-[#ebeaf7] bg-[#fafaff] px-3 py-2">
                    <Bot size={14} className="mt-0.5 shrink-0 text-[#756bd0]" />
                    <p className="text-[11px] leading-[1.5] text-[#898a9b]">{item.ai_recommendation}</p>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => approveMutation.mutate({ id: item.id })}
                    disabled={!canApprove() || approveMutation.isPending}
                    className="flex items-center gap-1.5 rounded-lg bg-[#eaf9f2] px-3 py-2 text-[11px] font-semibold text-[#13945a] transition hover:bg-[#dcf3e8] disabled:opacity-50"
                  >
                    {approveMutation.isPending && approveMutation.variables?.id === item.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Check size={13} />
                    )}
                    Approve
                  </button>
                  <button
                    onClick={() => { setRejectItem(item); setRejectNote(''); }}
                    disabled={!canApprove() || rejectMutation.isPending}
                    className="flex items-center gap-1.5 rounded-lg bg-[#fff0f2] px-3 py-2 text-[11px] font-semibold text-[#d45166] transition hover:bg-[#fde0e4] disabled:opacity-50"
                  >
                    <X size={13} />
                    Reject
                  </button>
                  {canApprove() && (item.action_type === 'quote' || item.action_type === 'assignment') && (
                    <button
                      onClick={() => {
                        setModifyItem(item);
                        setModifyNote('');
                        setModifyAmount('');
                        setModifyRecipient('');
                        setModifyAgent('');
                      }}
                      disabled={modifyMutation.isPending}
                      className="flex items-center gap-1.5 rounded-lg bg-[#f0effd] px-3 py-2 text-[11px] font-semibold text-[#756bd1] transition hover:bg-[#e8e5f7] disabled:opacity-50"
                    >
                      <Edit3 size={13} />
                      Modify
                    </button>
                  )}
                  {!canApprove() && (
                    <span className="ml-auto text-[10px] text-[#a0a0ad]">View only</span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={!!rejectItem}
        onClose={() => setRejectItem(null)}
        title="Reject approval"
        footer={
          <>
            <button onClick={() => setRejectItem(null)} className="rounded-lg border border-[#e9e9ef] px-4 py-2 text-[12px] font-medium text-[#777884] hover:bg-[#f7f7fa]">
              Cancel
            </button>
            <button
              onClick={() => rejectItem && rejectMutation.mutate({ id: rejectItem.id, note: rejectNote })}
              disabled={!rejectNote.trim() || rejectMutation.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-[#d45166] px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
            >
              {rejectMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
              Confirm rejection
            </button>
          </>
        }
      >
        <p className="mb-3 text-[12px] text-[#777884]">{rejectItem?.summary}</p>
        <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">Rejection note (required)</label>
        <textarea
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
          rows={3}
          placeholder="Explain why this is being rejected…"
          className="w-full rounded-xl border border-[#e9e9ef] bg-white px-3.5 py-2.5 text-[13px] outline-none focus:border-[#746ad1] focus:ring-2 focus:ring-[#e8e5f7]"
        />
      </Modal>

      <Modal
        open={!!modifyItem}
        onClose={() => setModifyItem(null)}
        title="Modify & approve"
        footer={
          <>
            <button onClick={() => setModifyItem(null)} className="rounded-lg border border-[#e9e9ef] px-4 py-2 text-[12px] font-medium text-[#777884] hover:bg-[#f7f7fa]">
              Cancel
            </button>
            <button
              onClick={handleModify}
              disabled={!modifyNote.trim() || modifyMutation.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-[#7068cf] px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
            >
              {modifyMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Edit3 size={13} />}
              Approve with changes
            </button>
          </>
        }
      >
        <p className="mb-3 text-[12px] text-[#777884]">{modifyItem?.summary}</p>

        {modifyItem?.action_type === 'quote' && (
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">Amount (₹)</label>
              <input
                type="number"
                value={modifyAmount}
                onChange={(e) => setModifyAmount(e.target.value)}
                placeholder={modifyItem.prepared_data?.amount_paise ? String(Number(modifyItem.prepared_data.amount_paise) / 100) : ''}
                className="w-full rounded-xl border border-[#e9e9ef] bg-white px-3.5 py-2.5 text-[13px] outline-none focus:border-[#746ad1] focus:ring-2 focus:ring-[#e8e5f7]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">Recipient email</label>
              <input
                type="email"
                value={modifyRecipient}
                onChange={(e) => setModifyRecipient(e.target.value)}
                placeholder={modifyItem.prepared_data?.recipient_email as string || ''}
                className="w-full rounded-xl border border-[#e9e9ef] bg-white px-3.5 py-2.5 text-[13px] outline-none focus:border-[#746ad1] focus:ring-2 focus:ring-[#e8e5f7]"
              />
            </div>
          </div>
        )}

        {modifyItem?.action_type === 'assignment' && (
          <div className="mb-3">
            <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">Reassign to agent</label>
            <select
              value={modifyAgent}
              onChange={(e) => setModifyAgent(e.target.value)}
              className="w-full rounded-xl border border-[#e9e9ef] bg-white px-3.5 py-2.5 text-[13px] outline-none focus:border-[#746ad1] focus:ring-2 focus:ring-[#e8e5f7]"
            >
              <option value="">Keep current assignment</option>
              {availableAgents?.map((a: AvailableAgent) => (
                <option key={a.id} value={a.id}>{a.name} · {a.distance_km}km · score {a.score}</option>
              ))}
            </select>
          </div>
        )}

        <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">Modification note (required)</label>
        <textarea
          value={modifyNote}
          onChange={(e) => setModifyNote(e.target.value)}
          rows={3}
          placeholder="Explain what you changed and why…"
          className="w-full rounded-xl border border-[#e9e9ef] bg-white px-3.5 py-2.5 text-[13px] outline-none focus:border-[#746ad1] focus:ring-2 focus:ring-[#e8e5f7]"
        />
      </Modal>
    </AppShell>
  );
}
