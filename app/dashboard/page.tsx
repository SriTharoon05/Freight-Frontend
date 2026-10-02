"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/shell/app-shell";
import {
  Panel,
  Pager,
  ErrorBanner,
  secondaryClass,
} from "@/components/freight/shared";
import {
  freight,
  type Page,
  type Job,
  dateLabel,
  moneyLabel,
} from "@/lib/freight";
import { useAuthStore } from "@/lib/auth-store";
type Row = Record<string, any>;
export default function DashboardPage() {
  const user = useAuthStore((s) => s.user),
    [view, setView] = useState("Operations"),
    [kind, setKind] = useState("departures"),
    [page, setPage] = useState(1),
    [teamPage, setTeamPage] = useState(1);
  const finance = [
      "finance",
      "admin",
      "org_admin",
      "manager",
      "ops_manager",
    ].includes(user?.role || ""),
    manager = ["admin", "org_admin", "manager", "ops_manager"].includes(
      user?.role || "",
    );
  const stats = useQuery<Row>({
    queryKey: ["freight", user?.tenant_id, "dashboard"],
    queryFn: () => freight.get<Row>("/dashboard"),
    refetchInterval: 60000,
  });
  const watch = useQuery<Page<Job>>({
    queryKey: ["freight", user?.tenant_id, "watch", kind, page],
    queryFn: () => freight.get<Page<Job>>("/watch", { kind, page }),
    enabled: view === "Operations",
  });
  const workload = useQuery<Page<Row>>({
    queryKey: ["freight", user?.tenant_id, "workload", teamPage],
    queryFn: () => freight.get<Page<Row>>("/workload", { page: teamPage }),
    enabled: manager && view === "Team",
  });
  const data = stats.data as Row | undefined;
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-1 text-xs text-[#858693]">
            {new Intl.DateTimeFormat("en-GB", { dateStyle: "full" }).format(
              new Date(),
            )}
          </p>
        </div>
        <nav className="flex gap-2">
          {[
            "Operations",
            "Sales",
            ...(finance ? ["Finance"] : []),
            ...(manager ? ["Team"] : []),
          ].map((t) => (
            <button
              key={t}
              className={`${secondaryClass} ${t === view ? "!border-[#7068cf] !bg-[#f4f2ff] !text-[#7068cf]" : ""}`}
              onClick={() => setView(t)}
            >
              {t}
            </button>
          ))}
        </nav>
        <ErrorBanner error={stats.error} />
        {view === "Operations" && (
          <>
            <Panel title="Carrier on-time departures · ETD versus ATD">
              <div className="grid gap-3 md:grid-cols-3">
                {data?.carrier_performance?.map((c: Row) => (
                  <div key={c.id} className="rounded-xl border p-4">
                    <p className="text-xs font-semibold">{c.name}</p>
                    <strong className="mt-2 block text-2xl text-[#7068cf]">
                      {c.on_time_percent}%
                    </strong>
                    <p className="text-xs text-[#858693]">
                      {c.on_time} of {c.departures} actual departures on or
                      before ETD
                    </p>
                  </div>
                ))}
              </div>
              {!data?.carrier_performance?.length && (
                <p className="text-sm text-[#858693]">
                  No recorded actual departures.
                </p>
              )}
            </Panel>
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              {[
                ["Open jobs", data?.open_jobs],
                ["Completed shipments", data?.completed],
                ["Overdue milestones", data?.overdue_milestones],
                ["Customer alerts", data?.alerts],
              ].map(([label, value]) => (
                <Panel key={label} title={label}>
                  <strong className="text-3xl tracking-tight">
                    {value ?? "—"}
                  </strong>
                </Panel>
              ))}
            </div>
            <Panel title="Shipment pipeline">
              <div className="flex flex-wrap gap-3">
                {Object.entries(data?.statuses || {}).map(([status, count]) => (
                  <div
                    key={status}
                    className="min-w-32 flex-1 rounded-xl bg-[#f7f6fb] p-4"
                  >
                    <strong className="text-xl text-[#7068cf]">
                      {String(count)}
                    </strong>
                    <p className="mt-2 text-[10px] capitalize text-[#858693]">
                      {status.replaceAll("_", " ")}
                    </p>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel
              title="Operations watch"
              action={
                <span className="text-xs text-[#858693]">
                  {data?.pending_documents ?? 0} documents pending issuance
                </span>
              }
            >
              <div className="mb-4 flex flex-wrap gap-2">
                {[
                  ["departures", "ETD · next 14 days"],
                  ["arrivals", "ETA · next 14 days"],
                  ["dd", "D&D risk"],
                  ["overdue", "Overdue milestones"],
                  ["completed", "Completed"],
                ].map(([k, label]) => (
                  <button
                    key={k}
                    className={`${secondaryClass} ${kind === k ? "!text-[#7068cf] !bg-[#f4f2ff]" : ""}`}
                    onClick={() => {
                      setKind(k);
                      setPage(1);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <ErrorBanner error={watch.error} />
              <div className="overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b text-[10px] text-[#858693]">
                    <tr>
                      {[
                        "Job / Customer",
                        "Route",
                        "ETD",
                        "ETA",
                        "Status",
                        "Free time",
                      ].map((h) => (
                        <th key={h} className="p-3">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {watch.data?.items.map((j: Job) => (
                      <tr key={j.id} className="border-b border-[#f2f0f7]">
                        <td className="p-3">
                          <Link
                            className="font-semibold text-[#7068cf]"
                            href={`/shipments/${j.id}`}
                          >
                            {j.ref_number}
                          </Link>
                          <p className="text-[10px] text-[#858693]">
                            {j.customer_name}
                            {j.assigned_name && (
                              <span className="block">{j.assigned_name}</span>
                            )}
                          </p>
                        </td>
                        <td>
                          {j.origin} → {j.destination}
                        </td>
                        <td>{dateLabel(j.etd)}</td>
                        <td>{dateLabel(j.eta)}</td>
                        <td className="text-[10px]">
                          {j.status.replaceAll("_", " ")}
                        </td>
                        <td
                          className={
                            ["critical", "overdue"].includes(j.dd_risk)
                              ? "text-red-600"
                              : ""
                          }
                        >
                          {dateLabel(j.free_time_expires_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager
                page={page}
                total={watch.data?.total || 0}
                limit={20}
                onChange={setPage}
              />
            </Panel>
          </>
        )}
        {view === "Sales" && (
          <>
            <Panel
              title="RFQ conversion funnel"
              action={
                <Link href="/rfqs" className={secondaryClass}>
                  Open RFQs
                </Link>
              }
            >
              <div className="grid gap-4 md:grid-cols-5">
                {["new", "quoted", "won", "lost", "no_rate"].map((stage) => (
                  <div key={stage} className="rounded-xl bg-[#f4f2ff] p-5">
                    <strong className="text-2xl text-[#7068cf]">
                      {data?.rfq_stages?.[stage] || 0}
                    </strong>
                    <p className="mt-2 text-xs capitalize">
                      {stage.replace("_", " ")}
                    </p>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Average quote response time">
              <strong
                className={`text-3xl ${Number(data?.average_response_hours) > 24 ? "text-red-600" : "text-[#7068cf]"}`}
              >
                {data?.average_response_hours == null
                  ? "—"
                  : Number(data.average_response_hours).toFixed(1) + " hours"}
              </strong>
            </Panel>
            <div className="grid gap-5 md:grid-cols-2">
              <Panel title="Win rate by mode">
                <div className="space-y-4">
                  {data?.win_by_mode?.map((r: Row) => (
                    <div key={r.name}>
                      <div className="mb-2 flex justify-between text-xs">
                        <span className="capitalize">{r.name}</span>
                        <strong>
                          {r.decided
                            ? Math.round((r.won / r.decided) * 100)
                            : 0}
                          %
                        </strong>
                      </div>
                      <div className="h-2 rounded-full bg-[#f0effc]">
                        <div
                          className="h-2 rounded-full bg-[#7068cf]"
                          style={{
                            width: `${r.decided ? (r.won / r.decided) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel title="Lost RFQ analysis">
                <div className="space-y-3">
                  {data?.loss_reasons?.map((r: Row) => (
                    <div
                      key={r.name}
                      className="flex justify-between border-b border-[#f2f0f7] py-3 text-xs"
                    >
                      <span className="capitalize">
                        {r.name || "Unspecified"}
                      </span>
                      <strong>{r.count}</strong>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </>
        )}
        {view === "Finance" && (
          <>
            <div className="grid gap-4 xl:grid-cols-2">
              {["top", "bottom"].map((kind) => (
                <Panel
                  key={kind}
                  title={`${kind === "top" ? "Highest" : "Lowest"} margin jobs · this month`}
                >
                  <div className="space-y-3">
                    {data?.margin_jobs?.[kind]?.map((j: Row) => (
                      <Link
                        key={j.id}
                        href={`/shipments/${j.id}`}
                        className="block rounded-xl border p-3 text-xs"
                      >
                        <div className="flex justify-between font-semibold">
                          <span>
                            {j.shipment_ref} · {j.customer}
                          </span>
                          <span>{Number(j.margin_percent).toFixed(1)}%</span>
                        </div>
                        <p className="mt-2 text-[#858693]">
                          ETD {dateLabel(j.etd)} · ETA {dateLabel(j.eta)}
                        </p>
                        <p className="mt-2">
                          Profit {moneyLabel(Number(j.sell) - Number(j.buy))}
                        </p>
                      </Link>
                    ))}
                  </div>
                  {!data?.margin_jobs?.[kind]?.length && (
                    <p className="text-sm text-[#858693]">
                      No revenue charges recorded this month.
                    </p>
                  )}
                </Panel>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {["month", "quarter", "year"].map((period) => (
                <Panel key={period} title={`Issued revenue · this ${period}`}>
                  <strong className="text-2xl text-[#7068cf]">
                    {moneyLabel(data?.issued_revenue_usd?.[period])}
                  </strong>
                </Panel>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                ["Sell charges", data?.charges_usd?.sell],
                ["Buy charges", data?.charges_usd?.buy],
                [
                  "Job profit / loss",
                  Number(data?.charges_usd?.sell || 0) -
                    Number(data?.charges_usd?.buy || 0),
                ],
              ].map(([label, value]) => (
                <Panel title={label} key={label}>
                  <strong className="text-2xl">{moneyLabel(value)}</strong>
                </Panel>
              ))}
            </div>
            <Panel title="Sales invoices">
              <div className="grid grid-cols-4 gap-4">
                {["draft", "issued", "sent", "paid"].map((status) => (
                  <div key={status}>
                    <strong className="text-2xl">
                      {data?.invoices_by_status?.[status] || 0}
                    </strong>
                    <p className="mt-2 text-xs capitalize text-[#858693]">
                      {status}
                    </p>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Receivables aging · USD">
              <div className="grid grid-cols-4 gap-4">
                {["0–30", "30–60", "60–90", "90+"].map((bucket) => (
                  <div key={bucket}>
                    <p className="text-[10px] text-[#858693]">{bucket} days</p>
                    <strong
                      className={`mt-2 block text-lg ${bucket === "90+" ? "text-red-600" : ""}`}
                    >
                      {moneyLabel(data?.receivables_aging_usd?.[bucket])}
                    </strong>
                  </div>
                ))}
              </div>
            </Panel>
          </>
        )}
        {view === "Team" && (
          <Panel title="Team workload">
            <ErrorBanner error={workload.error} />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {workload.data?.items.map((p: Row) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-[#eeecf5] p-5"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${p.risk === "red" ? "bg-red-500" : p.risk === "amber" ? "bg-amber-400" : "bg-emerald-500"}`}
                    />
                    <Link
                      href={`/shipments?assigned_user_id=${p.id}`}
                      className="text-sm font-semibold text-[#7068cf]"
                    >
                      {p.name}
                    </Link>
                  </div>
                  <p className="mt-3 text-2xl font-semibold">
                    {p.open_jobs}
                    <span className="ml-2 text-xs font-normal text-[#858693]">
                      open jobs
                    </span>
                  </p>
                  <div className="mt-3 grid grid-cols-3 text-[10px] text-[#858693]">
                    <span>{p.overdue} overdue</span>
                    <span>{p.alerts} alerts</span>
                    <span>{p.departing_48h} ETD ≤48h</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(p.by_status).map(([status, count]) => (
                      <span
                        key={status}
                        className="rounded-full bg-[#f4f2ff] px-2 py-1 text-[10px]"
                      >
                        {String(count)} {status.replaceAll("_", " ")}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <Pager
              page={teamPage}
              total={workload.data?.total || 0}
              limit={20}
              onChange={setTeamPage}
            />
          </Panel>
        )}
      </div>
    </AppShell>
  );
}
