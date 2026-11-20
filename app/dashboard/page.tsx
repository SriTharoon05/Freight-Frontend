"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Gauge,
  Globe,
  Inbox,
  Layers,
  Package,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  Users,
} from "lucide-react";
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
import { MilestoneBoard } from "@/components/freight/milestone-board";
import {
  CarrierPerformanceChart,
  DonutBreakdownChart,
  GlobalCorridorMap,
  KpiSparkCard,
  LanePerformanceHeatmap,
  LifecyclePipelineBar,
  MultiSeriesTrendChart,
  RadialGaugeCard,
  UtilizationBars,
  type CorridorLane,
} from "@/components/freight/dashboard-visuals";

type Row = Record<string, any>;

const DASHBOARD_SUBTITLES: Record<string, string> = {
  Operations:
    "End-to-end shipment visibility, trade-lane OTP reliability, carrier schedule adherence, and live operational watch.",
  Exceptions:
    "Proactive SLA breach prevention across vendor milestones, D&D free-time exposure, post-ETD documents, and escalations.",
  Sales:
    "Commercial quoting velocity, RFQ conversion funnel, win-rate intelligence by mode, and procurement bottlenecks.",
  Finance:
    "Realized gross margin, buy-vs-sell job profitability, issued billing velocity, and receivables aging risk.",
  Team:
    "Operator capacity utilization against threshold targets, imminent 48h departures, and workload risk balancing.",
};

export default function DashboardPage() {
  const client = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedView = searchParams?.get("view");

  const [attentionError, setAttentionError] = useState<unknown>(null);
  const [acknowledging, setAcknowledging] = useState("");
  const user = useAuthStore((s) => s.user);
  const [view, setView] = useState("Operations");
  const [days, setDays] = useState(180);
  const [modeFilter, setModeFilter] = useState("all");
  const [kind, setKind] = useState("departures");
  const [page, setPage] = useState(1);
  const [teamPage, setTeamPage] = useState(1);

  const finance = [
    "finance",
    "admin",
    "org_admin",
    "manager",
    "ops_manager",
  ].includes(user?.role || "");
  const manager = ["admin", "org_admin", "manager", "ops_manager"].includes(
    user?.role || "",
  );

  const availableViews = [
    { key: "Operations", label: "Operations Control", icon: Globe },
    { key: "Exceptions", label: "Exceptions & Risk", icon: ShieldAlert },
    { key: "Sales", label: "Commercial & RFQ", icon: TrendingUp },
    ...(finance ? [{ key: "Finance", label: "Executive Finance", icon: DollarSign }] : []),
    ...(manager ? [{ key: "Team", label: "Team Capacity", icon: Users }] : []),
  ];

  useEffect(() => {
    if (
      requestedView &&
      ["Operations", "Exceptions", "Sales", "Finance", "Team"].includes(requestedView)
    ) {
      if (requestedView === "Finance" && !finance) return;
      if (requestedView === "Team" && !manager) return;
      setView(requestedView);
    }
  }, [requestedView, finance, manager]);

  function selectDashboard(nextView: string) {
    setView(nextView);
    try {
      router.replace(
        nextView === "Operations" ? "/dashboard" : `/dashboard?view=${nextView}`,
      );
    } catch {}
  }

  const stats = useQuery<Row>({
    queryKey: ["freight", user?.tenant_id, "dashboard", days, modeFilter],
    queryFn: () =>
      freight.get<Row>("/dashboard", {
        days,
        ...(modeFilter !== "all" ? { mode: modeFilter } : {}),
      }),
    refetchInterval: 60000,
  });

  const watch = useQuery<Page<Job>>({
    queryKey: ["freight", user?.tenant_id, "watch", kind, page],
    queryFn: () => freight.get<Page<Job>>("/watch", { kind, page }),
    enabled: view === "Operations" || view === "Exceptions",
  });

  const workload = useQuery<Page<Row>>({
    queryKey: ["freight", user?.tenant_id, "workload", teamPage],
    queryFn: () => freight.get<Page<Row>>("/workload", { page: teamPage }),
    enabled: manager && view === "Team",
  });

  const data = stats.data as Row | undefined;
  const kpis = (data?.overview_kpis || {}) as Row;
  const trends = (data?.monthly_trends || []) as Row[];
  const lanes = (data?.lane_performance || []) as CorridorLane[];
  const exc = (data?.exception_summary || {}) as Row;

  const shipSpark = trends.map((t) => Number(t.shipments || 0));
  const delivSpark = trends.map((t) => Number(t.delivered || 0));
  const delaySpark = trends.map((t) => Number(t.delayed || 0));
  const rfqSpark = trends.map((t) => Number(t.rfqs || 0));
  const profitSpark = trends.map((t) => Number(t.profit_usd || 0));
  const sellSpark = trends.map((t) => Number(t.sell_usd || 0));

  const otpPct =
    kpis.on_time_departure_pct ??
    (data?.carrier_performance?.length
      ? Number(
          (
            data.carrier_performance.reduce(
              (acc: number, c: Row) => acc + Number(c.on_time_percent || 0),
              0,
            ) / data.carrier_performance.length
          ).toFixed(1),
        )
      : 100);
  const otaPct = kpis.on_time_arrival_pct ?? otpPct;
  const totalExceptions =
    exc.total ??
    Number(data?.overdue_milestones || 0) +
      Number(data?.alerts || 0) +
      Number(data?.critical_mail_count || 0);

  // Sales aggregates
  const totalDecidedRfqs = (data?.win_by_mode || []).reduce(
    (s: number, r: Row) => s + Number(r.decided || 0),
    0,
  );
  const totalWonRfqs = (data?.win_by_mode || []).reduce(
    (s: number, r: Row) => s + Number(r.won || 0),
    0,
  );
  const overallWinRate = totalDecidedRfqs
    ? Number(((totalWonRfqs * 100) / totalDecidedRfqs).toFixed(1))
    : 0;
  const avgRespHours =
    data?.average_response_hours == null
      ? null
      : Number(data.average_response_hours);
  const slaCompliancePct =
    avgRespHours === null
      ? 100
      : Math.max(0, Math.min(100, Number((100 - Math.max(0, avgRespHours - 4) * 3).toFixed(1))));

  // Finance aggregates
  const totalSellUsd = Number(data?.charges_usd?.sell || 0);
  const totalBuyUsd = Number(data?.charges_usd?.buy || 0);
  const netProfitUsd = totalSellUsd - totalBuyUsd;
  const grossMarginPct =
    totalSellUsd > 0 ? Number(((netProfitUsd * 100) / totalSellUsd).toFixed(1)) : 0;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* ── Executive Command Banner & Multi-Dashboard Switcher ───────────── */}
        <section className="overflow-hidden rounded-2xl border border-[#2a2752] bg-gradient-to-r from-[#181732] via-[#232048] to-[#2c275c] p-5 text-white shadow-sm sm:p-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9da8d6]">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Control Tower Live
                </span>
                <span>•</span>
                <span>
                  {new Intl.DateTimeFormat("en-GB", { dateStyle: "full" }).format(
                    new Date(),
                  )}
                </span>
              </div>
              <h1 className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">
                Freight Forwarding Command Center
              </h1>
              <p className="mt-1 max-w-2xl text-xs text-[#b9c2e3]">
                {DASHBOARD_SUBTITLES[view] || DASHBOARD_SUBTITLES.Operations}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <label className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white">
                <Clock size={13} className="text-[#9da8d6]" />
                <span className="sr-only">Analytics window</span>
                <select
                  aria-label="Analytics window"
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="bg-transparent text-xs font-medium text-white outline-none [&>option]:text-[#171725]"
                >
                  <option value={30}>Last 30 days</option>
                  <option value={90}>Last 90 days</option>
                  <option value={180}>Last 6 months</option>
                  <option value={365}>Last 12 months</option>
                </select>
              </label>

              <label className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white">
                <Layers size={13} className="text-[#9da8d6]" />
                <span className="sr-only">Transport mode filter</span>
                <select
                  aria-label="Transport mode filter"
                  value={modeFilter}
                  onChange={(e) => setModeFilter(e.target.value)}
                  className="bg-transparent text-xs font-medium text-white outline-none [&>option]:text-[#171725]"
                >
                  <option value="all">All Modes</option>
                  <option value="ocean">Ocean (FCL/LCL)</option>
                  <option value="air">Air Freight</option>
                  <option value="road">Road / Inland</option>
                </select>
              </label>

              <button
                type="button"
                onClick={() => void stats.refetch()}
                disabled={stats.isFetching}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20 disabled:opacity-50"
              >
                <RefreshCw size={13} className={stats.isFetching ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
          </div>

          {/* Coordinated Multi-Dashboard Navigation Bar */}
          <nav
            aria-label="Control tower dashboards"
            className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4"
          >
            {availableViews.map(({ key, label, icon: Icon }) => {
              const active = view === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => selectDashboard(key)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                    active
                      ? "bg-white text-[#1e1b3a] shadow-sm"
                      : "bg-white/5 text-[#cbd5f5] hover:bg-white/15 hover:text-white"
                  }`}
                >
                  <Icon size={14} className={active ? "text-[#7068cf]" : "text-[#9da8d6]"} />
                  {label}
                  {key === "Exceptions" && totalExceptions > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                        active
                          ? "bg-rose-100 text-rose-700"
                          : "bg-rose-500/30 text-rose-200"
                      }`}
                    >
                      {totalExceptions}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </section>

        <ErrorBanner error={attentionError} />
        <ErrorBanner error={stats.error} />

        {/* Mailbox connection warning banner if any sync/fallback issue exists */}
        {(!!data?.mail_connection_errors?.length ||
          !!data?.analysis_states?.rules_fallback) && (
          <Panel title="Mailbox processing needs attention">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3">
              <div>
                <p className="text-xs font-medium text-amber-900">
                  {data?.analysis_states?.rules_fallback || 0} messages use fallback
                  classification after an analysis error. Retries are bounded;
                  ambiguous messages need review.
                </p>
                {data?.mail_connection_errors?.map((box: Row) => (
                  <p key={box.address} className="mt-1 text-xs text-amber-800">
                    {box.address}: {box.error} · Retry {dateLabel(box.retry_at)}
                  </p>
                ))}
              </div>
              <Link
                className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[#7068cf] shadow-sm"
                href="/settings"
              >
                View connection &amp; sync state <ArrowUpRight size={13} />
              </Link>
            </div>
          </Panel>
        )}

        {/* ═════════════════════════════════════════════════════════════════════
            DASHBOARD 1: OPERATIONS CONTROL TOWER
           ═════════════════════════════════════════════════════════════════════ */}
        {view === "Operations" && (
          <>
            {/* 6 Hero KPI Cards with Sparklines & Period Deltas */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
              <KpiSparkCard
                label="Active Shipments"
                value={data?.open_jobs ?? 0}
                delta={kpis.active_delta_pct}
                deltaLabel="vs prior 30d"
                sparkline={shipSpark}
                tone="indigo"
                icon={<Package size={17} />}
                href="/shipments"
              />
              <KpiSparkCard
                label="On-Time Departure"
                value={`${otpPct}%`}
                subtitle={`${data?.completed ?? 0} completed jobs`}
                sparkline={delivSpark}
                tone="emerald"
                icon={<CheckCircle2 size={17} />}
                href="/milestones"
              />
              <KpiSparkCard
                label="On-Time Arrival"
                value={`${otaPct}%`}
                subtitle={
                  kpis.avg_transit_days
                    ? `Avg transit ${kpis.avg_transit_days} days`
                    : "Schedule adherence"
                }
                sparkline={delivSpark}
                tone="teal"
                icon={<Globe size={17} />}
                href="/shipments"
              />
              <KpiSparkCard
                label="Exceptions & Overdue"
                value={
                  Number(data?.overdue_milestones || 0) + Number(data?.alerts || 0)
                }
                subtitle={`${data?.overdue_milestones ?? 0} overdue · ${data?.alerts ?? 0} alerts`}
                sparkline={delaySpark}
                invertDelta
                tone="rose"
                icon={<AlertTriangle size={17} />}
                onClick={() => selectDashboard("Exceptions")}
              />
              <KpiSparkCard
                label="D&D Free-Time Risk"
                value={kpis.dd_at_risk ?? 0}
                subtitle={`${kpis.dd_overdue ?? 0} expired · container watch`}
                tone="amber"
                icon={<Clock size={17} />}
                href="/dd-watch"
              />
              <KpiSparkCard
                label="Doc Compliance"
                value={`${kpis.doc_compliance_pct ?? 100}%`}
                subtitle={`${data?.pending_documents ?? 0} post-ETD drafts`}
                tone="violet"
                icon={<FileText size={17} />}
                href="/documents"
              />
            </div>

            {/* Horizontal End-to-End Shipment Lifecycle Pipeline */}
            <Panel
              title="End-to-end shipment tracking pipeline"
              action={
                <span className="text-xs text-[#7c7d8c]">
                  {kpis.total_weight_kg
                    ? `${(Number(kpis.total_weight_kg) / 1000).toFixed(1)} MT · ${Number(kpis.total_volume_cbm || 0).toFixed(1)} CBM · ${kpis.total_containers || 0} TEU/Containers`
                    : `${(data?.open_jobs || 0) + (data?.completed || 0)} total shipments`}
                </span>
              }
            >
              <LifecyclePipelineBar
                stages={data?.lifecycle_pipeline}
                statuses={data?.statuses}
              />
            </Panel>

            {/* Global Trade Corridor Map + Trade-Lane Performance Heatmap */}
            <div className="grid gap-5 xl:grid-cols-12">
              <div className="xl:col-span-7">
                <GlobalCorridorMap
                  lanes={lanes}
                  summary={{
                    in_transit: Number(data?.open_jobs || 0),
                    delivered: Number(data?.completed || 0),
                    dd_at_risk: Number(kpis.dd_at_risk || 0),
                    delayed: Number(kpis.delayed_shipments || 0),
                  }}
                />
              </div>
              <div className="xl:col-span-5">
                <Panel
                  title="Trade-lane reliability heatmap (POL × POD)"
                  action={
                    <Link href="/rates" className="text-xs font-semibold text-[#7068cf]">
                      Lane tariffs →
                    </Link>
                  }
                >
                  <LanePerformanceHeatmap lanes={lanes} />
                </Panel>
              </div>
            </div>

            {/* Shipments Over Time Trend + Carrier Schedule Reliability + Mode Split */}
            <div className="grid gap-5 xl:grid-cols-12">
              <div className="xl:col-span-5">
                <Panel title="Shipments & delivery performance over time">
                  <MultiSeriesTrendChart
                    data={trends}
                    series={[
                      { key: "shipments", label: "Total Booked", color: "#7068cf", kind: "area" },
                      { key: "delivered", label: "Delivered", color: "#10b981", kind: "line" },
                      { key: "delayed", label: "Delayed / Exception", color: "#e11d48", kind: "line" },
                    ]}
                  />
                </Panel>
              </div>

              <div className="xl:col-span-4">
                <Panel title="Carrier schedule reliability · ATD vs ETD">
                  <CarrierPerformanceChart carriers={data?.carrier_performance} />
                </Panel>
              </div>

              <div className="xl:col-span-3">
                <Panel title="Volume by transport mode">
                  <DonutBreakdownChart
                    centerValue={kpis.total_shipments ?? (data?.open_jobs || 0) + (data?.completed || 0)}
                    centerLabel="Shipments"
                    segments={
                      data?.mode_breakdown?.length
                        ? data.mode_breakdown.map((m: Row, i: number) => ({
                            label:
                              String(m.mode).charAt(0).toUpperCase() +
                              String(m.mode).slice(1),
                            value: Number(m.shipments || 0),
                            color: ["#7068cf", "#3da7bc", "#10b981", "#f59e0b"][i % 4],
                            href: "/shipments",
                          }))
                        : [
                            { label: "Ocean", value: 0, color: "#7068cf" },
                            { label: "Air", value: 0, color: "#3da7bc" },
                            { label: "Road", value: 0, color: "#10b981" },
                          ]
                    }
                  />
                </Panel>
              </div>
            </div>

            {/* Correspondence & Job Preparation Action Ribbon */}
            <Panel
              title="Correspondence and job preparation"
              action={
                <Link href="/rfqs" className="text-xs font-semibold text-[#7068cf]">
                  Open quoting desk →
                </Link>
              }
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  ["Customer RFQs", data?.mail_pipeline?.rfq, "/rfqs", "border-l-[#7068cf]"],
                  ["Potential jobs", data?.mail_pipeline?.potential, "/rfqs?tab=potential", "border-l-[#3da7bc]"],
                  ["Jobs to create", data?.mail_pipeline?.ready, "/rfqs?tab=ready", "border-l-emerald-500"],
                  [
                    "Carrier / agent replies",
                    data?.mail_pipeline?.supplier_rates,
                    "/emails?workflow=supplier_rates",
                    "border-l-blue-500",
                  ],
                  [
                    "Saved job forms · Draft",
                    data?.saved_drafts,
                    "/shipments?status=draft",
                    "border-l-amber-500",
                  ],
                  [
                    "Procurement flagged",
                    data?.rfq_stages?.no_rate,
                    "/rfqs?tab=prepared&status=no_rate",
                    "border-l-rose-500",
                  ],
                ].map(([label, count, href, accent]) => (
                  <Link
                    key={String(label)}
                    href={String(href)}
                    className={`group rounded-xl border border-[#eeecf5] border-l-4 ${accent} bg-[#fbfbfe] p-3.5 transition hover:bg-[#f4f2ff]`}
                  >
                    <div className="flex items-center justify-between">
                      <strong className="text-2xl font-bold text-[#171725] tabular-nums group-hover:text-[#7068cf]">
                        {count ?? 0}
                      </strong>
                      <ArrowUpRight
                        size={14}
                        className="text-[#a0a1b0] transition group-hover:text-[#7068cf]"
                      />
                    </div>
                    <p className="mt-1 text-xs font-medium text-[#5c5d6d]">{label}</p>
                  </Link>
                ))}
              </div>
            </Panel>

            {/* Critical Correspondence Triage Queue */}
            <Panel
              title={`Critical correspondence · ${data?.critical_mail_count ?? 0} needs attention`}
              action={
                <Link
                  href="/emails?workflow=all"
                  className="text-xs font-semibold text-[#7068cf]"
                >
                  All correspondence →
                </Link>
              }
            >
              {!data?.critical_mail?.length && (
                <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50/70 px-4 py-3 text-xs text-emerald-800">
                  <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
                  No unacknowledged critical correspondence. Customer SLA inbox is clear.
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                {data?.critical_mail?.map((mail: Row) => (
                  <article
                    key={mail.id}
                    className="flex flex-col justify-between rounded-xl border border-rose-200 bg-rose-50/70 p-4"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={mail.href}
                          className="text-sm font-semibold text-rose-900 hover:underline"
                        >
                          {mail.subject || "(No subject)"}
                        </Link>
                        <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-rose-800">
                          {mail.category?.replaceAll("_", " ")}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-rose-700">
                        {mail.sender} · {dateLabel(mail.received_at)}
                      </p>
                      <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-rose-950">
                        {(mail.summary_bullets?.length
                          ? mail.summary_bullets
                          : [mail.reason]
                        ).map((bullet: string, index: number) => (
                          <li key={index}>{bullet}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="mt-3 flex items-center justify-end">
                      <button
                        className={secondaryClass}
                        disabled={!!acknowledging}
                        onClick={async () => {
                          setAcknowledging(mail.id);
                          setAttentionError(null);
                          try {
                            await freight.post(
                              `/mail-attention/${mail.id}/acknowledge`,
                              {},
                            );
                            await client.invalidateQueries({
                              queryKey: ["freight", user?.tenant_id, "dashboard"],
                            });
                          } catch (error) {
                            setAttentionError(error);
                          } finally {
                            setAcknowledging("");
                          }
                        }}
                      >
                        Acknowledge review
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              {!!data?.critical_mail_count && (
                <p className="mt-3 text-xs text-[#777884]">
                  Acknowledgment records your review. A later critical email appears
                  again. Showing the latest 10.
                </p>
              )}
            </Panel>

            {/* Live Vendor Milestone & D&D Risk Board */}
            <MilestoneBoard compact />

            {/* Operations Watch Queue */}
            <Panel
              title="Operations watch"
              action={
                <span className="rounded-full bg-[#f4f2ff] px-3 py-1 text-xs font-medium text-[#655dc4]">
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
                    className={`${secondaryClass} ${
                      kind === k ? "!border-[#7068cf] !bg-[#f4f2ff] !text-[#7068cf]" : ""
                    }`}
                    aria-pressed={kind === k}
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
              <div className="overflow-auto rounded-xl border border-[#eeecf5]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f7f6fb] text-[10px] uppercase text-[#7c7d8c]">
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
                      <tr
                        key={j.id}
                        className="border-t border-[#f2f0f7] hover:bg-[#fbfbfe]"
                      >
                        <td className="p-3">
                          <Link
                            className="font-semibold text-[#7068cf] hover:underline"
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
                        <td className="p-3 font-medium">
                          {j.origin} → {j.destination}
                        </td>
                        <td className="p-3 whitespace-nowrap">{dateLabel(j.etd)}</td>
                        <td className="p-3 whitespace-nowrap">{dateLabel(j.eta)}</td>
                        <td className="p-3">
                          <span className="rounded-full bg-[#f4f2ff] px-2.5 py-1 text-[10px] font-semibold capitalize text-[#554db7]">
                            {j.status.replaceAll("_", " ")}
                          </span>
                        </td>
                        <td
                          className={`p-3 whitespace-nowrap ${
                            ["critical", "overdue"].includes(j.dd_risk)
                              ? "font-semibold text-rose-600"
                              : ""
                          }`}
                        >
                          {dateLabel(j.free_time_expires_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {watch.data?.total === 0 && (
                  <p className="p-6 text-center text-xs text-[#858693]">
                    No shipments match this watch filter.
                  </p>
                )}
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

        {/* ═════════════════════════════════════════════════════════════════════
            DASHBOARD 2: EXCEPTIONS & SLA RISK DESK (Proactive Control Tower)
           ═════════════════════════════════════════════════════════════════════ */}
        {view === "Exceptions" && (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
              <KpiSparkCard
                label="Total Active Risks"
                value={totalExceptions}
                subtitle={`${exc.severity?.high ?? 0} high severity`}
                sparkline={delaySpark}
                invertDelta
                tone="rose"
                icon={<ShieldAlert size={17} />}
              />
              <KpiSparkCard
                label="Overdue Milestones"
                value={data?.overdue_milestones ?? 0}
                subtitle="Missed target timestamps"
                tone="rose"
                icon={<AlertTriangle size={17} />}
                href="/milestones"
              />
              <KpiSparkCard
                label="D&D Exposure"
                value={kpis.dd_at_risk ?? 0}
                subtitle={`${kpis.dd_overdue ?? 0} past free-time expiry`}
                tone="amber"
                icon={<Clock size={17} />}
                href="/dd-watch"
              />
              <KpiSparkCard
                label="Open Escalations"
                value={data?.alerts ?? 0}
                subtitle="Unresolved SLA triggers"
                tone="amber"
                icon={<Activity size={17} />}
                href="/alerts"
              />
              <KpiSparkCard
                label="Critical Customer Mail"
                value={data?.critical_mail_count ?? 0}
                subtitle="Awaiting acknowledgment"
                tone="indigo"
                icon={<Inbox size={17} />}
                href="/emails?workflow=all"
              />
              <KpiSparkCard
                label="Post-ETD Draft Docs"
                value={data?.pending_documents ?? 0}
                subtitle={`${kpis.doc_compliance_pct ?? 100}% doc compliance`}
                tone="teal"
                icon={<FileText size={17} />}
                href="/documents"
              />
            </div>

            {/* 3-Column Exception Intelligence Grid (Mirrors Reference Image 3) */}
            <div className="grid gap-5 xl:grid-cols-12">
              {/* Exception Alerts Breakdown Table */}
              <div className="xl:col-span-5">
                <Panel title="Exception alerts by operational category">
                  <div className="divide-y divide-[#f1eff8] text-xs">
                    {(exc.by_category || []).map((cat: Row) => (
                      <Link
                        key={cat.key}
                        href={cat.href || "/dashboard"}
                        className="flex items-center justify-between gap-3 py-3 transition hover:bg-[#fbfbfe] px-2 rounded-lg"
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${
                              cat.severity === "high"
                                ? "bg-rose-500"
                                : cat.severity === "medium"
                                  ? "bg-amber-500"
                                  : "bg-[#3da7bc]"
                            }`}
                          />
                          <span className="font-medium text-[#2d2e3d]">{cat.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <strong
                            className={`text-sm tabular-nums ${
                              cat.count > 0 && cat.severity === "high"
                                ? "text-rose-600"
                                : "text-[#171725]"
                            }`}
                          >
                            {cat.count}
                          </strong>
                          <ArrowUpRight size={13} className="text-[#9a9ba8]" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </Panel>
              </div>

              {/* Risk Severity Distribution Donut */}
              <div className="xl:col-span-3">
                <Panel title="Risk severity distribution">
                  <DonutBreakdownChart
                    centerValue={totalExceptions}
                    centerLabel="At Risk"
                    segments={[
                      {
                        label: "High Risk (Immediate)",
                        value: Number(exc.severity?.high || 0),
                        color: "#e11d48",
                      },
                      {
                        label: "Medium Risk (Warning)",
                        value: Number(exc.severity?.medium || 0),
                        color: "#f59e0b",
                      },
                      {
                        label: "Low Risk (Compliance)",
                        value: Number(exc.severity?.low || 0),
                        color: "#3da7bc",
                      },
                    ]}
                  />
                </Panel>
              </div>

              {/* Top Trade Lanes At Risk */}
              <div className="xl:col-span-4">
                <Panel title="Top corridors at risk of delay / D&D">
                  <div className="space-y-3">
                    {lanes
                      .slice()
                      .sort((a, b) => (b.at_risk || 0) - (a.at_risk || 0))
                      .slice(0, 5)
                      .map((lane, idx) => {
                        const riskCount = lane.at_risk || 0;
                        const riskPct = lane.shipments
                          ? Math.min(100, Math.round((riskCount * 100) / lane.shipments))
                          : 0;
                        return (
                          <div
                            key={`${lane.origin_code}-${lane.dest_code}-${idx}`}
                            className="space-y-1 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-[#2d2e3d]">
                                {lane.origin_code} → {lane.dest_code}{" "}
                                <span className="text-[10px] font-normal uppercase text-[#858693]">
                                  ({lane.mode})
                                </span>
                              </span>
                              <span className="tabular-nums text-[#7c7d8c]">
                                <strong
                                  className={
                                    riskCount > 0 ? "text-rose-600" : "text-emerald-700"
                                  }
                                >
                                  {riskCount} at risk
                                </strong>{" "}
                                · {lane.on_time_pct}% OTP
                              </span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-[#f1eff9]">
                              <div
                                className={`h-full rounded-full ${
                                  riskPct >= 25
                                    ? "bg-rose-500"
                                    : riskPct > 0
                                      ? "bg-amber-500"
                                      : "bg-emerald-500"
                                }`}
                                style={{ width: `${Math.max(4, riskPct || 4)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    {!lanes.length && (
                      <p className="py-6 text-center text-xs text-[#858693]">
                        No active route delays detected.
                      </p>
                    )}
                  </div>
                </Panel>
              </div>
            </div>

            {/* Recent Unresolved Escalations Action Table + Exception Trend */}
            <div className="grid gap-5 xl:grid-cols-12">
              <div className="xl:col-span-7">
                <Panel
                  title="Recent unresolved job escalations"
                  action={
                    <Link href="/alerts" className="text-xs font-semibold text-[#7068cf]">
                      Open alert queue →
                    </Link>
                  }
                >
                  <div className="overflow-auto rounded-xl border border-[#eeecf5]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#f7f6fb] text-[10px] uppercase text-[#7c7d8c]">
                        <tr>
                          <th className="p-3">Shipment</th>
                          <th className="p-3">Exception Type</th>
                          <th className="p-3">Route</th>
                          <th className="p-3">Triggered</th>
                          <th className="p-3">Severity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(exc.recent_exceptions || []).map((item: Row) => (
                          <tr
                            key={item.id}
                            className="border-t border-[#f1eff8] hover:bg-[#fbfbfe]"
                          >
                            <td className="p-3">
                              <Link
                                href={item.href}
                                className="font-semibold text-[#7068cf] hover:underline"
                              >
                                {item.shipment_ref}
                              </Link>
                              <p className="text-[10px] text-[#858693]">{item.customer}</p>
                            </td>
                            <td className="p-3 capitalize">
                              {String(item.type || "").replaceAll("_", " ")}
                            </td>
                            <td className="p-3 font-medium">{item.route}</td>
                            <td className="p-3 whitespace-nowrap">
                              {dateLabel(item.triggered_at)}
                            </td>
                            <td className="p-3">
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                                  item.severity === "high"
                                    ? "bg-rose-100 text-rose-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {item.severity === "high" ? "Critical" : "Warning"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!exc.recent_exceptions?.length && (
                      <p className="p-6 text-center text-xs text-[#858693]">
                        Zero unresolved escalations across your active shipments.
                      </p>
                    )}
                  </div>
                </Panel>
              </div>

              <div className="xl:col-span-5">
                <Panel title="Exceptions & delayed shipments trend">
                  <MultiSeriesTrendChart
                    data={trends}
                    series={[
                      { key: "in_transit", label: "Active In-Transit", color: "#3da7bc", kind: "bar" },
                      { key: "delayed", label: "Delayed / Exception", color: "#e11d48", kind: "line" },
                    ]}
                  />
                </Panel>
              </div>
            </div>

            <MilestoneBoard compact />
          </>
        )}

        {/* ═════════════════════════════════════════════════════════════════════
            DASHBOARD 3: COMMERCIAL & RFQ INTELLIGENCE
           ═════════════════════════════════════════════════════════════════════ */}
        {view === "Sales" && (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <KpiSparkCard
                label="Open Customer RFQs"
                value={data?.mail_pipeline?.rfq ?? data?.rfq_stages?.new ?? 0}
                sparkline={rfqSpark}
                tone="indigo"
                icon={<Inbox size={17} />}
                href="/rfqs"
              />
              <KpiSparkCard
                label="Quote Win Rate"
                value={`${overallWinRate}%`}
                subtitle={`${totalWonRfqs} won of ${totalDecidedRfqs} decided`}
                tone="emerald"
                icon={<TrendingUp size={17} />}
                href="/rfqs"
              />
              <KpiSparkCard
                label="Avg Quote Turnaround"
                value={avgRespHours == null ? "—" : `${avgRespHours.toFixed(1)}h`}
                subtitle="Target SLA ≤ 24.0 hours"
                tone={avgRespHours && avgRespHours > 24 ? "rose" : "teal"}
                icon={<Clock size={17} />}
                href="/rfqs"
              />
              <KpiSparkCard
                label="Jobs Ready to Book"
                value={data?.mail_pipeline?.ready ?? data?.rfq_stages?.accepted ?? 0}
                subtitle="Customer go-ahead confirmed"
                tone="emerald"
                icon={<CheckCircle2 size={17} />}
                href="/rfqs?tab=ready"
              />
              <KpiSparkCard
                label="Procurement Flagged"
                value={data?.rfq_stages?.no_rate ?? 0}
                subtitle={`${data?.mail_pipeline?.supplier_rates ?? 0} carrier rate replies`}
                tone="amber"
                icon={<Gauge size={17} />}
                href="/rfqs?tab=prepared&status=no_rate"
              />
            </div>

            {/* Visual RFQ Conversion Funnel */}
            <Panel
              title="RFQ conversion funnel"
              action={
                <Link href="/rfqs" className={secondaryClass}>
                  Open RFQs
                </Link>
              }
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                {[
                  ["new", "New RFQs", "bg-[#f4f2ff] text-[#655dc4]"],
                  ["quote_draft", "Quote draft saved", "bg-[#eef8fb] text-[#287d8f]"],
                  ["quoted", "Quoted to buyer", "bg-blue-50 text-blue-700"],
                  ["accepted", "Jobs to create", "bg-emerald-50 text-emerald-700"],
                  ["won", "Job created", "bg-emerald-100/80 text-emerald-800"],
                  ["lost", "Lost", "bg-rose-50 text-rose-700"],
                  ["no_rate", "No rate · Procurement", "bg-amber-50 text-amber-800"],
                ].map(([stage, label, toneCls]) => (
                  <Link
                    key={stage}
                    href="/rfqs"
                    className={`rounded-xl p-4 transition hover:shadow-sm ${toneCls}`}
                  >
                    <strong className="block text-2xl font-bold tabular-nums">
                      {data?.rfq_stages?.[stage] || 0}
                    </strong>
                    <p className="mt-1.5 text-xs font-medium">{label}</p>
                  </Link>
                ))}
              </div>
            </Panel>

            {/* Radial Gauges + Monthly RFQ Trend */}
            <div className="grid gap-5 xl:grid-cols-12">
              <div className="xl:col-span-3">
                <Panel title="Commercial win efficiency">
                  <RadialGaugeCard
                    variant="semicircle"
                    percent={overallWinRate}
                    label="Decided RFQ Win Rate"
                    color="#7068cf"
                    metrics={[
                      { label: "Won bookings", value: totalWonRfqs },
                      { label: "Decided quotes", value: totalDecidedRfqs },
                    ]}
                  />
                </Panel>
              </div>

              <div className="xl:col-span-3">
                <Panel title="Quote SLA compliance">
                  <RadialGaugeCard
                    variant="ring"
                    percent={slaCompliancePct}
                    label="Within SLA"
                    color={avgRespHours && avgRespHours > 24 ? "#e11d48" : "#10b981"}
                    metrics={[
                      {
                        label: "Avg response",
                        value: avgRespHours == null ? "—" : `${avgRespHours.toFixed(1)} hrs`,
                      },
                      { label: "Target threshold", value: "≤ 24.0 hrs" },
                    ]}
                  />
                </Panel>
              </div>

              <div className="xl:col-span-6">
                <Panel title="Monthly RFQ intake vs won bookings">
                  <MultiSeriesTrendChart
                    data={trends}
                    series={[
                      { key: "rfqs", label: "Inbound RFQs", color: "#7068cf", kind: "bar" },
                      { key: "won_rfqs", label: "Won Bookings", color: "#10b981", kind: "line" },
                    ]}
                  />
                </Panel>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <Panel title="Win rate by mode">
                <div className="space-y-4">
                  {data?.win_by_mode?.map((r: Row) => {
                    const pct = r.decided ? Math.round((r.won / r.decided) * 100) : 0;
                    return (
                      <div key={r.name}>
                        <div className="mb-1.5 flex justify-between text-xs">
                          <span className="font-semibold capitalize text-[#2d2e3d]">
                            {r.name}
                          </span>
                          <span className="tabular-nums text-[#7c7d8c]">
                            <strong className="text-[#171725]">{pct}%</strong> ({r.won}/{r.decided})
                          </span>
                        </div>
                        <div className="h-2.5 rounded-full bg-[#f0effc]">
                          <div
                            className="h-2.5 rounded-full bg-gradient-to-r from-[#7068cf] to-[#55b9cb]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {!data?.win_by_mode?.length && (
                    <p className="py-4 text-xs text-[#858693]">
                      No decided RFQs recorded yet.
                    </p>
                  )}
                </div>
              </Panel>

              <Panel title="Lost RFQ analysis">
                {data?.loss_reasons?.length ? (
                  <DonutBreakdownChart
                    centerLabel="Lost RFQs"
                    segments={data.loss_reasons.map((r: Row, idx: number) => ({
                      label: r.name ? String(r.name) : "Unspecified",
                      value: Number(r.count || 0),
                      color: ["#e11d48", "#f59e0b", "#7068cf", "#3da7bc", "#64748b"][idx % 5],
                    }))}
                  />
                ) : (
                  <p className="py-6 text-xs text-[#858693]">No lost RFQs recorded.</p>
                )}
              </Panel>
            </div>
          </>
        )}

        {/* ═════════════════════════════════════════════════════════════════════
            DASHBOARD 4: EXECUTIVE FINANCE, MARGIN & RECEIVABLES
           ═════════════════════════════════════════════════════════════════════ */}
        {view === "Finance" && finance && (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
              <KpiSparkCard
                label="Issued Revenue · MTD"
                value={moneyLabel(data?.issued_revenue_usd?.month, "USD")}
                subtitle={`QTD ${moneyLabel(data?.issued_revenue_usd?.quarter, "USD")}`}
                sparkline={sellSpark}
                tone="indigo"
                icon={<DollarSign size={17} />}
                href="/invoice-audit"
              />
              <KpiSparkCard
                label="Issued Revenue · YTD"
                value={moneyLabel(data?.issued_revenue_usd?.year, "USD")}
                subtitle="Approved sales invoices"
                sparkline={sellSpark}
                tone="teal"
                icon={<TrendingUp size={17} />}
              />
              <KpiSparkCard
                label="Total Sell Charges"
                value={moneyLabel(totalSellUsd, "USD")}
                subtitle="Customer billing side"
                sparkline={sellSpark}
                tone="indigo"
                icon={<Layers size={17} />}
              />
              <KpiSparkCard
                label="Total Buy Cost"
                value={moneyLabel(totalBuyUsd, "USD")}
                subtitle="Carrier & vendor cost"
                tone="amber"
                icon={<Package size={17} />}
              />
              <KpiSparkCard
                label="Net Job Profit"
                value={moneyLabel(netProfitUsd, "USD")}
                subtitle={`${grossMarginPct}% realized gross margin`}
                sparkline={profitSpark}
                tone={netProfitUsd >= 0 ? "emerald" : "rose"}
                icon={<Activity size={17} />}
              />
              <KpiSparkCard
                label="90+ Days Overdue AR"
                value={moneyLabel(data?.receivables_aging_usd?.["90+"], "USD")}
                subtitle="Critical collection bucket"
                invertDelta
                tone="rose"
                icon={<AlertTriangle size={17} />}
                href="/invoice-audit"
              />
            </div>

            {/* Revenue / Cost / Profit Trend + Margin Gauge + Invoice Donut */}
            <div className="grid gap-5 xl:grid-cols-12">
              <div className="xl:col-span-6">
                <Panel title="Monthly sell revenue, buy cost & net profit (USD)">
                  <MultiSeriesTrendChart
                    data={trends}
                    valuePrefix="$"
                    series={[
                      { key: "sell_usd", label: "Sell Revenue", color: "#7068cf", kind: "bar" },
                      { key: "buy_usd", label: "Buy Cost", color: "#94a3b8", kind: "bar" },
                      { key: "profit_usd", label: "Net Profit", color: "#10b981", kind: "line" },
                    ]}
                  />
                </Panel>
              </div>

              <div className="xl:col-span-3">
                <Panel title="Realized gross margin">
                  <RadialGaugeCard
                    variant="semicircle"
                    percent={Math.max(0, grossMarginPct)}
                    label="Gross Margin %"
                    color={grossMarginPct >= 15 ? "#10b981" : "#f59e0b"}
                    metrics={[
                      { label: "Sell", value: moneyLabel(totalSellUsd) },
                      { label: "Net profit", value: moneyLabel(netProfitUsd) },
                    ]}
                  />
                </Panel>
              </div>

              <div className="xl:col-span-3">
                <Panel title="Sales invoices by status">
                  <DonutBreakdownChart
                    centerLabel="Invoices"
                    segments={[
                      {
                        label: "Paid",
                        value: Number(data?.invoices_by_status?.paid || 0),
                        color: "#10b981",
                      },
                      {
                        label: "Sent",
                        value: Number(data?.invoices_by_status?.sent || 0),
                        color: "#3da7bc",
                      },
                      {
                        label: "Issued",
                        value: Number(data?.invoices_by_status?.issued || 0),
                        color: "#7068cf",
                      },
                      {
                        label: "Draft",
                        value: Number(data?.invoices_by_status?.draft || 0),
                        color: "#f59e0b",
                      },
                    ]}
                  />
                </Panel>
              </div>
            </div>

            {/* Receivables Aging Bar Cards */}
            <Panel title="Receivables aging · USD">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {[
                  ["0–30", "Current · 0–30 days", "border-emerald-200 bg-emerald-50/40 text-emerald-900"],
                  ["30–60", "Watch · 30–60 days", "border-blue-200 bg-blue-50/40 text-blue-900"],
                  ["60–90", "Delinquent · 60–90 days", "border-amber-200 bg-amber-50/50 text-amber-900"],
                  ["90+", "Critical · 90+ days", "border-rose-200 bg-rose-50/60 text-rose-900"],
                ].map(([bucket, label, cls]) => (
                  <div
                    key={bucket}
                    className={`rounded-xl border p-4 ${cls}`}
                  >
                    <p className="text-[11px] font-semibold opacity-80">{label}</p>
                    <strong className="mt-2 block text-xl font-bold tabular-nums">
                      {moneyLabel(data?.receivables_aging_usd?.[bucket])}
                    </strong>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Highest vs Lowest Margin Jobs Leaderboard */}
            <div className="grid gap-5 xl:grid-cols-2">
              {(["top", "bottom"] as const).map((mKind) => (
                <Panel
                  key={mKind}
                  title={`${mKind === "top" ? "Highest" : "Lowest"} margin jobs · this month`}
                >
                  <div className="space-y-3">
                    {data?.margin_jobs?.[mKind]?.map((j: Row) => {
                      const pct = Number(j.margin_percent || 0);
                      const profit = Number(j.sell || 0) - Number(j.buy || 0);
                      return (
                        <Link
                          key={j.id}
                          href={`/shipments/${j.id}`}
                          className="block rounded-xl border border-[#eeecf5] bg-[#fbfbfe] p-3.5 text-xs transition hover:border-[#cfcbe9] hover:bg-white"
                        >
                          <div className="flex items-center justify-between gap-2 font-semibold">
                            <span className="text-[#171725]">
                              <span className="text-[#7068cf]">{j.shipment_ref}</span> ·{" "}
                              {j.customer}
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-0.5 tabular-nums ${
                                pct >= 18
                                  ? "bg-emerald-50 text-emerald-700"
                                  : pct >= 5
                                    ? "bg-amber-50 text-amber-800"
                                    : "bg-rose-50 text-rose-700"
                              }`}
                            >
                              {pct.toFixed(1)}% margin
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[#7c7d8c]">
                            <span>
                              ETD {dateLabel(j.etd)} · ETA {dateLabel(j.eta)}
                            </span>
                            <strong className="text-[#171725] tabular-nums">
                              Profit {moneyLabel(profit)}
                            </strong>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                  {!data?.margin_jobs?.[mKind]?.length && (
                    <p className="py-4 text-xs text-[#858693]">
                      No revenue charges recorded this month.
                    </p>
                  )}
                </Panel>
              ))}
            </div>
          </>
        )}

        {/* ═════════════════════════════════════════════════════════════════════
            DASHBOARD 5: TEAM CAPACITY & WORKLOAD BALANCING
           ═════════════════════════════════════════════════════════════════════ */}
        {view === "Team" && manager && (
          <>
            <ErrorBanner error={workload.error} />
            <div className="grid gap-5 xl:grid-cols-12">
              <div className="xl:col-span-8">
                <Panel
                  title="Operator utilization vs active job capacity threshold"
                  action={
                    <span className="text-xs text-[#7c7d8c]">
                      Target threshold: {data?.workload_threshold ?? 15} active jobs / coordinator
                    </span>
                  }
                >
                  {workload.data?.items?.length ? (
                    <UtilizationBars
                      capacity={Number(data?.workload_threshold || 15)}
                      rows={workload.data.items.map((p: Row) => ({
                        id: p.id,
                        label: p.name,
                        value: Number(p.open_jobs || 0),
                        sublabel: `${p.overdue} overdue · ${p.departing_48h} departing ≤48h · ${p.alerts} active escalations`,
                        href: `/shipments?assigned_user_id=${p.id}`,
                      }))}
                    />
                  ) : (
                    <p className="py-6 text-xs text-[#858693]">
                      No active team workload records.
                    </p>
                  )}
                </Panel>
              </div>

              <div className="xl:col-span-4">
                <Panel title="Team workload risk balance">
                  <DonutBreakdownChart
                    centerValue={workload.data?.items?.length ?? 0}
                    centerLabel="Staff"
                    segments={[
                      {
                        label: "Balanced (Green)",
                        value: (workload.data?.items || []).filter(
                          (p: Row) => p.risk === "green",
                        ).length,
                        color: "#10b981",
                      },
                      {
                        label: "Near Capacity (Amber)",
                        value: (workload.data?.items || []).filter(
                          (p: Row) => p.risk === "amber",
                        ).length,
                        color: "#f59e0b",
                      },
                      {
                        label: "Overloaded / Alert (Red)",
                        value: (workload.data?.items || []).filter(
                          (p: Row) => p.risk === "red",
                        ).length,
                        color: "#e11d48",
                      },
                    ]}
                  />
                </Panel>
              </div>
            </div>

            <Panel title="Team workload directory & status breakdown">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {workload.data?.items.map((p: Row) => (
                  <div
                    key={p.id}
                    className="rounded-xl border border-[#eeecf5] bg-[#fbfbfe] p-5 transition hover:border-[#cfcbe9] hover:bg-white"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            p.risk === "red"
                              ? "bg-rose-500"
                              : p.risk === "amber"
                                ? "bg-amber-400"
                                : "bg-emerald-500"
                          }`}
                        />
                        <Link
                          href={`/shipments?assigned_user_id=${p.id}`}
                          className="text-sm font-semibold text-[#7068cf] hover:underline"
                        >
                          {p.name}
                        </Link>
                      </div>
                      <span className="rounded-full bg-[#f4f2ff] px-2 py-0.5 text-[10px] font-medium capitalize text-[#655dc4]">
                        {String(p.role || "").replaceAll("_", " ")}
                      </span>
                    </div>
                    <p className="mt-3 text-2xl font-bold text-[#171725] tabular-nums">
                      {p.open_jobs}
                      <span className="ml-2 text-xs font-normal text-[#858693]">
                        open jobs
                      </span>
                    </p>
                    <div className="mt-3 grid grid-cols-3 rounded-lg bg-white p-2 text-[10px] text-[#6b6c7b] border border-[#f0eef8]">
                      <span>
                        <strong className={p.overdue ? "text-rose-600" : ""}>{p.overdue}</strong>{" "}
                        overdue
                      </span>
                      <span>
                        <strong className={p.alerts ? "text-amber-700" : ""}>{p.alerts}</strong>{" "}
                        alerts
                      </span>
                      <span>
                        <strong>{p.departing_48h}</strong> ETD ≤48h
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {Object.entries(p.by_status || {}).map(([status, count]) => (
                        <span
                          key={status}
                          className="rounded-full bg-[#f4f2ff] px-2.5 py-1 text-[10px] font-medium text-[#4a4b5c]"
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
          </>
        )}
      </div>
    </AppShell>
  );
}
