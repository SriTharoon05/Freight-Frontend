'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, X, Loader2 } from 'lucide-react';
import { ratesApi, vendorQuotesApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { AppShell } from '@/components/shell/app-shell';
import { Card, SectionTitle } from '@/components/shell/card';
import { TableSkeleton, EmptyState, ErrorState } from '@/components/shell/states';
import { Modal } from '@/components/shell/modal';
import { formatINR } from '@/lib/format';
import { formatISTDate } from '@/lib/date';
import { useAuthStore } from '@/lib/auth-store';
import { toApiError } from '@/lib/api-client';
import type { RateCard } from '@/lib/types';

export default function RatesPage() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuthStore();
  const [modeFilter, setModeFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<RateCard | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: rates, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.rateCards({ mode: modeFilter, active: !showInactive }),
    queryFn: () => ratesApi.list({ mode: modeFilter || undefined, active: !showInactive }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ratesApi.delete(id),
    onSuccess: () => {
      toast.success('Rate card deleted');
      queryClient.invalidateQueries({ queryKey: ['rate-cards'] });
    },
    onError: () => toast.error('Failed to delete rate card'),
  });

  const canEdit = hasRole('ops_manager', 'org_admin');

  return (
    <AppShell>
      <SectionTitle
        action={
          canEdit && (
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-2 rounded-xl bg-[#7068cf] px-3.5 py-2.5 text-[11px] font-semibold text-white shadow-[0_6px_14px_rgba(112,104,207,0.2)]"
            >
              <Plus size={14} />Add rate card
            </button>
          )
        }
      >
        Rate cards
      </SectionTitle>

      <Card className="mb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)} className="rounded-lg border border-[#ededf2] bg-white px-3 py-2 text-[12px] font-medium text-[#686975] outline-none">
            <option value="">All modes</option>
            <option value="ocean">Ocean</option>
            <option value="air">Air</option>
            <option value="road">Road</option>
            <option value="rail">Rail</option>
          </select>
          <label className="flex items-center gap-2 text-[12px] font-medium text-[#777884]">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded" />
            Show inactive
          </label>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : isError ? (
          <ErrorState message="Could not load rate cards" onRetry={() => refetch()} />
        ) : rates && rates.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#f0f0f4] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a2a2ad]">
                  <th className="pb-3">Carrier</th>
                  <th className="pb-3">Route</th>
                  <th className="pb-3">Mode</th>
                  <th className="pb-3">Base rate</th>
                  <th className="pb-3">Markup</th>
                  <th className="pb-3">Validity</th>
                  <th className="pb-3">Lane Volatile</th>
                  {canEdit && <th className="pb-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {rates.map((r: RateCard) => (
                  <tr key={r.id} className="border-b border-[#f4f4f7] last:border-0">
                    <td className="py-3 text-[12px] font-semibold text-[#393945]">{r.carrier_name || '—'}</td>
                    <td className="py-3 text-[11px] text-[#777884]">{r.origin} → {r.destination}</td>
                    <td className="py-3 text-[11px] capitalize text-[#777884]">{r.mode}</td>
                    <td className="py-3 text-[12px] font-semibold text-[#393945]">{formatINR(r.base_rate_paise)}</td>
                    <td className="py-3 text-[11px] text-[#777884]">{r.markup_percent}%</td>
                    <td className="py-3 text-[11px] text-[#9899a5]">
                      {formatISTDate(r.valid_from)}
                      {r.valid_until ? ` → ${formatISTDate(r.valid_until)}` : ''}
                    </td>
                    <td className="py-3">
                      {canEdit ? (
                        <VolatilityToggle rateCardId={r.id} initial={r.lane_volatile || false} />
                      ) : r.lane_volatile ? (
                        <span className="inline-flex rounded-full bg-[#fff7e7] px-2.5 py-1 text-[10px] font-semibold text-[#b77912]">Volatile</span>
                      ) : (
                        <span className="inline-flex rounded-full bg-[#eaf9f2] px-2.5 py-1 text-[10px] font-semibold text-[#13945a]">Rate Card</span>
                      )}
                    </td>
                    {canEdit && (
                      <td className="py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => setEditing(r)} className="rounded-lg border border-[#e9e9ef] p-1.5 text-[#777884] hover:bg-[#f7f7fa]">
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => { if (confirm('Delete this rate card?')) deleteMutation.mutate(r.id); }}
                            className="rounded-lg border border-[#e9e9ef] p-1.5 text-[#d45166] hover:bg-[#fff0f2]"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No rate cards" message="Rate cards will appear here once you add them." />
        )}
      </Card>

      {(creating || editing) && (
        <RateCardModal
          rateCard={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            queryClient.invalidateQueries({ queryKey: ['rate-cards'] });
          }}
        />
      )}
    </AppShell>
  );
}

function RateCardModal({ rateCard, onClose, onSaved }: { rateCard: RateCard | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    carrier_name: rateCard?.carrier_name || '',
    origin: rateCard?.origin || '',
    destination: rateCard?.destination || '',
    mode: rateCard?.mode || 'ocean',
    base_rate_paise: rateCard?.base_rate_paise ? String(rateCard.base_rate_paise / 100) : '',
    markup_percent: rateCard?.markup_percent ? String(rateCard.markup_percent) : '',
    valid_from: rateCard?.valid_from ? rateCard.valid_from.split('T')[0] : new Date().toISOString().split('T')[0],
    valid_until: rateCard?.valid_until ? rateCard.valid_until.split('T')[0] : '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {
        carrier_name: form.carrier_name,
        origin: form.origin,
        destination: form.destination,
        mode: form.mode,
        base_rate_paise: Math.round(parseFloat(form.base_rate_paise) * 100),
        markup_percent: parseFloat(form.markup_percent) || 0,
        valid_from: form.valid_from,
        valid_until: form.valid_until || null,
        active: true,
      };
      if (rateCard) {
        await ratesApi.update(rateCard.id, body);
        toast.success('Rate card updated');
      } else {
        await ratesApi.create(body);
        toast.success('Rate card created');
      }
      onSaved();
    } catch (err) {
      const e = toApiError(err as any);
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full rounded-xl border border-[#e9e9ef] bg-white px-3.5 py-2.5 text-[13px] outline-none focus:border-[#746ad1] focus:ring-2 focus:ring-[#e8e5f7]';

  return (
    <Modal
      open
      onClose={onClose}
      title={rateCard ? 'Edit rate card' : 'New rate card'}
      width="max-w-lg"
      footer={
        <>
          <button onClick={onClose} className="rounded-lg border border-[#e9e9ef] px-4 py-2 text-[12px] font-medium text-[#777884]">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-[#7068cf] px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50">
            {saving && <Loader2 size={13} className="animate-spin" />}
            {rateCard ? 'Save changes' : 'Create'}
          </button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-[12px] font-semibold text-[#393945]">Carrier name</label>
          <input value={form.carrier_name} onChange={(e) => setForm({ ...form, carrier_name: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-semibold text-[#393945]">Origin</label>
          <input value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-semibold text-[#393945]">Destination</label>
          <input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-semibold text-[#393945]">Mode</label>
          <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value as any })} className={inputCls}>
            <option value="ocean">Ocean</option>
            <option value="air">Air</option>
            <option value="road">Road</option>
            <option value="rail">Rail</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-semibold text-[#393945]">Markup %</label>
          <input type="number" value={form.markup_percent} onChange={(e) => setForm({ ...form, markup_percent: e.target.value })} className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-[12px] font-semibold text-[#393945]">Base rate (₹)</label>
          <input type="number" value={form.base_rate_paise} onChange={(e) => setForm({ ...form, base_rate_paise: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-semibold text-[#393945]">Valid from</label>
          <input type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-semibold text-[#393945]">Valid until</label>
          <input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} className={inputCls} />
        </div>
      </div>
    </Modal>
  );
}

function VolatilityToggle({ rateCardId, initial }: { rateCardId: string; initial: boolean }) {
  const queryClient = useQueryClient();
  const [volatile, setVolatile] = useState(initial);

  const mutation = useMutation({
    mutationFn: (lane_volatile: boolean) => vendorQuotesApi.setVolatility(rateCardId, lane_volatile),
    onMutate: (lane_volatile) => {
      setVolatile(lane_volatile);
      return { prev: initial };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev !== undefined) setVolatile(ctx.prev);
      toast.error('Failed to update volatility');
    },
    onSuccess: () => {
      toast.success(volatile ? 'Lane marked volatile — custom quotes required' : 'Rate card enabled for lane');
      queryClient.invalidateQueries({ queryKey: ['rate-cards'] });
    },
  });

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => mutation.mutate(!volatile)}
        disabled={mutation.isPending}
        className={`relative h-5 w-9 rounded-full transition ${volatile ? 'bg-[#b77912]' : 'bg-[#13945a]'}`}
        title="When volatile, this lane disables the rate card and requires vendor quotes per shipment"
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${volatile ? 'left-4' : 'left-0.5'}`} />
      </button>
      <span className={`text-[10px] font-semibold ${volatile ? 'text-[#b77912]' : 'text-[#13945a]'}`}>
        {volatile ? 'Volatile' : 'Rate Card'}
      </span>
    </div>
  );
}
