'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { ratesApi, vendorQuotesApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { AppShell } from '@/components/shell/app-shell';
import { Card, SectionTitle } from '@/components/shell/card';
import { TableSkeleton, EmptyState, ErrorState } from '@/components/shell/states';
import { Modal } from '@/components/shell/modal';
import { formatISTDate } from '@/lib/date';
import { formatRateUnitLabel, moneyLabel } from '@/lib/freight';
import { useAuthStore } from '@/lib/auth-store';
import { toApiError } from '@/lib/api-client';
import type { RateCard, RateUnit } from '@/lib/types';
import { EmailRateCards } from '@/components/freight/email-rate-cards';

const RATE_UNIT_OPTIONS: { value: RateUnit; label: string }[] = [
  { value: 'per_kg', label: 'Per kg (Chargeable Weight)' },
  { value: 'per_lb', label: 'Per lb (Imperial Weight)' },
  { value: 'per_m3', label: 'Per m³ / CBM (Volume)' },
  { value: 'per_shipment', label: 'Per shipment (Flat)' },
  { value: 'per_container', label: 'Per container (FCL)' },
];

const CURRENCY_OPTIONS = ['USD', 'INR', 'EUR', 'GBP', 'AED', 'SGD'];

function resolveRateDisplay(r: RateCard) {
  const currency = r.currency_code || 'INR';
  const unit = r.rate_unit || (r.per_kg_rate_paise ? 'per_kg' : r.per_cbm_rate_paise ? 'per_m3' : 'per_shipment');
  const unitPaise =
    r.unit_rate_paise !== undefined && r.unit_rate_paise !== null
      ? r.unit_rate_paise
      : unit === 'per_kg'
        ? Number(r.per_kg_rate_paise || 0)
        : unit === 'per_lb'
          ? Number(r.per_lb_rate_paise || 0)
          : unit === 'per_m3' || unit === 'per_cbm'
            ? Number(r.per_cbm_rate_paise || 0)
            : Number(r.base_rate_paise || 0);
  const main = `${moneyLabel(unitPaise / 100, currency)} ${formatRateUnitLabel(unit)}`;
  const hasSeparateBase =
    !['per_shipment', 'per_container'].includes(unit) && Number(r.base_rate_paise || 0) > 0;
  return { main, base: hasSeparateBase ? `Base ${moneyLabel(r.base_rate_paise / 100, currency)}` : '' };
}

export default function RatesPage() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuthStore();
  const [modeFilter, setModeFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<RateCard | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: rates, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.rateCards({ mode: modeFilter, active: showInactive ? undefined : true }),
    queryFn: () => ratesApi.list({ mode: modeFilter || undefined, active: showInactive ? undefined : true }),
  });
  const filteredRates = (rates || []).filter((r: RateCard & { transport_mode?: string; is_active?: boolean }) => {
    const m = (r.mode || r.transport_mode || '').toLowerCase();
    if (modeFilter && (modeFilter === 'ocean' ? !['ocean', 'sea'].includes(m) : m !== modeFilter)) return false;
    if (!showInactive && r.is_active === false && r.active === false) return false;
    return true;
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ratesApi.delete(id),
    onSuccess: () => {
      toast.success('Rate card deleted');
      queryClient.invalidateQueries({ queryKey: ['rate-cards'] });
    },
    onError: () => toast.error('Failed to delete rate card'),
  });

  const canEdit = hasRole('ops_manager', 'org_admin', 'admin');

  return (
    <AppShell>
      <div className="mb-5"><EmailRateCards /></div>
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
          <select aria-label="Transport mode" value={modeFilter} onChange={(e) => setModeFilter(e.target.value)} className="rounded-lg border border-[#ededf2] bg-white px-3 py-2 text-[12px] font-medium text-[#686975] outline-none">
            <option value="">All modes</option>
            <option value="ocean">Ocean</option>
            <option value="air">Air</option>
            <option value="road">Road</option>
            <option value="rail">Rail</option>
            <option value="multimodal">Multimodal</option>
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
        ) : filteredRates.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#f0f0f4] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a2a2ad]">
                  <th className="pb-3">Carrier</th>
                  <th className="pb-3">Route</th>
                  <th className="pb-3">Mode</th>
                  <th className="pb-3">Rate / Unit</th>
                  <th className="pb-3">Markup</th>
                  <th className="pb-3">Validity</th>
                  <th className="pb-3">Lane Volatile</th>
                  {canEdit && <th className="pb-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredRates.map((r: RateCard) => {
                  const rateDisplay = resolveRateDisplay(r);
                  return (
                  <tr key={r.id} className="border-b border-[#f4f4f7] last:border-0">
                    <td className="py-3 text-[12px] font-semibold text-[#393945]">{r.carrier_name || '—'}</td>
                    <td className="py-3 text-[11px] text-[#777884]">
                      {r.origin} → {r.destination}
                      {r.origin_country_code && r.dest_country_code && (r.origin !== r.origin_country_code || r.destination !== r.dest_country_code) ? (
                        <span className="ml-1.5 rounded bg-[#f4f4f7] px-1.5 py-0.5 text-[10px] font-mono text-[#686975]">
                          {r.origin_country_code}→{r.dest_country_code}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 text-[11px] capitalize text-[#777884]">{r.mode === 'sea' as any ? 'ocean' : r.mode}</td>
                    <td className="py-3 text-[12px] font-semibold text-[#393945]">
                      <div>{rateDisplay.main}</div>
                      {rateDisplay.base && <div className="text-[10px] font-normal text-[#777884]">{rateDisplay.base}</div>}
                    </td>
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
                          <button onClick={() => setEditing(r)} aria-label="Edit rate card" className="rounded-lg border border-[#e9e9ef] p-1.5 text-[#777884] hover:bg-[#f7f7fa]">
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => { if (confirm('Delete this rate card?')) deleteMutation.mutate(r.id); }}
                            aria-label="Delete rate card"
                            className="rounded-lg border border-[#e9e9ef] p-1.5 text-[#d45166] hover:bg-[#fff0f2]"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                  );
                })}
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
  const initialUnit: RateUnit =
    rateCard?.rate_unit ||
    (rateCard?.per_kg_rate_paise
      ? 'per_kg'
      : rateCard?.per_cbm_rate_paise
        ? 'per_m3'
        : 'per_shipment');
  const initialUnitRate =
    rateCard?.unit_rate_paise !== undefined && rateCard?.unit_rate_paise !== null
      ? String(rateCard.unit_rate_paise / 100)
      : initialUnit === 'per_kg' && rateCard?.per_kg_rate_paise
        ? String(rateCard.per_kg_rate_paise / 100)
        : initialUnit === 'per_m3' && rateCard?.per_cbm_rate_paise
          ? String(rateCard.per_cbm_rate_paise / 100)
          : rateCard?.base_rate_paise
            ? String(rateCard.base_rate_paise / 100)
            : '';

  const [form, setForm] = useState({
    carrier_name: rateCard?.carrier_name || '',
    origin: rateCard?.origin || rateCard?.origin_country_code || '',
    destination: rateCard?.destination || rateCard?.dest_country_code || '',
    mode: (rateCard?.mode === ('sea' as any) ? 'ocean' : rateCard?.mode) || 'ocean',
    currency_code: rateCard?.currency_code || 'USD',
    rate_unit: initialUnit,
    unit_rate: initialUnitRate,
    base_rate:
      !['per_shipment', 'per_container'].includes(initialUnit) && rateCard?.base_rate_paise
        ? String(rateCard.base_rate_paise / 100)
        : '0',
    markup_percent: rateCard?.markup_percent ? String(rateCard.markup_percent) : '15',
    valid_from: rateCard?.valid_from ? rateCard.valid_from.split('T')[0] : new Date().toISOString().split('T')[0],
    valid_until: rateCard?.valid_until ? rateCard.valid_until.split('T')[0] : '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.origin.trim() || !form.destination.trim()) {
      toast.error('Origin and destination are required');
      return;
    }
    const unitAmount = parseFloat(form.unit_rate);
    if (Number.isNaN(unitAmount) || unitAmount < 0) {
      toast.error('Enter a valid rate amount');
      return;
    }
    const baseAmount = parseFloat(form.base_rate) || 0;
    setSaving(true);
    try {
      const unitPaise = Math.round(unitAmount * 100);
      const basePaise = ['per_shipment', 'per_container'].includes(form.rate_unit)
        ? unitPaise
        : Math.round(baseAmount * 100);
      const body = {
        carrier_name: form.carrier_name,
        origin: form.origin.trim(),
        destination: form.destination.trim(),
        mode: form.mode,
        currency_code: form.currency_code,
        rate_unit: form.rate_unit,
        unit_rate_paise: unitPaise,
        base_rate_paise: basePaise,
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
          <input value={form.carrier_name} onChange={(e) => setForm({ ...form, carrier_name: e.target.value })} placeholder="e.g. Emirates SkyCargo, Maersk" className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-semibold text-[#393945]">Origin (Country code or Port, CC)</label>
          <input value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} placeholder="e.g. IN or Nhava Sheva, IN" className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-semibold text-[#393945]">Destination (Country code or Port, CC)</label>
          <input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="e.g. AE or Dubai, AE" className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-semibold text-[#393945]">Mode</label>
          <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value as any })} className={inputCls}>
            <option value="ocean">Ocean</option>
            <option value="air">Air</option>
            <option value="road">Road</option>
            <option value="rail">Rail</option>
            <option value="multimodal">Multimodal</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-semibold text-[#393945]">Currency</label>
          <select value={form.currency_code} onChange={(e) => setForm({ ...form, currency_code: e.target.value })} className={inputCls}>
            {CURRENCY_OPTIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-semibold text-[#393945]">Rate Unit</label>
          <select aria-label="Rate Unit" value={form.rate_unit} onChange={(e) => setForm({ ...form, rate_unit: e.target.value as RateUnit })} className={inputCls}>
            {RATE_UNIT_OPTIONS.map((u) => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-semibold text-[#393945]">
            Rate Amount ({form.currency_code} {formatRateUnitLabel(form.rate_unit)})
          </label>
          <input
            type="number"
            min="0"
            step="any"
            value={form.unit_rate}
            onChange={(e) => setForm({ ...form, unit_rate: e.target.value })}
            placeholder="0.00"
            className={inputCls}
          />
        </div>
        {!['per_shipment', 'per_container'].includes(form.rate_unit) && (
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-[#393945]">Base / Minimum Fee ({form.currency_code})</label>
            <input type="number" min="0" step="any" value={form.base_rate} onChange={(e) => setForm({ ...form, base_rate: e.target.value })} className={inputCls} />
          </div>
        )}
        <div>
          <label className="mb-1 block text-[12px] font-semibold text-[#393945]">Default Markup %</label>
          <input type="number" min="0" step="any" value={form.markup_percent} onChange={(e) => setForm({ ...form, markup_percent: e.target.value })} className={inputCls} />
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
