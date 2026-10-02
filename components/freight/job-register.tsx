"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/shell/app-shell";
import { freight, type Page, type Job, dateLabel } from "@/lib/freight";
import { useAuthStore } from "@/lib/auth-store";
import { Panel, Pager, ErrorBanner } from "./shared";

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
        <h1 className="text-2xl font-semibold">
          {kind === "dd" ? "D&D Watch" : "Invoice & Audit"}
        </h1>
        <Panel
          title={kind === "dd" ? "Free time exposure" : "Job financial records"}
        >
          <ErrorBanner error={data.error} />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b text-[#858693]">
                  {[
                    "Job / Customer",
                    "Route",
                    "ETD",
                    "ETA",
                    kind === "dd" ? "Free time expires" : "Status",
                    "Actions",
                  ].map((h) => (
                    <th className="p-3" key={h}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.data?.items.map((j: Job) => (
                  <tr key={j.id} className="border-b">
                    <td className="p-3">
                      <strong>{j.ref_number}</strong>
                      <p className="mt-1 text-[#858693]">{j.customer_name}</p>
                    </td>
                    <td className="p-3">
                      {j.origin} → {j.destination}
                    </td>
                    <td className="p-3">{dateLabel(j.etd)}</td>
                    <td className="p-3">{dateLabel(j.eta)}</td>
                    <td className="p-3">
                      {kind === "dd"
                        ? dateLabel(j.free_time_expires_at)
                        : j.status.replaceAll("_", " ")}
                    </td>
                    <td className="p-3">
                      <Link
                        className="font-semibold text-[#7068cf]"
                        href={`/shipments/${j.id}?tab=${kind === "dd" ? "Milestones" : "Audit"}`}
                      >
                        {kind === "dd" ? "Open milestones" : "Audit"}
                      </Link>
                      {kind === "audit" && (
                        <Link
                          className="ml-4 text-[#7068cf]"
                          href={`/shipments/${j.id}?tab=Documents`}
                        >
                          Invoices
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.data?.total === 0 && (
            <p className="p-6 text-sm text-[#858693]">
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
