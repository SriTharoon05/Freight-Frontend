"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Plus, Search } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import {
  Panel,
  PageHero,
  StatusBadge,
  ModeBadge,
  Pager,
  ErrorBanner,
  inputClass,
  buttonClass,
  secondaryClass,
} from "@/components/freight/shared";
import { freight, type Page, type Job, type Entity, dateLabel } from "@/lib/freight";
import { useAuthStore } from "@/lib/auth-store";

type SavedJobDraft = {
  id: string;
  updated_at: string;
  form: {
    fields?: Record<string, string>;
    parties?: { customer_id?: Entity };
    cargo?: unknown[];
  };
};

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
        <PageHero
          eyebrow="Shipment Operations Desk"
          title="Active Jobs & Multimodal Register"
          subtitle="Manage house & master bookings, container free-time exposure, customs filings, and live partner dispatch across ocean, air, road, and rail."
          actions={
            <Link className={buttonClass} href="/shipments/new">
              <Plus size={14} />
              New job
            </Link>
          }
        />

        {!!drafts.data?.items?.length && (
          <Panel title="Saved drafts">
            <ErrorBanner error={drafts.error} />
            <div className="space-y-2.5">
              {drafts.data.items.map((draft: SavedJobDraft) => (
                <div
                  key={draft.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200/70 bg-amber-50/40 p-3.5 text-xs"
                >
                  <div>
                    <strong className="text-slate-900">
                      {draft.form.parties?.customer_id?.name || "Untitled job draft"}
                    </strong>{" "}
                    <span className="ml-2 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold text-amber-900">
                      Draft · not created
                    </span>
                    <p className="mt-1 text-slate-600">
                      {draft.form.fields?.origin || "Origin pending"} →{" "}
                      {draft.form.fields?.destination || "Destination pending"} · Saved{" "}
                      {dateLabel(draft.updated_at)}
                    </p>
                  </div>
                  <Link className={secondaryClass} href={`/shipments/new?draft=${draft.id}`}>
                    Resume &amp; edit draft
                  </Link>
                </div>
              ))}
              {drafts.data.total > drafts.data.items.length && (
                <p className="mt-2 text-xs text-slate-500">
                  Showing the 20 most recently saved drafts.
                </p>
              )}
            </div>
          </Panel>
        )}

        <Panel
          title="Job register"
          action={
            <span className="text-xs font-medium tabular-nums text-slate-500">
              {result.data?.total ?? 0} total shipments
            </span>
          }
        >
          <div className="mb-5 grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                aria-label="Search jobs"
                className={`${inputClass} pl-9`}
                placeholder="Search job ref, customer, HBL/HAWB, or master reference…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
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
                <option key={m} value={m}>
                  {m.toUpperCase()}
                </option>
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
                "picked_up",
                "customs_export_pending",
                "customs_export_cleared",
                "in_transit",
                "arrived_at_destination_port",
                "customs_import_pending",
                "customs_import_cleared",
                "out_for_delivery",
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
          <div className="overflow-auto rounded-xl border border-slate-100">
            <table className="w-full whitespace-nowrap text-left text-xs">
              <thead className="bg-slate-50/90 text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  {[
                    "Job / Customer",
                    "Route (POL → POD)",
                    "Mode / Service",
                    "ETD",
                    "ETA",
                    "Status",
                    "D&D",
                    "Actions",
                  ].map((h) => (
                    <th className="border-b border-slate-200/80 px-3.5 py-3" key={h}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.data?.items.map((job: Job) => (
                  <tr
                    key={job.id}
                    className="transition-colors hover:bg-[#f7f6ff]/70"
                  >
                    <td className="px-3.5 py-3.5">
                      <Link
                        className="font-bold text-[#5e54c8] hover:underline"
                        href={
                          job.is_draft
                            ? `/shipments/new?draft=${job.id}`
                            : `/shipments/${job.id}`
                        }
                      >
                        {job.ref_number}
                      </Link>
                      <p className="mt-0.5 text-[11px] font-medium text-slate-600">
                        {job.customer_name}
                        {job.assigned_name && (
                          <span className="ml-1.5 text-[10px] text-slate-400">
                            · {job.assigned_name}
                          </span>
                        )}
                      </p>
                    </td>
                    <td className="px-3.5 font-medium text-slate-800">
                      <span className="inline-flex items-center gap-1.5">
                        <span>{job.origin}</span>
                        <ArrowRight size={11} className="text-slate-400" />
                        <span>{job.destination}</span>
                      </span>
                    </td>
                    <td className="px-3.5">
                      <div className="flex items-center gap-2">
                        <ModeBadge mode={job.transport_mode} />
                        {job.service_type && (
                          <span className="text-[10.5px] uppercase text-slate-500">
                            {job.service_type}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3.5 tabular-nums text-slate-600">
                      {dateLabel(job.etd)}
                    </td>
                    <td className="px-3.5 tabular-nums text-slate-600">
                      {dateLabel(job.eta)}
                    </td>
                    <td className="px-3.5">
                      <StatusBadge status={job.status} />
                    </td>
                    <td
                      className={`px-3.5 text-[11px] capitalize ${
                        ["overdue", "critical"].includes(job.dd_risk)
                          ? "font-bold text-rose-600"
                          : "text-slate-500"
                      }`}
                    >
                      {job.dd_risk || "—"}
                    </td>
                    <td className="px-3.5">
                      <div className="flex items-center gap-2">
                        <Link
                          className={`${secondaryClass} !px-2.5 !py-1 text-[11px]`}
                          href={
                            job.is_draft
                              ? `/shipments/new?draft=${job.id}`
                              : `/shipments/new?edit=${job.id}`
                          }
                        >
                          Edit
                        </Link>
                        <Link
                          className="rounded-lg bg-[#f2f0fe] px-2.5 py-1 text-[11px] font-semibold text-[#5b52c4] transition hover:bg-[#e5e1fc]"
                          href={
                            job.is_draft
                              ? `/shipments/new?draft=${job.id}`
                              : `/shipments/${job.id}`
                          }
                        >
                          Open →
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {result.isLoading && (
              <p className="p-8 text-center text-xs text-slate-500">
                Loading jobs…
              </p>
            )}
            {result.data?.total === 0 && (
              <p className="p-8 text-center text-xs text-slate-500">
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
