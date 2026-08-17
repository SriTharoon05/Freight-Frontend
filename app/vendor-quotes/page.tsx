'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Send, Loader2, Check, AlertTriangle, Search } from 'lucide-react';
import { vendorQuotesApi, shipmentsApi, crmApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { AppShell } from '@/components/shell/app-shell';
import { Card, SectionTitle } from '@/components/shell/card';
import { Modal } from '@/components/shell/modal';
import { SlideOver } from '@/components/shell/slide-over';
import { TableSkeleton, ErrorState, EmptyState } from '@/components/shell/states';
import { formatINR } from '@/lib/format';
import { formatIST, timeAgo } from '@/lib/date';
import { toApiError } from '@/lib/api-client';
import type { QuoteRequest, LaneCheckResult, CrmCarrier, Shipment } from '@/lib/types';

const inputCls = 'rounded-lg border border-[#e9e9ef] bg-white px-3 py-2 text-[12px] font-medium text-[#393945] outline-none focus:border-[#746ad1] focus:ring-2 focus:ring-[#e8e5f7]';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-[#fff7e7] text-[#b77912]',
  responded: 'bg-[#edf5ff] text-[#5185d8]',
  expired: 'bg-slate-100 text-slate-500',
  rejected: 'bg-[#fff0f2] text-[#d45166]',
};

export default function VendorQuotesPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedQuote, setSelectedQuote] = useState<QuoteRequest | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);

  const listQuery = useQuery({
    queryKey: queryKeys.vendorQuotes({ status: statusFilter, page: 1, limit: 50 }),
    queryFn: () => vendorQuotesApi.list({ status: statusFilter || undefined, page: 1, limit: 50 }),
  });

  const detailQuery = useQuery({
    queryKey: queryKeys.vendorQuoteDetail(selectedQuote?.id || ''),
    queryFn: () => vendorQuotesApi.get(selectedQuote!.id),
    enabled: !!selectedQuote,
  });

  const selectOptionMutation = useMutation({
    mutationFn: ({ id, option_index }: { id: string; option_index: number }) =>
      vendorQuotesApi.selectOption(id, option_index),
    onSuccess: () => {
      toast.success('Option selected');
      queryClient.invalidateQueries({ queryKey: ['vendor-quotes'] });
    },
    onError: (err) => toast.error(toApiError(err as any).message),
  });

  const filtered = (listQuery.data?.items || []).filter((q: QuoteRequest) => {
    if (search && !q.shipment_ref?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <AppShell>
      <SectionTitle action={
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 rounded-lg bg-[#7068cf] px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-[#635bbf]"
        >
          <Send size={14} /> Send New Quote Request
        </button>
      }>
        Vendor Quote Requests
      </SectionTitle>

      <div className="mb-5 flex flex-wrap gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputCls}>
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="responded">Responded</option>
          <option value="expired">Expired</option>
          <option value="rejected">Rejected</option>
        </select>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a0a0ac]" />
          <input
            placeholder="Search by shipment ref…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputCls} pl-9`}
          />
        </div>
      </div>

      <Card>
        {listQuery.isLoading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : listQuery.isError ? (
          <ErrorState message="Could not load quote requests" onRetry={() => listQuery.refetch()} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No quote requests" message="Vendor quote requests will appear here." action={
            <button onClick={() => setShowNewModal(true)} className="rounded-lg bg-[#7068cf] px-4 py-2 text-[12px] font-semibold text-white">Send New Quote Request</button>
          } />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[#f0f0f4] text-left text-[10px] font-bold uppercase tracking-wide text-[#a0a0ac]">
                  <th className="pb-2 pr-4">Shipment Ref</th>
                  <th className="pb-2 pr-4">Carrier</th>
                  <th className="pb-2 pr-4">Sent At</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4 text-right">Options</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((q: QuoteRequest) => (
                  <tr
                    key={q.id}
                    onClick={() => setSelectedQuote(q)}
                    className="cursor-pointer border-b border-[#f5f5f8] hover:bg-[#fafafd]"
                  >
                    <td className="py-3 pr-4 font-semibold text-[#393945]">{q.shipment_ref || '—'}</td>
                    <td className="py-3 pr-4 text-[#777884]">{q.carrier_name || '—'}</td>
                    <td className="py-3 pr-4 text-[#9899a5]">{formatIST(q.sent_at)}</td>
                    <td className="py-3 pr-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${STATUS_STYLES[q.status] || 'bg-slate-50 text-slate-500'}`}>
                        {q.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right text-[#393945]">{q.response_options?.length || 0}</td>
                    <td className="py-3 text-right text-[#a0a0ac]">→</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <SlideOver
        open={!!selectedQuote}
        onClose={() => setSelectedQuote(null)}
        title="Quote Request Details"
        width="max-w-xl"
      >
        {selectedQuote && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Shipment" value={selectedQuote.shipment_ref || '—'} />
              <Field label="Carrier" value={selectedQuote.carrier_name || '—'} />
              <Field label="Contact" value={selectedQuote.carrier_contact_email || '—'} />
              <Field label="Sent At" value={formatIST(selectedQuote.sent_at)} />
              <Field label="Status" value={selectedQuote.status} />
              {selectedQuote.responded_at && <Field label="Responded At" value={formatIST(selectedQuote.responded_at)} />}
            </div>

            {selectedQuote.response_options && selectedQuote.response_options.length > 0 ? (
              <div>
                <h4 className="mb-2 text-[12px] font-semibold text-[#393945]">Response Options</h4>
                <div className="space-y-2">
                  {selectedQuote.response_options.map((opt, i) => {
                    const isSelected = selectedQuote.selected_option_index === i;
                    return (
                      <div
                        key={i}
                        className={`flex items-center gap-3 rounded-xl border p-3 ${isSelected ? 'border-[#13945a] bg-[#eaf9f2]' : 'border-[#e9e9ef] bg-[#fbfbfd]'}`}
                      >
                        <div className="flex-1">
                          <p className="text-[12px] font-semibold text-[#393945]">{opt.option_name}</p>
                          <p className="text-[10px] text-[#9899a5]">{opt.transit_days}d transit{opt.notes ? ` · ${opt.notes}` : ''}</p>
                        </div>
                        <span className="font-display text-[14px] font-semibold text-[#393945]">{formatINR(opt.amount_paise)}</span>
                        {isSelected ? (
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#13945a] text-white">
                            <Check size={14} />
                          </span>
                        ) : (
                          <button
                            onClick={() => selectOptionMutation.mutate({ id: selectedQuote.id, option_index: i })}
                            disabled={selectOptionMutation.isPending}
                            className="rounded-lg bg-[#edf5ff] px-3 py-1.5 text-[10px] font-semibold text-[#5185d8] hover:bg-[#e0edff] disabled:opacity-50"
                          >
                            Select
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="rounded-lg bg-[#f7f6fc] px-3 py-3 text-[12px] text-[#9899a5]">No response received yet.</p>
            )}
          </div>
        )}
      </SlideOver>

      <NewQuoteModal open={showNewModal} onClose={() => setShowNewModal(false)} />
    </AppShell>
  );
}

function NewQuoteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [shipmentSearch, setShipmentSearch] = useState('');
  const [selectedShipment, setSelectedShipment] = useState<{ id: string; ref_number: string; transport_mode: string; origin: string; destination: string } | null>(null);
  const [selectedCarriers, setSelectedCarriers] = useState<string[]>([]);
  const [expiryHours, setExpiryHours] = useState(24);
  const [laneCheck, setLaneCheck] = useState<LaneCheckResult | null>(null);

  const shipmentsQuery = useQuery({
    queryKey: queryKeys.shipments({ search: shipmentSearch, limit: 10 }),
    queryFn: () => shipmentsApi.list({ search: shipmentSearch || undefined, limit: 10 }),
    enabled: open && step === 1 && shipmentSearch.length > 1,
  });

  const carriersQuery = useQuery({
    queryKey: queryKeys.crmCarriers({ transport_mode: selectedShipment?.transport_mode }),
    queryFn: () => crmApi.listCarriers({ transport_mode: selectedShipment?.transport_mode }),
    enabled: open && step === 3,
  });

  const laneCheckMutation = useMutation({
    mutationFn: (params: { transport_mode: string; origin_country: string; dest_country: string }) =>
      vendorQuotesApi.laneCheck(params),
    onSuccess: (data) => setLaneCheck(data),
    onError: (err) => toast.error(toApiError(err as any).message),
  });

  const requestMutation = useMutation({
    mutationFn: () => vendorQuotesApi.request({
      shipment_id: selectedShipment!.id,
      carrier_ids: selectedCarriers,
      expiry_hours: expiryHours,
    }),
    onSuccess: () => {
      const names = carriersQuery.data?.items?.filter((c: CrmCarrier) => selectedCarriers.includes(c.id)).map((c: CrmCarrier) => c.name).join(', ') || 'carriers';
      toast.success(`Quote requests sent to ${names}`);
      queryClient.invalidateQueries({ queryKey: ['vendor-quotes'] });
      reset();
      onClose();
    },
    onError: (err) => toast.error(toApiError(err as any).message),
  });

  function reset() {
    setStep(1);
    setShipmentSearch('');
    setSelectedShipment(null);
    setSelectedCarriers([]);
    setExpiryHours(24);
    setLaneCheck(null);
  }

  function selectShipment(s: { id: string; ref_number: string; transport_mode: string; origin: string; destination: string }) {
    setSelectedShipment(s);
    setStep(2);
    laneCheckMutation.mutate({
      transport_mode: s.transport_mode,
      origin_country: s.origin,
      dest_country: s.destination,
    });
  }

  function toggleCarrier(id: string) {
    setSelectedCarriers((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : prev.length >= 4 ? prev : [...prev, id]
    );
  }

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      title="Send New Quote Request"
      width="max-w-lg"
      footer={
        <>
          <button onClick={() => { reset(); onClose(); }} className="rounded-lg border border-[#e9e9ef] px-4 py-2 text-[12px] font-medium text-[#777884] hover:bg-[#f7f7fa]">Cancel</button>
          {step > 1 && step < 4 && (
            <button onClick={() => setStep(step - 1)} className="rounded-lg border border-[#e9e9ef] px-4 py-2 text-[12px] font-medium text-[#777884] hover:bg-[#f7f7fa]">Back</button>
          )}
          {step === 2 && (
            <button onClick={() => setStep(3)} className="rounded-lg bg-[#7068cf] px-4 py-2 text-[12px] font-semibold text-white">Continue</button>
          )}
          {step === 3 && (
            <button onClick={() => setStep(4)} disabled={selectedCarriers.length === 0} className="rounded-lg bg-[#7068cf] px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50">Continue</button>
          )}
          {step === 4 && (
            <button
              onClick={() => requestMutation.mutate()}
              disabled={requestMutation.isPending}
              className="flex items-center gap-2 rounded-lg bg-[#7068cf] px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
            >
              {requestMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              Send Requests
            </button>
          )}
        </>
      }
    >
      <div className="mb-4 flex items-center gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? 'bg-[#7068cf]' : 'bg-[#e9e9ef]'}`} />
        ))}
      </div>

      {step === 1 && (
        <div>
          <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">Search shipment</label>
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a0a0ac]" />
            <input
              autoFocus
              placeholder="Type ref number…"
              value={shipmentSearch}
              onChange={(e) => setShipmentSearch(e.target.value)}
              className={`${inputCls} w-full pl-9`}
            />
          </div>
          <div className="max-h-60 space-y-1.5 overflow-y-auto">
            {shipmentsQuery.data?.items?.map((s: Shipment) => (
              <button
                key={s.id}
                onClick={() => selectShipment(s)}
                className="flex w-full items-center justify-between rounded-lg border border-[#e9e9ef] px-3 py-2 text-left hover:bg-[#f7f7fa]"
              >
                <div>
                  <p className="text-[12px] font-semibold text-[#393945]">{s.ref_number}</p>
                  <p className="text-[10px] text-[#9899a5]">{s.origin} → {s.destination}</p>
                </div>
                <span className="text-[10px] capitalize text-[#9899a5]">{s.transport_mode}</span>
              </button>
            ))}
            {shipmentsQuery.isLoading && <p className="py-3 text-center text-[11px] text-[#9899a5]">Searching…</p>}
            {shipmentsQuery.data?.items?.length === 0 && shipmentSearch.length > 1 && (
              <p className="py-3 text-center text-[11px] text-[#9899a5]">No shipments found</p>
            )}
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <p className="mb-3 text-[12px] font-semibold text-[#393945]">{selectedShipment?.ref_number} · {selectedShipment?.origin} → {selectedShipment?.destination}</p>
          {laneCheckMutation.isPending ? (
            <div className="flex items-center gap-2 text-[12px] text-[#9899a5]"><Loader2 size={14} className="animate-spin" /> Checking lane…</div>
          ) : laneCheck ? (
            <div className={`flex items-start gap-3 rounded-xl border p-4 ${laneCheck.lane_volatile ? 'border-[#f9e7bc] bg-[#fffbeb]' : 'border-[#cfeee0] bg-[#eaf9f2]'}`}>
              {laneCheck.lane_volatile ? (
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#b77912]" />
              ) : (
                <Check size={18} className="mt-0.5 shrink-0 text-[#13945a]" />
              )}
              <div>
                <p className="text-[12px] font-semibold text-[#393945]">
                  {laneCheck.lane_volatile ? 'Lane Volatile — Rate Card disabled' : 'Rate Card available'}
                </p>
                <p className="mt-0.5 text-[11px] text-[#777884]">{laneCheck.message}</p>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {step === 3 && (
        <div>
          <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">Select carriers ({selectedCarriers.length}/4)</label>
          <div className="max-h-60 space-y-1.5 overflow-y-auto">
            {carriersQuery.data?.items?.map((c: CrmCarrier) => (
              <button
                key={c.id}
                onClick={() => toggleCarrier(c.id)}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition ${
                  selectedCarriers.includes(c.id) ? 'border-[#746ad1] bg-[#f0effc]' : 'border-[#e9e9ef] hover:bg-[#f7f7fa]'
                }`}
              >
                <span className="text-[12px] font-semibold text-[#393945]">{c.name}</span>
                {selectedCarriers.includes(c.id) && <Check size={14} className="text-[#7068cf]" />}
              </button>
            ))}
            {carriersQuery.isLoading && <p className="py-3 text-center text-[11px] text-[#9899a5]">Loading carriers…</p>}
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">Expiry (hours)</label>
            <input
              type="number"
              value={expiryHours}
              onChange={(e) => setExpiryHours(Number(e.target.value))}
              min={1}
              className={`${inputCls} w-full`}
            />
          </div>
          <div className="rounded-lg bg-[#f7f6fc] p-3 text-[11px] text-[#555566]">
            <p className="font-semibold text-[#393945]">Summary</p>
            <p className="mt-1">Shipment: {selectedShipment?.ref_number}</p>
            <p>Carriers: {selectedCarriers.length}</p>
            <p>Expiry: {expiryHours}h</p>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#a0a0ac]">{label}</p>
      <p className="mt-0.5 text-[12px] font-medium text-[#393945]">{value}</p>
    </div>
  );
}
