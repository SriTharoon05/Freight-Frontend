"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { freight, type Page, type Job, dateLabel } from "@/lib/freight";
import { useAuthStore } from "@/lib/auth-store";
import { Panel, PageHero, StatusBadge, Pager, ErrorBanner } from "./shared";

export function JobRegister({ kind }: { kind: "dd" | "audit" }) {
  const user = useAuthStore((s) => s.user),
    [page, setPage] = useState(1);
  const data = useQuery<Page<Job>>({
    queryKey: ["freight", user?.tenant_id, "register", kind, page],
    queryFn: () =>
      freight.get<Page<Job>>(kind === "dd" ? "/watch" : "/jobs", {
        page,
        ...(kind === "dd" ? { kind: "dd" } : {}),
      }),
  });
  return (
    <AppShell>
      <div className="space-y-6">
        <PageHero
          eyebrow={kind === "dd" ? "Demurrage & Detention Shield" : "Revenue & Cost Governance"}
          title={kind === "dd" ? "Container Free-Time & D&D Watch" : "Invoice, Buy/Sell Margin & 4-Way Audit"}
          subtitle={
            kind === "dd"
              ? "Proactively clear customs and return empty equipment before port demurrage or carrier detention clocks expire."
              : "Audit vendor bills against contracted rate cards, verify buy-vs-sell job margins, and manage customer billing."
          }
        />
        <Panel
          title={kind === "dd" ? "Free time exposure" : "Job financial records"}
          action={
            <span className="text-xs font-medium tabular-nums text-slate-500">
              {data.data?.total ?? 0} records
            </span>
          }
        >
          <ErrorBanner error={data.error} />
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  {[
                    "Job / Customer",
                    "Route (POL → POD)",
                    "ETD",
                    "ETA",
                    kind === "dd" ? "Free time expires" : "Status",
                    "Actions",
                  ].map((h) => (
                    <th className="border-b border-slate-200/80 px-3.5 py-3" key={h}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.data?.items.map((j: Job) => (
                  <tr key={j.id} className="transition-colors hover:bg-[#f7f6ff]/70">
                    <td className="px-3.5 py-3.5">
                      <strong className="text-slate-900">{j.ref_number}</strong>
                      <p className="mt-0.5 text-[11px] text-slate-500">{j.customer_name}</p>
                    </td>
                    <td className="px-3.5 font-medium text-slate-800">
                      <span className="inline-flex items-center gap-1.5">
                        <span>{j.origin}</span>
                        <ArrowRight size={11} className="text-slate-400" />
                        <span>{j.destination}</span>
                      </span>
                    </td>
                    <td className="px-3.5 tabular-nums text-slate-600">{dateLabel(j.etd)}</td>
                    <td className="px-3.5 tabular-nums text-slate-600">{dateLabel(j.eta)}</td>
                    <td className="px-3.5">
                      {kind === "dd" ? (
                        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                          {dateLabel(j.free_time_expires_at)}
                        </span>
                      ) : (
                        <StatusBadge status={j.status} />
                      )}
                    </td>
                    <td className="px-3.5">
                      <div className="flex items-center gap-2">
                        <Link
                          className="rounded-lg bg-[#f2f0fe] px-2.5 py-1 text-[11px] font-semibold text-[#5b52c4] transition hover:bg-[#e5e1fc]"
                          href={`/shipments/${j.id}?tab=${kind === "dd" ? "Milestones" : "Audit"}`}
                        >
                          {kind === "dd" ? "Open milestones →" : "Audit →"}
                        </Link>
                        {kind === "audit" && (
                          <Link
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50"
                            href={`/shipments/${j.id}?tab=Documents`}
                          >
                            Invoices
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.data?.total === 0 && (
            <p className="p-8 text-center text-xs text-slate-500">
              {kind === "dd"
                ? "No jobs within the D&D warning window."
                : "No jobs found."}
            </p>
          )}
          <Pager
            page={page}
            total={data.data?.total || 0}
            limit={20}
            onChange={setPage}
          />
        </Panel>
      </div>
    </AppShell>
  );
}
