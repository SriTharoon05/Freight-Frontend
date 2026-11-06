"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { freight, dateLabel, localDateInput, type Page } from "@/lib/freight";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Panel, Field, ErrorBanner, Pager, inputClass, buttonClass, secondaryClass } from "./shared";

type Status = "all" | "done" | "pending" | "overdue" | "risk";
export interface BoardMilestone {
  id: string;
  source: "milestone" | "partner_task" | "dd";
  job_id: string;
  job_reference: string;
  customer: string;
  event_type: string;
  vendor_name: string;
  planned_at: string | null;
  occurred_at: string | null;
  alert_before_hours: number;
  notes: string;
  editable: boolean;
  task_status: string | null;
  status: "done" | "pending" | "overdue";
  at_risk: boolean;
}
interface BoardData extends Page<BoardMilestone> {
  as_of: string;
  summary: Record<Status | "total" | "no_target", number>;
}
const colors = {
  done: "border-green-200 bg-green-50 text-green-800",
  pending: "border-orange-200 bg-orange-50 text-orange-800",
  overdue: "border-red-200 bg-red-50 text-red-800",
};
const labels = { done: "Done", pending: "Pending", overdue: "Overdue" };

export function MilestoneBoard({ jobId, compact = false }: { jobId?: string; compact?: boolean }) {
  const user = useAuthStore((state) => state.user);
  const client = useQueryClient();
  const [status, setStatus] = useState<Status>(compact ? "risk" : "all");
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search, 250);
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState<BoardMilestone | null>(null);
  const [form, setForm] = useState({ planned_at: "", actual_at: "", vendor_name: "", alert_before_hours: 24, notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState("");
  const limit = compact ? 6 : 50;
  const query = useQuery<BoardData>({
    queryKey: ["freight", user?.tenant_id, "milestone-board", jobId, status, q, page, limit],
    queryFn: ({ signal }) => freight.get<BoardData>("/milestone-board", { job_id: jobId, status, q, page, limit }, signal),
    refetchInterval: 30000,
  });
  const summary = query.data?.summary;
  function openEdit(item: BoardMilestone) {
    setError(null);
    setEdit(item);
    setForm({
      planned_at: localDateInput(item.planned_at), actual_at: localDateInput(item.occurred_at),
      vendor_name: item.vendor_name, alert_before_hours: item.alert_before_hours, notes: item.notes,
    });
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!edit) return;
    setSaving(true);
    setError(null);
    try {
      const target = { planned_at: form.planned_at === localDateInput(edit.planned_at) ? edit.planned_at : form.planned_at ? new Date(form.planned_at).toISOString() : null, alert_before_hours: form.alert_before_hours, notes: form.notes };
      if (edit.source === "partner_task") {
        await freight.patch(`/jobs/${edit.job_id}/vendor-targets/${edit.id}`, target);
      } else {
        await freight.patch(`/jobs/${edit.job_id}/milestones/${edit.id}`, {
          ...target, vendor_name: form.vendor_name,
          ...(form.actual_at !== localDateInput(edit.occurred_at) ? { actual_at: form.actual_at ? new Date(form.actual_at).toISOString() : null } : {}),
        });
      }
      setEdit(null);
      setSaved(`Saved ${edit.event_type}.`);
      await client.invalidateQueries({ queryKey: ["freight", user?.tenant_id] });
    } catch (cause) { setError(cause); }
    finally { setSaving(false); }
  }
  return <Panel title={compact ? "Milestone & D&D risk alerts" : "All vendor milestones"} action={
    compact ? <Link href="/milestones" className={secondaryClass}>All vendor milestones</Link> :
      <button className={secondaryClass} disabled={query.isFetching} onClick={() => void query.refetch()}>Refresh</button>
  }>
    <p className="mb-3 text-xs text-[#777884]">{jobId ? "Every vendor and shipment milestone for this job." : "All vendors across your accessible active jobs."} Targets and actuals use your browser&apos;s local time.</p>
    <div className="mb-4 flex flex-wrap gap-2" aria-label="Milestone filters">
      {([["all", "All", ""], ["done", "Green · Done", colors.done], ["pending", "Orange · Pending", colors.pending], ["overdue", "Red · Overdue", colors.overdue], ["risk", "At risk / due soon", "border-orange-200 text-orange-800"]] as const).map(([value, label, color]) =>
        <button key={value} aria-pressed={status === value} className={`${secondaryClass} ${color} ${status === value ? "ring-2 ring-[#7068cf] ring-offset-1" : ""}`} onClick={() => { setStatus(value); setPage(1); }}>
          {label} <strong>{summary?.[value === "all" ? "total" : value] ?? "—"}</strong>
        </button>)}
    </div>
    {!compact && <div className="mb-3 max-w-md"><Field label="Find vendor, job, customer or milestone"><input type="search" className={inputClass} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search all vendors…" /></Field></div>}
    <ErrorBanner error={query.error} />
    {saved && <p role="status" className="mb-3 text-xs text-green-800">{saved}</p>}
    {query.isLoading ? <p role="status" className="py-6 text-sm text-[#777884]">Loading milestones…</p> : query.data && <>
      <div className={`${compact ? "max-h-[380px]" : "max-h-[60vh]"} overflow-auto rounded-xl border border-[#eeecf5]`}>
        <table className="w-full min-w-[850px] text-left text-xs">
          <thead className="sticky top-0 z-10 bg-[#f7f6fb] text-[10px] uppercase text-[#777884]"><tr>
            {['Vendor / owner', ...(jobId ? [] : ['Job / customer']), 'Milestone', 'Target completion', 'Actual completion', 'Status', ''].map((heading, index) => <th key={index} scope="col" className="px-3 py-3">{heading || <span className="sr-only">Actions</span>}</th>)}
          </tr></thead>
          <tbody>{query.data.items.map((item: BoardMilestone) => <tr key={`${item.source}:${item.id}`} className="border-t border-[#eeecf5] align-top">
            <td className="max-w-[180px] px-3 py-3 font-medium">{item.vendor_name}</td>
            {!jobId && <td className="px-3 py-3"><Link href={`/shipments/${item.job_id}?tab=Milestones`} className="font-semibold text-[#7068cf]">{item.job_reference}</Link><p className="mt-1 text-[10px] text-[#777884]">{item.customer}</p></td>}
            <td className="max-w-[240px] px-3 py-3"><strong className="font-medium capitalize">{item.event_type}</strong>{item.source === "partner_task" && <p className="mt-1 text-[10px] text-[#777884]">{item.task_status?.replaceAll("_", " ")} · vendor verification determines completion</p>}{item.notes && <p className="mt-1 text-[10px] text-[#777884]">{item.notes}</p>}</td>
            <td className="whitespace-nowrap px-3 py-3">{item.planned_at ? dateLabel(item.planned_at) : <span className="text-orange-800">No target set</span>}{item.planned_at && !item.occurred_at && <p className="mt-1 text-[10px] text-[#777884]">Alert {item.alert_before_hours}h before</p>}</td>
            <td className="whitespace-nowrap px-3 py-3">{dateLabel(item.occurred_at)}{item.occurred_at && item.planned_at && new Date(item.occurred_at) > new Date(item.planned_at) && <p className="mt-1 text-[10px] text-[#777884]">Completed after target</p>}</td>
            <td className="whitespace-nowrap px-3 py-3"><span className={`inline-block rounded-full border px-2 py-1 font-semibold ${colors[item.status]}`}>{labels[item.status]}</span>{item.at_risk && <p className={`mt-1 text-[10px] font-medium ${item.status === "overdue" ? "text-red-700" : "text-orange-800"}`}>{item.source === "dd" ? item.status === "overdue" ? "D&D exposure risk" : "D&D deadline approaching" : item.status === "overdue" ? "Target missed" : "Due soon · potential delay"}</p>}</td>
            <td className="px-3 py-3">{item.editable && user?.role !== "readonly" ? <button className={secondaryClass} onClick={() => openEdit(item)} aria-label={`Edit target for ${item.event_type} · ${item.vendor_name}`}>{item.planned_at ? "Edit target" : "Set target"}</button> : item.source === "dd" ? <Link className="text-[#7068cf]" href={`/shipments/${item.job_id}`}>Edit job free time</Link> : null}</td>
          </tr>)}</tbody>
        </table>
        {!query.data.items.length && <p className="p-6 text-sm text-[#777884]">{status === "risk" ? "No milestones or D&D deadlines currently within their alert window." : "No milestones match this view."}</p>}
      </div>
      <Pager page={page} total={query.data.total} limit={limit} onChange={setPage} />
      <div className="mt-3 flex flex-wrap justify-between gap-2 text-[10px] text-[#777884]">
        <span>{summary?.no_target ? `${summary.no_target} pending milestones have no target; set one to enable warnings.` : "Risk alerts clear when work is completed or targets move outside the warning window."}</span>
        <span>Updated {dateLabel(query.data.as_of)} · Refreshes every 30s</span>
      </div>
    </>}
    <Sheet open={!!edit} onOpenChange={(open) => { if (!open && !saving) setEdit(null); }}>
      <SheetContent className="overflow-y-auto"><SheetHeader><SheetTitle>Set completion target</SheetTitle></SheetHeader>
        {edit && <form onSubmit={save} className="mt-5 space-y-4">
          <p className="text-sm font-semibold capitalize">{edit.event_type}</p><p className="text-xs text-[#777884]">{edit.vendor_name} · {edit.job_reference}</p>
          <ErrorBanner error={error} />
          <Field label="Target completion date & time"><input type="datetime-local" className={inputClass} value={form.planned_at} onChange={(event) => setForm({ ...form, planned_at: event.target.value })} /></Field>
          <Field label="Warn before target (hours)"><input required type="number" min={1} max={720} step={1} className={inputClass} value={form.alert_before_hours} onChange={(event) => setForm({ ...form, alert_before_hours: Number(event.target.value) })} /></Field>
          <p className="text-xs text-[#777884]">Dates use your browser&apos;s local time. Pending turns red after its target. Dashboard warnings appear within the warning period. Clear the target to remove its deadline alerts.</p>
          {edit.source === "milestone" && <>
            <Field label="Vendor / owner"><input maxLength={255} className={inputClass} value={form.vendor_name} onChange={(event) => setForm({ ...form, vendor_name: event.target.value })} /></Field>
            <Field label="Actual completion date & time"><input type="datetime-local" className={inputClass} value={form.actual_at} onChange={(event) => setForm({ ...form, actual_at: event.target.value })} /></Field>
          </>}
          <Field label="Notes"><textarea maxLength={4000} className={inputClass} rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
          <div className="flex gap-2"><button disabled={saving} className={buttonClass}>{saving ? "Saving…" : "Save target"}</button><button type="button" disabled={saving} className={secondaryClass} onClick={() => setEdit(null)}>Cancel</button></div>
        </form>}
      </SheetContent>
    </Sheet>
  </Panel>;
}
