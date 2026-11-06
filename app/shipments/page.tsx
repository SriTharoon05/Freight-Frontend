"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import {
  Panel,
  Pager,
  ErrorBanner,
  inputClass,
  buttonClass,
  secondaryClass,
} from "@/components/freight/shared";
import { freight, type Page, type Job, type Entity, dateLabel } from "@/lib/freight";
import { useAuthStore } from "@/lib/auth-store";
type SavedJobDraft = { id: string; updated_at: string; form: { fields?: Record<string, string>; parties?: { customer_id?: Entity }; cargo?: unknown[] } };
export default function JobsPage() {
  const searchParams = useSearchParams();
  const assignedUserId = searchParams.get("assigned_user_id") || undefined;
  const user = useAuthStore((s) => s.user),
    [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [mode, setMode] = useState(""),
    [status, setStatus] = useState(searchParams.get("status") || "");
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);
  const result = useQuery<Page<Job>>({
    queryKey: [
      "freight",
      user?.tenant_id,
      "jobs",
      page,
      query,
      mode,
      status,
      assignedUserId,
    ],
    queryFn: () =>
      freight.get<Page<Job>>("/jobs", {
        page,
        search: query,
        mode,
        status,
        assigned_user_id: assignedUserId,
      }),
  });
  const drafts = useQuery<Page<SavedJobDraft>>({
    queryKey: ["freight", user?.tenant_id, "job-drafts"],
    queryFn: () => freight.get<Page<SavedJobDraft>>("/job-drafts", { limit: 20 }),
    enabled: !!user && !["finance", "customer"].includes(user.role),
  });
  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
            <p className="mt-1 text-xs text-[#858693]">Shipment operations</p>
          </div>
          <Link className={buttonClass} href="/shipments/new">
            <Plus size={14} />
            New job
          </Link>
        </div>
        <Panel title="Saved drafts">
          <ErrorBanner error={drafts.error} />
          {drafts.isLoading ? <p className="text-xs text-[#858693]">Loading drafts…</p> : !drafts.data?.items.length ? (
            <p className="text-xs text-[#858693]">Save an incomplete job with “Save draft”, then resume and edit it here before creation.</p>
          ) : <div className="space-y-3">{drafts.data.items.map((draft: SavedJobDraft) => (
            <div key={draft.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-xs">
              <div><strong>{draft.form.parties?.customer_id?.name || "Untitled job draft"}</strong> <span className="ml-2 rounded bg-amber-50 px-2 py-1 font-semibold text-amber-800">Draft · not created</span>
                <p className="mt-1 text-[#858693]">{draft.form.fields?.origin || "Origin pending"} → {draft.form.fields?.destination || "Destination pending"} · Saved {dateLabel(draft.updated_at)}</p></div>
              <Link className={secondaryClass} href={`/shipments/new?draft=${draft.id}`}>Resume & edit draft</Link>
            </div>
          ))}
          {drafts.data && drafts.data.total > drafts.data.items.length && <p className="mt-3 text-xs">Showing the 20 most recently saved drafts.</p>}
          </div>}
        </Panel>
        <Panel title="Job register">
          <div className="mb-5 grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
            <input
              aria-label="Search jobs"
              className={inputClass}
              placeholder="Job, customer or master reference"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              aria-label="Mode"
              className={inputClass}
              value={mode}
              onChange={(e) => {
                setMode(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All modes</option>
              {["ocean", "air", "road", "rail", "multimodal"].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
            <select
              aria-label="Status"
              className={inputClass}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {[
                "draft",
                "booking_confirmed",
                "in_transit",
                "customs_import_pending",
                "customs_import_cleared",
                "delivered",
                "closed",
                "on_hold",
                "cancelled",
              ].map((s) => (
                <option key={s} value={s}>
                  {s.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <ErrorBanner error={result.error} />
          <div className="overflow-auto">
            <table className="w-full whitespace-nowrap text-left text-xs">
              <thead className="border-b text-[10px] uppercase tracking-wide text-[#858693]">
                <tr>
                  {[
                    "Job / Customer",
                    "Route",
                    "Mode / Service",
                    "ETD",
                    "ETA",
                    "Status",
                    "D&D",
                  ].map((h) => (
                    <th className="px-3 py-3" key={h}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.data?.items.map((job: Job) => (
                  <tr
                    key={job.id}
                    className="border-b border-[#f1eff6] hover:bg-[#faf9ff]"
                  >
                    <td className="px-3 py-4">
                      <Link
                        className="font-semibold text-[#7068cf]"
                        href={job.is_draft ? `/shipments/new?draft=${job.id}` : `/shipments/${job.id}`}
                      >
                        {job.ref_number}
                      </Link>
                      <p className="mt-1 text-[10px] text-[#858693]">
                        {job.customer_name}
                        {job.assigned_name && (
                          <span className="block">{job.assigned_name}</span>
                        )}
                      </p>
                    </td>
                    <td className="px-3">
                      {job.origin} → {job.destination}
                    </td>
                    <td className="px-3 capitalize">
                      {job.transport_mode}
                      <p className="text-[10px] text-[#858693]">
                        {job.service_type}
                      </p>
                    </td>
                    <td className="px-3">{dateLabel(job.etd)}</td>
                    <td className="px-3">{dateLabel(job.eta)}</td>
                    <td className="px-3">
                      <span className="rounded-full bg-[#f0effc] px-2 py-1 text-[10px] text-[#7068cf]">
                        {job.status.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td
                      className={`px-3 text-[10px] ${["overdue", "critical"].includes(job.dd_risk) ? "font-semibold text-red-600" : "text-[#858693]"}`}
                    >
                      {job.dd_risk}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {result.isLoading && (
              <p className="p-8 text-center text-xs text-[#858693]">
                Loading jobs…
              </p>
            )}
            {result.data?.total === 0 && (
              <p className="p-8 text-center text-xs text-[#858693]">
                No jobs match these filters.
              </p>
            )}
          </div>
          <Pager
            page={page}
            total={result.data?.total || 0}
            limit={20}
            onChange={setPage}
          />
        </Panel>
      </div>
    </AppShell>
  );
}
