'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Search, Check, X, Loader2, Star, Phone } from 'lucide-react';
import Link from 'next/link';
import { crmApi, shipmentsApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { AppShell } from '@/components/shell/app-shell';
import { Card, SectionTitle } from '@/components/shell/card';
import { Modal } from '@/components/shell/modal';
import { SlideOver } from '@/components/shell/slide-over';
import { TableSkeleton, ErrorState, EmptyState } from '@/components/shell/states';
import { formatINR } from '@/lib/format';
import { timeAgo } from '@/lib/date';
import { toApiError } from '@/lib/api-client';
import type { CrmCustomer, CrmCarrier, CrmAgent, Customer, Shipment } from '@/lib/types';

const inputCls = 'rounded-lg border border-[#e9e9ef] bg-white px-3 py-2 text-[12px] font-medium text-[#393945] outline-none focus:border-[#746ad1] focus:ring-2 focus:ring-[#e8e5f7]';

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const VEHICLE_TYPES = ['bike', 'auto', 'mini_truck', 'truck', 'container_truck'];

export default function CrmPage() {
  const [tab, setTab] = useState<'customers' | 'carriers' | 'agents'>('customers');

  return (
    <AppShell>
      <SectionTitle>CRM</SectionTitle>

      <div className="mb-5 flex gap-1 border-b border-[#f0f0f4]">
        {(['customers', 'carriers', 'agents'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative px-4 py-2.5 text-[12px] font-semibold capitalize transition ${
              tab === t ? 'text-[#7068cf]' : 'text-[#777884] hover:text-[#393945]'
            }`}
          >
            {t}
            {tab === t && <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[#7068cf]" />}
          </button>
        ))}
      </div>

      {tab === 'customers' && <CustomersTab />}
      {tab === 'carriers' && <CarriersTab />}
      {tab === 'agents' && <AgentsTab />}
    </AppShell>
  );
}

// ─── Customers ───

function CustomersTab() {
  const [search, setSearch] = useState('');
  const [creditFilter, setCreditFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<CrmCustomer | null>(null);

  const query = useQuery({
    queryKey: queryKeys.crmCustomers({ search, credit_status: creditFilter, page: 1, limit: 50 }),
    queryFn: () => crmApi.listCustomers({ search: search || undefined, credit_status: creditFilter || undefined, page: 1, limit: 50 }),
  });

  return (
    <>
      <div className="mb-5 flex flex-wrap gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a0a0ac]" />
          <input placeholder="Search customers…" value={search} onChange={(e) => setSearch(e.target.value)} className={`${inputCls} pl-9`} />
        </div>
        <select value={creditFilter} onChange={(e) => setCreditFilter(e.target.value)} className={inputCls}>
          <option value="">All Credit</option>
          <option value="ok">OK</option>
          <option value="overdue">Overdue</option>
          <option value="over_limit">Over Limit</option>
        </select>
        <button onClick={() => setShowAdd(true)} className="ml-auto flex items-center gap-2 rounded-lg bg-[#7068cf] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#635bbf]">
          <Plus size={14} /> Add Customer
        </button>
      </div>

      <Card>
        {query.isLoading ? <TableSkeleton rows={6} cols={6} /> : query.isError ? (
          <ErrorState message="Could not load customers" onRetry={() => query.refetch()} />
        ) : !query.data?.items?.length ? (
          <EmptyState title="No customers" message="Customers will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[#f0f0f4] text-left text-[10px] font-bold uppercase tracking-wide text-[#a0a0ac]">
                  <th className="pb-2 pr-4">Company</th>
                  <th className="pb-2 pr-4">Contact</th>
                  <th className="pb-2 pr-4">Email</th>
                  <th className="pb-2 pr-4">GSTIN</th>
                  <th className="pb-2 pr-4 text-right">Credit Limit</th>
                  <th className="pb-2 pr-4 text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((c: CrmCustomer) => {
                  const gstinValid = c.gstin ? GSTIN_REGEX.test(c.gstin) : null;
                  return (
                    <tr key={c.id} onClick={() => setSelected(c)} className="cursor-pointer border-b border-[#f5f5f8] hover:bg-[#fafafd]">
                      <td className="py-3 pr-4 font-semibold text-[#393945]">{c.name}</td>
                      <td className="py-3 pr-4 text-[#777884]">{c.contact_name || c.phone || '—'}</td>
                      <td className="py-3 pr-4 text-[#777884]">{c.email || '—'}</td>
                      <td className="py-3 pr-4">
                        {c.gstin ? (
                          <span className="flex items-center gap-1">
                            {gstinValid ? <Check size={12} className="text-[#13945a]" /> : <X size={12} className="text-[#d45166]" />}
                            <span className="text-[#777884]">{c.gstin}</span>
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-3 pr-4 text-right font-semibold text-[#393945]">{c.credit_limit_paise ? formatINR(c.credit_limit_paise) : '—'}</td>
                      <td className="py-3 pr-4 text-right text-[#777884]">{c.outstanding_paise ? formatINR(c.outstanding_paise) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected && <CustomerDetailSlideOver customer={selected} onClose={() => setSelected(null)} />}
      {showAdd && <AddCustomerModal onClose={() => setShowAdd(false)} />}
    </>
  );
}

function CustomerDetailSlideOver({ customer, onClose }: { customer: CrmCustomer; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [editName, setEditName] = useState(customer.name);
  const [editEmail, setEditEmail] = useState(customer.email || '');
  const [editPhone, setEditPhone] = useState(customer.phone || '');
  const [editAddress, setEditAddress] = useState(customer.address || '');
  const [creditLimit, setCreditLimit] = useState(customer.credit_limit_paise || 0);
  const [creditNote, setCreditNote] = useState('');

  const shipmentsQuery = useQuery({
    queryKey: queryKeys.customerShipments(customer.id),
    queryFn: () => shipmentsApi.list({ shipper_id: customer.id, limit: 5 }),
  });

  const updateMutation = useMutation({
    mutationFn: () => crmApi.updateCustomer(customer.id, { name: editName, email: editEmail, phone: editPhone, address: editAddress }),
    onSuccess: () => {
      toast.success('Customer updated');
      queryClient.invalidateQueries({ queryKey: ['crm', 'customers'] });
    },
    onError: (err) => toast.error(toApiError(err as any).message),
  });

  const creditMutation = useMutation({
    mutationFn: () => crmApi.updateCreditLimit(customer.id, creditLimit, creditNote || undefined),
    onSuccess: () => {
      toast.success('Credit limit updated');
      queryClient.invalidateQueries({ queryKey: ['crm', 'customers'] });
    },
    onError: (err) => toast.error(toApiError(err as any).message),
  });

  return (
    <SlideOver open onClose={onClose} title={customer.name} width="max-w-lg">
      <div className="space-y-5">
        <div>
          <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#a0a0ac]">Profile</h4>
          <div className="space-y-2">
            <EditableField label="Name" value={editName} onChange={setEditName} />
            <EditableField label="Email" value={editEmail} onChange={setEditEmail} />
            <EditableField label="Phone" value={editPhone} onChange={setEditPhone} />
            <EditableField label="Address" value={editAddress} onChange={setEditAddress} />
          </div>
          <button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="mt-3 rounded-lg bg-[#7068cf] px-4 py-2 text-[11px] font-semibold text-white disabled:opacity-50">
            {updateMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : 'Save'}
          </button>
        </div>

        <div>
          <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#a0a0ac]">Credit Limit</h4>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-[10px] text-[#a0a0ac]">Amount (₹)</label>
              <input type="number" value={creditLimit / 100} onChange={(e) => setCreditLimit(Number(e.target.value) * 100)} className={`${inputCls} w-full`} />
            </div>
            <input placeholder="Note" value={creditNote} onChange={(e) => setCreditNote(e.target.value)} className={`${inputCls} flex-1`} />
            <button onClick={() => creditMutation.mutate()} disabled={creditMutation.isPending} className="rounded-lg bg-[#7068cf] px-4 py-2 text-[11px] font-semibold text-white disabled:opacity-50">
              Update
            </button>
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#a0a0ac]">Recent Shipments</h4>
          {shipmentsQuery.isLoading ? <p className="text-[11px] text-[#9899a5]">Loading…</p> : shipmentsQuery.data?.items?.length ? (
            <div className="space-y-1.5">
              {shipmentsQuery.data.items.map((s: Shipment) => (
                <div key={s.id} className="rounded-lg bg-[#fbfbfd] px-3 py-2">
                  <p className="text-[12px] font-semibold text-[#393945]">{s.ref_number}</p>
                  <p className="text-[10px] text-[#9899a5]">{s.origin} → {s.destination} · {s.status.replace(/_/g, ' ')}</p>
                </div>
              ))}
            </div>
          ) : <p className="text-[11px] text-[#9899a5]">No shipments yet.</p>}
        </div>
      </div>
    </SlideOver>
  );
}

function AddCustomerModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', contact_name: '', email: '', phone: '', gstin: '', address: '', city: '', credit_limit_paise: 0 });

  const mutation = useMutation({
    mutationFn: () => crmApi.createCustomer(form),
    onSuccess: () => {
      toast.success('Customer created');
      queryClient.invalidateQueries({ queryKey: ['crm', 'customers'] });
      onClose();
    },
    onError: (err) => toast.error(toApiError(err as any).message),
  });

  return (
    <Modal open onClose={onClose} title="Add Customer" width="max-w-lg" footer={
      <>
        <button onClick={onClose} className="rounded-lg border border-[#e9e9ef] px-4 py-2 text-[12px] font-medium text-[#777884] hover:bg-[#f7f7fa]">Cancel</button>
        <button onClick={() => mutation.mutate()} disabled={!form.name || mutation.isPending} className="rounded-lg bg-[#7068cf] px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50">
          {mutation.isPending ? <Loader2 size={13} className="animate-spin" /> : 'Create'}
        </button>
      </>
    }>
      <div className="space-y-3">
        <FormField label="Company Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <FormField label="Contact Name" value={form.contact_name} onChange={(v) => setForm({ ...form, contact_name: v })} />
        <FormField label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
        <FormField label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
        <FormField label="GSTIN" value={form.gstin} onChange={(v) => setForm({ ...form, gstin: v })} />
        <FormField label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
        <FormField label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
        <div>
          <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">Credit Limit (₹)</label>
          <input type="number" value={form.credit_limit_paise / 100} onChange={(e) => setForm({ ...form, credit_limit_paise: Number(e.target.value) * 100 })} className={`${inputCls} w-full`} />
        </div>
      </div>
    </Modal>
  );
}

// ─── Carriers ───

function CarriersTab() {
  const [modeFilter, setModeFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<CrmCarrier | null>(null);

  const query = useQuery({
    queryKey: queryKeys.crmCarriers({ transport_mode: modeFilter }),
    queryFn: () => crmApi.listCarriers({ transport_mode: modeFilter || undefined }),
  });

  return (
    <>
      <div className="mb-5 flex flex-wrap gap-3">
        <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)} className={inputCls}>
          <option value="">All Modes</option>
          <option value="ocean">Sea</option>
          <option value="air">Air</option>
          <option value="road">Road</option>
          <option value="rail">Rail</option>
        </select>
        <button onClick={() => setShowAdd(true)} className="ml-auto flex items-center gap-2 rounded-lg bg-[#7068cf] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#635bbf]">
          <Plus size={14} /> Add Carrier
        </button>
      </div>

      <Card>
        {query.isLoading ? <TableSkeleton rows={6} cols={7} /> : query.isError ? (
          <ErrorState message="Could not load carriers" onRetry={() => query.refetch()} />
        ) : !query.data?.items?.length ? (
          <EmptyState title="No carriers" message="Carriers will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[#f0f0f4] text-left text-[10px] font-bold uppercase tracking-wide text-[#a0a0ac]">
                  <th className="pb-2 pr-4">Name</th>
                  <th className="pb-2 pr-4">Code</th>
                  <th className="pb-2 pr-4">Mode</th>
                  <th className="pb-2 pr-4">SCAC</th>
                  <th className="pb-2 pr-4 text-right">Free Time (O/D)</th>
                  <th className="pb-2 pr-4 text-right">D&D $/day</th>
                  <th className="pb-2 text-right">On-Time %</th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((c: CrmCarrier) => (
                  <tr key={c.id} onClick={() => setSelected(c)} className="cursor-pointer border-b border-[#f5f5f8] hover:bg-[#fafafd]">
                    <td className="py-3 pr-4 font-semibold text-[#393945]">{c.name}</td>
                    <td className="py-3 pr-4 text-[#777884]">{c.code || '—'}</td>
                    <td className="py-3 pr-4 capitalize text-[#777884]">{c.transport_mode}</td>
                    <td className="py-3 pr-4 text-[#777884]">{c.scac || '—'}</td>
                    <td className="py-3 pr-4 text-right text-[#777884]">{c.free_time_origin_days ?? '—'}/{c.free_time_dest_days ?? '—'}</td>
                    <td className="py-3 pr-4 text-right text-[#777884]">{c.dd_rate_per_day_cents ? `$${(c.dd_rate_per_day_cents / 100).toFixed(0)}` : '—'}</td>
                    <td className="py-3 text-right text-[#777884]">{c.avg_on_time ? `${c.avg_on_time.toFixed(0)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected && <CarrierDetailSlideOver carrier={selected} onClose={() => setSelected(null)} />}
      {showAdd && <AddCarrierModal onClose={() => setShowAdd(false)} />}
    </>
  );
}

function CarrierDetailSlideOver({ carrier, onClose }: { carrier: CrmCarrier; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: carrier.name, code: carrier.code || '', transport_mode: carrier.transport_mode,
    scac: carrier.scac || '', free_time_origin_days: carrier.free_time_origin_days || 0,
    free_time_dest_days: carrier.free_time_dest_days || 0, dd_rate_per_day_cents: carrier.dd_rate_per_day_cents || 0,
  });

  const mutation = useMutation({
    mutationFn: () => crmApi.updateCarrier(carrier.id, form),
    onSuccess: () => {
      toast.success('Carrier updated');
      queryClient.invalidateQueries({ queryKey: ['crm', 'carriers'] });
    },
    onError: (err) => toast.error(toApiError(err as any).message),
  });

  return (
    <SlideOver open onClose={onClose} title={carrier.name} width="max-w-lg">
      <div className="space-y-3">
        <FormField label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <FormField label="Code" value={form.code} onChange={(v) => setForm({ ...form, code: v })} />
        <div>
          <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">Transport Mode</label>
          <select value={form.transport_mode} onChange={(e) => setForm({ ...form, transport_mode: e.target.value })} className={`${inputCls} w-full`}>
            <option value="ocean">Ocean</option><option value="air">Air</option><option value="road">Road</option><option value="rail">Rail</option>
          </select>
        </div>
        <FormField label="SCAC" value={form.scac} onChange={(v) => setForm({ ...form, scac: v })} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">Free Time Origin (days)</label>
            <input type="number" value={form.free_time_origin_days} onChange={(e) => setForm({ ...form, free_time_origin_days: Number(e.target.value) })} className={`${inputCls} w-full`} />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">Free Time Dest (days)</label>
            <input type="number" value={form.free_time_dest_days} onChange={(e) => setForm({ ...form, free_time_dest_days: Number(e.target.value) })} className={`${inputCls} w-full`} />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">D&D Rate ($/day)</label>
          <input type="number" value={form.dd_rate_per_day_cents / 100} onChange={(e) => setForm({ ...form, dd_rate_per_day_cents: Number(e.target.value) * 100 })} className={`${inputCls} w-full`} />
        </div>
        <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="rounded-lg bg-[#7068cf] px-4 py-2 text-[11px] font-semibold text-white disabled:opacity-50">
          {mutation.isPending ? <Loader2 size={13} className="animate-spin" /> : 'Save'}
        </button>
        <div className="pt-2">
          <Link href="/rates" className="text-[11px] font-semibold text-[#5185d8] hover:underline">Manage rate cards →</Link>
        </div>
      </div>
    </SlideOver>
  );
}

function AddCarrierModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', code: '', transport_mode: 'ocean', scac: '', free_time_origin_days: 0, free_time_dest_days: 0, dd_rate_per_day_cents: 0 });

  const mutation = useMutation({
    mutationFn: () => crmApi.createCarrier(form),
    onSuccess: () => {
      toast.success('Carrier created');
      queryClient.invalidateQueries({ queryKey: ['crm', 'carriers'] });
      onClose();
    },
    onError: (err) => toast.error(toApiError(err as any).message),
  });

  return (
    <Modal open onClose={onClose} title="Add Carrier" width="max-w-lg" footer={
      <>
        <button onClick={onClose} className="rounded-lg border border-[#e9e9ef] px-4 py-2 text-[12px] font-medium text-[#777884] hover:bg-[#f7f7fa]">Cancel</button>
        <button onClick={() => mutation.mutate()} disabled={!form.name || mutation.isPending} className="rounded-lg bg-[#7068cf] px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50">
          {mutation.isPending ? <Loader2 size={13} className="animate-spin" /> : 'Create'}
        </button>
      </>
    }>
      <div className="space-y-3">
        <FormField label="Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <FormField label="Code" value={form.code} onChange={(v) => setForm({ ...form, code: v })} />
        <div>
          <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">Transport Mode</label>
          <select value={form.transport_mode} onChange={(e) => setForm({ ...form, transport_mode: e.target.value })} className={`${inputCls} w-full`}>
            <option value="ocean">Ocean</option><option value="air">Air</option><option value="road">Road</option><option value="rail">Rail</option>
          </select>
        </div>
        <FormField label="SCAC" value={form.scac} onChange={(v) => setForm({ ...form, scac: v })} />
      </div>
    </Modal>
  );
}

// ─── Agents ───

function AgentsTab() {
  const [statusFilter, setStatusFilter] = useState('');
  const [verifFilter, setVerifFilter] = useState('');
  const [showOnboard, setShowOnboard] = useState(false);
  const [selected, setSelected] = useState<CrmAgent | null>(null);

  const query = useQuery({
    queryKey: queryKeys.crmAgents({ status: statusFilter, verification_status: verifFilter }),
    queryFn: () => crmApi.listAgents({ status: statusFilter || undefined, verification_status: verifFilter || undefined }),
  });

  const VERIF_STYLES: Record<string, string> = {
    pending: 'bg-[#fff7e7] text-[#b77912]',
    in_review: 'bg-[#edf5ff] text-[#5185d8]',
    verified: 'bg-[#eaf9f2] text-[#13945a]',
    rejected: 'bg-[#fff0f2] text-[#d45166]',
  };

  return (
    <>
      <div className="mb-5 flex flex-wrap gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputCls}>
          <option value="">All Status</option>
          <option value="available">Available</option><option value="offline">Offline</option><option value="suspended">Suspended</option>
        </select>
        <select value={verifFilter} onChange={(e) => setVerifFilter(e.target.value)} className={inputCls}>
          <option value="">All Verification</option>
          <option value="pending">Pending</option><option value="in_review">In Review</option><option value="verified">Verified</option><option value="rejected">Rejected</option>
        </select>
        <button onClick={() => setShowOnboard(true)} className="ml-auto flex items-center gap-2 rounded-lg bg-[#7068cf] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#635bbf]">
          <Plus size={14} /> Onboard Agent
        </button>
      </div>

      <Card>
        {query.isLoading ? <TableSkeleton rows={6} cols={7} /> : query.isError ? (
          <ErrorState message="Could not load agents" onRetry={() => query.refetch()} />
        ) : !query.data?.items?.length ? (
          <EmptyState title="No agents" message="Agents will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[#f0f0f4] text-left text-[10px] font-bold uppercase tracking-wide text-[#a0a0ac]">
                  <th className="pb-2 pr-4">Name</th>
                  <th className="pb-2 pr-4">Phone</th>
                  <th className="pb-2 pr-4">Vehicle</th>
                  <th className="pb-2 pr-4">License Expiry</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Verification</th>
                  <th className="pb-2 text-right">Rating</th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((a: CrmAgent) => {
                  const daysToExpiry = a.license_expiry ? Math.ceil((new Date(a.license_expiry).getTime() - Date.now()) / 86400000) : null;
                  return (
                    <tr key={a.id} onClick={() => setSelected(a)} className="cursor-pointer border-b border-[#f5f5f8] hover:bg-[#fafafd]">
                      <td className="py-3 pr-4 font-semibold text-[#393945]">{a.full_name}</td>
                      <td className="py-3 pr-4 text-[#777884]">{a.phone}</td>
                      <td className="py-3 pr-4 text-[#777884]">{a.vehicle_type?.replace('_', ' ') || '—'} {a.vehicle_number || ''}</td>
                      <td className={`py-3 pr-4 ${daysToExpiry !== null && daysToExpiry < 30 ? 'text-[#d45166] font-semibold' : 'text-[#777884]'}`}>
                        {a.license_expiry ? new Date(a.license_expiry).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="py-3 pr-4 capitalize text-[#777884]">{a.status}</td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${VERIF_STYLES[a.verification_status] || 'bg-slate-50 text-slate-500'}`}>
                          {a.verification_status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        {a.rating ? (
                          <span className="flex items-center justify-end gap-0.5">
                            <Star size={11} className="fill-[#e0b53a] text-[#e0b53a]" />
                            <span className="font-semibold text-[#393945]">{a.rating.toFixed(1)}</span>
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected && <AgentDetailSlideOver agent={selected} onClose={() => setSelected(null)} />}
      {showOnboard && <OnboardAgentModal onClose={() => setShowOnboard(false)} />}
    </>
  );
}

function AgentDetailSlideOver({ agent, onClose }: { agent: CrmAgent; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showDeactivate, setShowDeactivate] = useState(false);

  const verifyMutation = useMutation({
    mutationFn: ({ status, reason }: { status: string; reason?: string }) => crmApi.verifyAgent(agent.id, status, reason),
    onSuccess: () => {
      toast.success('Agent verification updated');
      queryClient.invalidateQueries({ queryKey: ['crm', 'agents'] });
      setShowReject(false);
      onClose();
    },
    onError: (err) => toast.error(toApiError(err as any).message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => crmApi.deleteAgent(agent.id),
    onSuccess: () => {
      toast.success('Agent deactivated');
      queryClient.invalidateQueries({ queryKey: ['crm', 'agents'] });
      setShowDeactivate(false);
      onClose();
    },
    onError: (err) => toast.error(toApiError(err as any).message),
  });

  return (
    <SlideOver open onClose={onClose} title={agent.full_name} width="max-w-lg">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone" value={agent.phone} />
          <Field label="Email" value={agent.email || '—'} />
          <Field label="Vehicle" value={`${agent.vehicle_type?.replace('_', ' ') || '—'} ${agent.vehicle_number || ''}`} />
          <Field label="License" value={agent.license_number || '—'} />
          <Field label="License Expiry" value={agent.license_expiry ? new Date(agent.license_expiry).toLocaleDateString('en-IN') : '—'} />
          <Field label="Rating" value={agent.rating ? `${agent.rating.toFixed(1)} ★` : '—'} />
          <Field label="Total Jobs" value={String(agent.total_jobs ?? '—')} />
          <Field label="Completion Rate" value={agent.completion_rate ? `${agent.completion_rate}%` : '—'} />
        </div>

        <div>
          <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#a0a0ac]">Verification</h4>
          <p className="mb-2 text-[12px] font-semibold capitalize text-[#393945]">{agent.verification_status.replace('_', ' ')}</p>
          {agent.rejection_reason && <p className="mb-2 rounded-lg bg-[#fff0f2] px-3 py-2 text-[11px] text-[#d45166]">Rejection: {agent.rejection_reason}</p>}
          {(agent.verification_status === 'pending' || agent.verification_status === 'in_review') && (
            <div className="flex gap-2">
              <button onClick={() => verifyMutation.mutate({ status: 'verified' })} disabled={verifyMutation.isPending} className="rounded-lg bg-[#eaf9f2] px-3 py-2 text-[11px] font-semibold text-[#13945a] hover:bg-[#dcf3e8]">
                <Check size={13} className="inline" /> Verify
              </button>
              <button onClick={() => setShowReject(true)} className="rounded-lg bg-[#fff0f2] px-3 py-2 text-[11px] font-semibold text-[#d45166] hover:bg-[#fde0e4]">
                <X size={13} className="inline" /> Reject
              </button>
            </div>
          )}
        </div>

        <button onClick={() => setShowDeactivate(true)} className="rounded-lg border border-[#f6d4da] bg-[#fff0f2] px-4 py-2 text-[11px] font-semibold text-[#d45166] hover:bg-[#fde0e4]">
          Deactivate Agent
        </button>
      </div>

      <Modal open={showReject} onClose={() => setShowReject(false)} title="Reject Agent" footer={
        <>
          <button onClick={() => setShowReject(false)} className="rounded-lg border border-[#e9e9ef] px-4 py-2 text-[12px] font-medium text-[#777884]">Cancel</button>
          <button onClick={() => verifyMutation.mutate({ status: 'rejected', reason: rejectReason })} disabled={!rejectReason.trim() || verifyMutation.isPending} className="rounded-lg bg-[#d45166] px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50">
            Confirm Rejection
          </button>
        </>
      }>
        <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">Rejection Reason *</label>
        <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} className={`${inputCls} w-full`} placeholder="Why is this agent being rejected?" />
      </Modal>

      <Modal open={showDeactivate} onClose={() => setShowDeactivate(false)} title="Deactivate Agent" footer={
        <>
          <button onClick={() => setShowDeactivate(false)} className="rounded-lg border border-[#e9e9ef] px-4 py-2 text-[12px] font-medium text-[#777884]">Cancel</button>
          <button onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} className="rounded-lg bg-[#d45166] px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50">
            Confirm Deactivation
          </button>
        </>
      }>
        <p className="text-[12px] text-[#777884]">Are you sure you want to deactivate {agent.full_name}? This action cannot be undone.</p>
      </Modal>
    </SlideOver>
  );
}

function OnboardAgentModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', vehicle_type: 'bike', vehicle_number: '', license_number: '', license_expiry: '' });

  const mutation = useMutation({
    mutationFn: () => crmApi.onboardAgent(form),
    onSuccess: () => {
      toast.success(`Onboarding link sent to ${form.phone}`);
      queryClient.invalidateQueries({ queryKey: ['crm', 'agents'] });
      onClose();
    },
    onError: (err) => toast.error(toApiError(err as any).message),
  });

  return (
    <Modal open onClose={onClose} title="Onboard Agent" width="max-w-lg" footer={
      <>
        <button onClick={onClose} className="rounded-lg border border-[#e9e9ef] px-4 py-2 text-[12px] font-medium text-[#777884] hover:bg-[#f7f7fa]">Cancel</button>
        <button onClick={() => mutation.mutate()} disabled={!form.full_name || !form.phone || form.phone.length !== 10 || !form.vehicle_number || !form.license_number || !form.license_expiry || mutation.isPending} className="rounded-lg bg-[#7068cf] px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50">
          {mutation.isPending ? <Loader2 size={13} className="animate-spin" /> : 'Send Onboarding Link'}
        </button>
      </>
    }>
      <div className="space-y-3">
        <FormField label="Full Name *" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
        <div>
          <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">Phone * (10 digits)</label>
          <div className="flex items-center">
            <span className="rounded-l-lg border border-r-0 border-[#e9e9ef] bg-[#f7f7fa] px-3 py-2 text-[12px] font-medium text-[#777884]">+91</span>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} placeholder="9876543210" className={`${inputCls} w-full rounded-l-none`} />
          </div>
        </div>
        <FormField label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
        <div>
          <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">Vehicle Type</label>
          <select value={form.vehicle_type} onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })} className={`${inputCls} w-full`}>
            {VEHICLE_TYPES.map((v) => <option key={v} value={v}>{v.replace('_', ' ')}</option>)}
          </select>
        </div>
        <FormField label="Vehicle Number *" value={form.vehicle_number} onChange={(v) => setForm({ ...form, vehicle_number: v })} />
        <FormField label="License Number *" value={form.license_number} onChange={(v) => setForm({ ...form, license_number: v })} />
        <div>
          <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">License Expiry *</label>
          <input type="date" value={form.license_expiry} onChange={(e) => setForm({ ...form, license_expiry: e.target.value })} className={`${inputCls} w-full`} />
        </div>
      </div>
    </Modal>
  );
}

// ─── Shared ───

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#a0a0ac]">{label}</p>
      <p className="mt-0.5 text-[12px] font-medium text-[#393945]">{value}</p>
    </div>
  );
}

function EditableField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#a0a0ac]">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} w-full`} />
    </div>
  );
}

function FormField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} w-full`} />
    </div>
  );
}
