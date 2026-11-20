"use client";

import React, { useState, type ReactNode } from "react";
import Link from "next/link";

export type AccentTone = "indigo" | "teal" | "emerald" | "amber" | "rose" | "violet";

const TONE_MAP: Record<
  AccentTone,
  { badge: string; stroke: string; fillId: string; stopTop: string; text: string }
> = {
  indigo: {
    badge: "bg-[#eeecfd] text-[#6259c8]",
    stroke: "#7068cf",
    fillId: "spark-indigo",
    stopTop: "rgba(112,104,207,0.28)",
    text: "text-[#6259c8]",
  },
  teal: {
    badge: "bg-[#e5f6f9] text-[#268496]",
    stroke: "#3da7bc",
    fillId: "spark-teal",
    stopTop: "rgba(61,167,188,0.28)",
    text: "text-[#268496]",
  },
  emerald: {
    badge: "bg-emerald-50 text-emerald-700",
    stroke: "#10b981",
    fillId: "spark-emerald",
    stopTop: "rgba(16,185,129,0.26)",
    text: "text-emerald-700",
  },
  amber: {
    badge: "bg-amber-50 text-amber-700",
    stroke: "#f59e0b",
    fillId: "spark-amber",
    stopTop: "rgba(245,158,11,0.26)",
    text: "text-amber-700",
  },
  rose: {
    badge: "bg-rose-50 text-rose-700",
    stroke: "#e11d48",
    fillId: "spark-rose",
    stopTop: "rgba(225,29,72,0.24)",
    text: "text-rose-700",
  },
  violet: {
    badge: "bg-purple-50 text-purple-700",
    stroke: "#8b5cf6",
    fillId: "spark-violet",
    stopTop: "rgba(139,92,246,0.25)",
    text: "text-purple-700",
  },
};

export function KpiSparkCard({
  label,
  value,
  delta,
  deltaLabel,
  invertDelta = false,
  subtitle,
  sparkline,
  tone = "indigo",
  icon,
  href,
  onClick,
}: {
  label: string;
  value: ReactNode;
  delta?: number | null;
  deltaLabel?: string;
  invertDelta?: boolean;
  subtitle?: string;
  sparkline?: number[];
  tone?: AccentTone;
  icon?: ReactNode;
  href?: string;
  onClick?: () => void;
}) {
  const palette = TONE_MAP[tone];
  const pts = sparkline && sparkline.length >= 2 ? sparkline : null;
  let linePath = "";
  let areaPath = "";
  let lastX = 96;
  let lastY = 18;

  if (pts) {
    const min = Math.min(...pts);
    const max = Math.max(...pts);
    const span = max - min || 1;
    const coords = pts.map((v, idx) => {
      const x = 4 + (idx / (pts.length - 1)) * 92;
      const y = 30 - ((v - min) / span) * 22;
      return [Number(x.toFixed(1)), Number(y.toFixed(1))] as const;
    });
    linePath = coords.map(([x, y], idx) => `${idx === 0 ? "M" : "L"}${x},${y}`).join(" ");
    areaPath = `${linePath} L${coords[coords.length - 1][0]},34 L${coords[0][0]},34 Z`;
    lastX = coords[coords.length - 1][0];
    lastY = coords[coords.length - 1][1];
  }

  const hasDelta = typeof delta === "number" && !Number.isNaN(delta);
  const isGood = hasDelta ? (invertDelta ? delta <= 0 : delta >= 0) : true;

  const inner = (
    <div className="group relative flex h-full flex-col justify-between rounded-2xl border border-[#e7e5f3] bg-white p-4 shadow-[0_2px_10px_-4px_rgba(23,23,37,0.06)] transition hover:border-[#cbc6ec] hover:shadow-[0_6px_20px_-6px_rgba(112,104,207,0.16)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.08em] text-[#7c7d8c]">
            {label}
          </p>
          <div className="mt-1.5 text-2xl font-bold tracking-tight text-[#171725] tabular-nums">
            {value}
          </div>
        </div>
        {icon && (
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${palette.badge}`}
          >
            {icon}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="min-w-0">
          {hasDelta ? (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span
                className={`inline-flex items-center rounded-md px-1.5 py-0.5 font-semibold tabular-nums ${
                  delta === 0
                    ? "bg-slate-100 text-slate-600"
                    : isGood
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-rose-50 text-rose-700"
                }`}
              >
                {delta! > 0 ? "▲" : delta! < 0 ? "▼" : "•"} {Math.abs(delta!).toFixed(1)}%
              </span>
              {deltaLabel && (
                <span className="truncate text-[10px] text-[#8a8b99]">{deltaLabel}</span>
              )}
            </div>
          ) : subtitle ? (
            <p className="truncate text-[11px] text-[#7c7d8c]">{subtitle}</p>
          ) : null}
        </div>

        {pts && (
          <svg
            viewBox="0 0 100 36"
            className="h-9 w-24 shrink-0 overflow-visible"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={`${palette.fillId}-${label.replace(/\W+/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={palette.stopTop} />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </linearGradient>
            </defs>
            <path
              d={areaPath}
              fill={`url(#${palette.fillId}-${label.replace(/\W+/g, "")})`}
            />
            <path
              d={linePath}
              fill="none"
              stroke={palette.stroke}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx={lastX} cy={lastY} r="2.8" fill={palette.stroke} />
          </svg>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7068cf] rounded-2xl">
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="block h-full w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7068cf] rounded-2xl"
      >
        {inner}
      </button>
    );
  }
  return inner;
}

export interface PipelineStageItem {
  key: string;
  label: string;
  count: number;
  share_pct: number;
}

const STAGE_STYLES = [
  { dot: "bg-[#7068cf]", ring: "ring-[#eeecfd]", bar: "#7068cf" },
  { dot: "bg-[#55b9cb]", ring: "ring-[#e5f6f9]", bar: "#55b9cb" },
  { dot: "bg-[#3b82f6]", ring: "ring-blue-100", bar: "#3b82f6" },
  { dot: "bg-[#f59e0b]", ring: "ring-amber-100", bar: "#f59e0b" },
  { dot: "bg-[#10b981]", ring: "ring-emerald-100", bar: "#10b981" },
];

export function LifecyclePipelineBar({
  stages,
  statuses,
}: {
  stages?: PipelineStageItem[];
  statuses?: Record<string, number>;
}) {
  const computed: PipelineStageItem[] =
    stages && stages.length > 0
      ? stages
      : (() => {
          const st = statuses || {};
          const buckets: [string, string, string[]][] = [
            ["origin", "Booking & Origin", ["inquiry_received", "quoted", "booked", "draft", "pickup_scheduled"]],
            ["export_ops", "Customs & Gate-In", ["picked_up", "at_warehouse", "customs_export", "gate_in", "awaiting_departure"]],
            ["in_transit", "Mainline In-Transit", ["departed", "in_transit", "transshipment"]],
            ["arrival_clearance", "Arrival & Clearance", ["arrived", "customs_import", "customs_hold", "out_for_delivery"]],
            ["delivered", "Delivered", ["delivered", "closed"]],
          ];
          const counts = buckets.map(([key, label, keys]) => ({
            key,
            label,
            count: keys.reduce((acc, k) => acc + Number(st[k] || 0), 0),
          }));
          const tot = counts.reduce((s, c) => s + c.count, 0) || 1;
          return counts.map((c) => ({
            ...c,
            share_pct: Number(((c.count * 100) / tot).toFixed(1)),
          }));
        })();

  const totalCount = computed.reduce((s, c) => s + c.count, 0);

  return (
    <div className="space-y-4">
      <div className="relative grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[10%] right-[10%] top-5 hidden h-[2px] bg-gradient-to-r from-[#7068cf]/30 via-[#3b82f6]/30 to-[#10b981]/30 sm:block"
        />
        {computed.map((stage, idx) => {
          const style = STAGE_STYLES[idx % STAGE_STYLES.length];
          return (
            <Link
              key={stage.key}
              href="/shipments"
              className="relative z-10 flex flex-col items-start rounded-xl border border-[#efedf7] bg-[#fbfbfe] p-3.5 transition hover:border-[#cfcbe9] hover:bg-white sm:items-center sm:text-center"
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white ring-4 ${style.dot} ${style.ring}`}
              >
                {idx + 1}
              </span>
              <strong className="mt-2.5 text-xl font-bold text-[#171725] tabular-nums">
                {stage.count.toLocaleString()}
              </strong>
              <span className="mt-0.5 text-[11px] font-semibold text-[#474857]">
                {stage.label}
              </span>
              <span className="mt-0.5 text-[10px] text-[#8a8b99] tabular-nums">
                {totalCount > 0 ? `${stage.share_pct}% of fleet` : "0%"}
              </span>
            </Link>
          );
        })}
      </div>

      {totalCount > 0 && (
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[#f1effa]">
          {computed.map((stage, idx) =>
            stage.count > 0 ? (
              <div
                key={stage.key}
                style={{
                  width: `${Math.max(2, stage.share_pct)}%`,
                  backgroundColor: STAGE_STYLES[idx % STAGE_STYLES.length].bar,
                }}
                title={`${stage.label}: ${stage.count} (${stage.share_pct}%)`}
              />
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}

export interface CorridorLane {
  origin_code: string;
  origin_name?: string;
  origin_country?: string;
  dest_code: string;
  dest_name?: string;
  dest_country?: string;
  mode?: string;
  shipments: number;
  delivered?: number;
  in_transit?: number;
  delayed?: number;
  dd_risk?: number;
  at_risk?: number;
  on_time_pct: number;
  avg_transit_days?: number;
}

// Normalized map coordinates (viewBox 640 x 300) for major global trade hubs & ISO country codes
const HUB_COORDS: Record<string, [number, number]> = {
  // North America
  LAX: [102, 118], USLAX: [102, 118], SFO: [98, 110], SEA: [100, 96],
  ORD: [152, 106], JFK: [176, 108], NYC: [176, 108], USNYC: [176, 108],
  SAV: [166, 122], MIA: [168, 134], IAH: [142, 128], YYZ: [168, 102],
  US: [145, 114], CA: [140, 92], MX: [132, 142], BR: [215, 212],
  // Europe
  LHR: [298, 88], GB: [298, 88], FXS: [302, 88],
  RTM: [312, 90], NLRTM: [312, 90], NL: [312, 90], AMS: [313, 89],
  ANR: [311, 92], BE: [311, 92], CDG: [308, 95], FR: [308, 97],
  HAM: [322, 86], DEHAM: [322, 86], FRA: [321, 93], DE: [322, 92],
  MXP: [323, 102], IT: [325, 106], BCN: [305, 106], ES: [300, 107],
  CH: [318, 98], AT: [328, 98], PL: [336, 89], TR: [358, 110],
  // Middle East & Africa
  DXB: [406, 136], JEA: [405, 137], AEJEA: [405, 137], AUH: [404, 138], AE: [406, 137],
  DOH: [400, 136], QA: [400, 136], JED: [378, 142], SA: [388, 140],
  OM: [410, 142], EG: [356, 130], ZA: [346, 232], KE: [374, 178],
  // India & South Asia
  BOM: [442, 146], INNSA: [443, 147], NSA: [443, 147], MUN: [437, 140], INMUN: [437, 140],
  DEL: [446, 130], INDEL: [446, 130], MAA: [452, 158], INMAA: [452, 158],
  BLR: [448, 157], CCU: [462, 142], VTZ: [456, 150], PIP: [439, 143],
  IN: [447, 146], LK: [454, 168], CMB: [454, 168], BD: [468, 140], PK: [430, 132],
  // East & Southeast Asia
  SIN: [502, 174], SGSIN: [502, 174], SG: [502, 174],
  PKG: [498, 171], MYPKG: [498, 171], KUL: [499, 171], MY: [500, 171],
  BKK: [496, 156], TH: [496, 156], SGN: [508, 162], VN: [508, 156],
  HKG: [524, 142], HK: [524, 142], SZX: [524, 140], CNSZX: [524, 140],
  CAN: [522, 139], CNNSA: [522, 140], SHA: [534, 126], CNSHA: [534, 126],
  NGB: [535, 129], CNNGB: [535, 129], TAO: [532, 116], CNTAO: [532, 116],
  TSN: [528, 111], CNTSN: [528, 111], XMN: [529, 136], CN: [524, 126],
  TPE: [538, 138], TW: [538, 138], ICN: [544, 116], PUS: [547, 119], KR: [545, 117],
  NRT: [566, 118], TYO: [565, 118], JP: [564, 118], MNL: [534, 156], PH: [534, 158],
  CGK: [510, 188], ID: [518, 186],
  // Oceania
  SYD: [576, 236], MEL: [568, 242], AU: [560, 226], NZ: [604, 252],
};

function resolveHubCoord(code?: string, country?: string, name?: string, fallbackIdx = 0): [number, number] {
  const c = (code || "").trim().toUpperCase();
  if (c && HUB_COORDS[c]) return HUB_COORDS[c];
  if (c.length === 5 && HUB_COORDS[c.slice(2)]) return HUB_COORDS[c.slice(2)];
  if (c.length >= 2 && HUB_COORDS[c.slice(0, 2)]) return HUB_COORDS[c.slice(0, 2)];
  const cc = (country || "").trim().toUpperCase();
  if (cc && HUB_COORDS[cc]) return HUB_COORDS[cc];
  const nm = (name || "").toLowerCase();
  if (nm.includes("nhava") || nm.includes("mumbai")) return HUB_COORDS.BOM;
  if (nm.includes("mundra")) return HUB_COORDS.MUN;
  if (nm.includes("chennai")) return HUB_COORDS.MAA;
  if (nm.includes("delhi")) return HUB_COORDS.DEL;
  if (nm.includes("shanghai")) return HUB_COORDS.SHA;
  if (nm.includes("shenzhen") || nm.includes("nansha")) return HUB_COORDS.SZX;
  if (nm.includes("ningbo")) return HUB_COORDS.NGB;
  if (nm.includes("qingdao")) return HUB_COORDS.TAO;
  if (nm.includes("jebel") || nm.includes("dubai")) return HUB_COORDS.DXB;
  if (nm.includes("singapore")) return HUB_COORDS.SIN;
  if (nm.includes("rotterdam")) return HUB_COORDS.RTM;
  if (nm.includes("hamburg") || nm.includes("frankfurt")) return HUB_COORDS.FRA;
  if (nm.includes("london")) return HUB_COORDS.LHR;
  if (nm.includes("los angeles")) return HUB_COORDS.LAX;
  if (nm.includes("new york")) return HUB_COORDS.NYC;
  // Deterministic spread fallback
  const angle = (fallbackIdx * 137.5 * Math.PI) / 180;
  return [320 + Math.cos(angle) * 150, 145 + Math.sin(angle) * 60];
}

export function GlobalCorridorMap({
  lanes = [],
  summary,
}: {
  lanes?: CorridorLane[];
  summary?: {
    in_transit: number;
    delivered: number;
    dd_at_risk: number;
    delayed: number;
  };
}) {
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const visibleLanes = lanes.slice(0, 10);
  const activeLane = visibleLanes[selectedIdx] || visibleLanes[0] || null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#232946] bg-gradient-to-br from-[#121629] via-[#181f38] to-[#1d2544] p-5 text-white shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8ea0c8]">
            Global Trade-Lane Visibility
          </span>
          <h3 className="text-sm font-semibold text-white">
            Active Freight Corridors &amp; Hub Status
          </h3>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-[#b4c2e0]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> ≥90% On-Time
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> Watch (75–89%)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-400" /> Delayed (&lt;75%)
          </span>
        </div>
      </div>

      <div className="relative rounded-xl border border-white/10 bg-[#0e1324]/70 p-2">
        <svg
          viewBox="0 0 640 275"
          className="h-[235px] w-full select-none"
          role="img"
          aria-label="Global freight corridors map"
        >
          <defs>
            <radialGradient id="hubGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#55b9cb" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#55b9cb" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Subtle lat/lon graticule */}
          {[55, 110, 165, 220].map((y) => (
            <line
              key={`lat-${y}`}
              x1="0"
              y1={y}
              x2="640"
              y2={y}
              stroke="rgba(148,163,184,0.08)"
              strokeDasharray="3 3"
            />
          ))}
          {[110, 220, 330, 440, 550].map((x) => (
            <line
              key={`lon-${x}`}
              x1={x}
              y1="0"
              x2={x}
              y2="275"
              stroke="rgba(148,163,184,0.08)"
              strokeDasharray="3 3"
            />
          ))}

          {/* Stylized continental landmasses */}
          <g fill="#1e2949" stroke="#2c3b66" strokeWidth="0.8">
            {/* North America */}
            <path d="M52,58 L138,48 L192,78 L184,116 L154,136 L128,152 L102,134 L84,104 Z" />
            {/* South America */}
            <path d="M174,162 L222,172 L238,208 L212,256 L188,252 L176,204 Z" />
            {/* Europe */}
            <path d="M286,58 L358,52 L374,84 L356,112 L296,112 L284,88 Z" />
            {/* Africa */}
            <path d="M288,122 L358,122 L386,158 L368,236 L334,242 L314,186 L284,156 Z" />
            {/* Asia & Middle East */}
            <path d="M366,58 L556,54 L584,98 L552,154 L498,178 L448,164 L402,148 L374,116 Z" />
            {/* Maritime SE Asia & Oceania */}
            <path d="M498,184 L544,184 L548,196 L502,196 Z" />
            <path d="M530,208 L592,206 L598,244 L542,248 Z" />
          </g>

          {/* Trade Corridor Bezier Arcs */}
          {visibleLanes.map((lane, idx) => {
            const [x1, y1] = resolveHubCoord(
              lane.origin_code,
              lane.origin_country,
              lane.origin_name,
              idx * 2,
            );
            const [x2, y2] = resolveHubCoord(
              lane.dest_code,
              lane.dest_country,
              lane.dest_name,
              idx * 2 + 1,
            );
            const mx = (x1 + x2) / 2;
            const dist = Math.hypot(x2 - x1, y2 - y1);
            const my = Math.min(y1, y2) - Math.max(18, dist * 0.22);
            const stroke =
              lane.on_time_pct >= 90
                ? "#34d399"
                : lane.on_time_pct >= 75
                  ? "#fbbf24"
                  : "#fb7185";
            const isSelected = idx === selectedIdx;
            const strokeWidth = isSelected
              ? 2.8
              : Math.min(2.4, 1.2 + lane.shipments * 0.15);

            return (
              <g
                key={`${lane.origin_code}-${lane.dest_code}-${lane.mode}-${idx}`}
                className="cursor-pointer"
                onClick={() => setSelectedIdx(idx)}
                onMouseEnter={() => setSelectedIdx(idx)}
              >
                <path
                  d={`M${x1},${y1} Q${mx},${my} ${x2},${y2}`}
                  fill="none"
                  stroke={stroke}
                  strokeOpacity={isSelected ? 0.98 : 0.62}
                  strokeWidth={strokeWidth}
                  strokeDasharray={lane.mode === "air" ? "5 3" : undefined}
                />
                <circle cx={x1} cy={y1} r={isSelected ? 4.2 : 3} fill="#55b9cb" />
                <circle cx={x2} cy={y2} r={isSelected ? 4.8 : 3.4} fill={stroke} />
                {(isSelected || idx < 4) && (
                  <>
                    <text
                      x={x1}
                      y={y1 - 6}
                      textAnchor="middle"
                      fontSize="8.5"
                      fontWeight="600"
                      fill="#e2e8f0"
                    >
                      {lane.origin_code}
                    </text>
                    <text
                      x={x2}
                      y={y2 - 6}
                      textAnchor="middle"
                      fontSize="8.5"
                      fontWeight="600"
                      fill="#ffffff"
                    >
                      {lane.dest_code}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>

        {/* Bottom-left live fleet status overlay (mirrors TMS Image 1 & 3) */}
        {summary && (
          <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-[#141b33]/90 px-3 py-2 text-[11px] sm:grid-cols-4">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[#a9b8d9]">
                <span className="h-2 w-2 rounded-full bg-[#55b9cb]" /> In Transit
              </span>
              <strong className="tabular-nums text-white">{summary.in_transit}</strong>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[#a9b8d9]">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> Delivered
              </span>
              <strong className="tabular-nums text-white">{summary.delivered}</strong>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[#a9b8d9]">
                <span className="h-2 w-2 rounded-full bg-amber-400" /> D&amp;D Watch
              </span>
              <strong className="tabular-nums text-white">{summary.dd_at_risk}</strong>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[#a9b8d9]">
                <span className="h-2 w-2 rounded-full bg-rose-400" /> Delayed
              </span>
              <strong className="tabular-nums text-white">{summary.delayed}</strong>
            </div>
          </div>
        )}
      </div>

      {activeLane ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/5 px-3.5 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="rounded bg-[#7068cf]/30 px-2 py-0.5 text-[10px] font-bold uppercase text-[#c7c2ff]">
              {activeLane.mode || "ocean"}
            </span>
            <strong className="text-white">
              {activeLane.origin_name || activeLane.origin_code} ({activeLane.origin_code}) →{" "}
              {activeLane.dest_name || activeLane.dest_code} ({activeLane.dest_code})
            </strong>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#cbd5e1] tabular-nums">
            <span>
              <strong>{activeLane.shipments}</strong> shipments
            </span>
            <span>
              OTP: <strong className="text-emerald-300">{activeLane.on_time_pct}%</strong>
            </span>
            {!!activeLane.avg_transit_days && (
              <span>
                Avg transit: <strong>{activeLane.avg_transit_days}d</strong>
              </span>
            )}
            {!!activeLane.at_risk && (
              <span className="text-rose-300">
                At risk: <strong>{activeLane.at_risk}</strong>
              </span>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-[#94a3b8]">
          Active trade corridors populate automatically as shipments are booked.
        </p>
      )}
    </div>
  );
}

function heatCellClass(score: number | null): string {
  if (score === null) return "bg-[#f6f5fb] text-[#b0b1bf]";
  if (score >= 92) return "bg-emerald-600 text-white font-semibold";
  if (score >= 82) return "bg-emerald-500/85 text-white font-semibold";
  if (score >= 72) return "bg-amber-400/90 text-[#1e1b2e] font-semibold";
  return "bg-rose-500 text-white font-semibold";
}

export function LanePerformanceHeatmap({ lanes = [] }: { lanes?: CorridorLane[] }) {
  if (!lanes.length) {
    return (
      <p className="py-8 text-center text-xs text-[#858693]">
        No trade-lane OTP scores recorded for the selected filter window.
      </p>
    );
  }

  // Extract top unique origins (up to 5) and destinations (up to 4)
  const origins = Array.from(new Set(lanes.map((l) => l.origin_code))).slice(0, 5);
  const dests = Array.from(new Set(lanes.map((l) => l.dest_code))).slice(0, 4);
  const lookup = new Map<string, CorridorLane>();
  for (const l of lanes) {
    const k = `${l.origin_code}__${l.dest_code}`;
    if (!lookup.has(k)) lookup.set(k, l);
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-1.5 text-xs">
          <thead>
            <tr>
              <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[#858693]">
                POL \ POD
              </th>
              {dests.map((d) => (
                <th
                  key={d}
                  className="px-2 py-1.5 text-center text-[11px] font-bold text-[#343444]"
                >
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {origins.map((o) => (
              <tr key={o}>
                <td className="whitespace-nowrap px-2 py-1.5 font-semibold text-[#343444]">
                  {o}
                </td>
                {dests.map((d) => {
                  const cell = lookup.get(`${o}__${d}`);
                  const score = cell ? Math.round(cell.on_time_pct) : null;
                  return (
                    <td
                      key={`${o}-${d}`}
                      title={
                        cell
                          ? `${o} → ${d}: ${cell.on_time_pct}% on-time (${cell.shipments} shipments)`
                          : `${o} → ${d}: no shipments`
                      }
                      className={`rounded-lg px-2 py-2.5 text-center tabular-nums transition ${heatCellClass(score)}`}
                    >
                      {score !== null ? `${score}%` : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Color-scale legend matching Image 1 */}
      <div className="space-y-1 pt-1">
        <div className="flex justify-between text-[10px] font-medium text-[#7c7d8c]">
          <span>On-Time Reliability Score (%)</span>
          <span>Target ≥ 90%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-600" />
        <div className="flex justify-between text-[10px] text-[#8a8b99] tabular-nums">
          <span>50%</span>
          <span>65%</span>
          <span>80%</span>
          <span>90%</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
}

export interface TrendSeriesConfig {
  key: string;
  label: string;
  color: string;
  kind?: "area" | "line" | "bar";
}

export function MultiSeriesTrendChart({
  data = [],
  series,
  valuePrefix = "",
}: {
  data?: Record<string, any>[];
  series: TrendSeriesConfig[];
  valuePrefix?: string;
}) {
  if (!data.length) {
    return (
      <p className="py-8 text-center text-xs text-[#858693]">
        No historical trend points available yet.
      </p>
    );
  }

  const W = 560;
  const H = 205;
  const padL = 44;
  const padR = 16;
  const padT = 18;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const allValues = data.flatMap((row) =>
    series.map((s) => Math.max(0, Number(row[s.key] || 0))),
  );
  const maxVal = Math.max(4, ...allValues);
  const niceMax = Math.ceil(maxVal * 1.15);

  const xAt = (i: number) =>
    data.length === 1 ? padL + plotW / 2 : padL + (i / (data.length - 1)) * plotW;
  const yAt = (val: number) => padT + plotH - (Math.max(0, val) / (niceMax || 1)) * plotH;

  const barSeries = series.filter((s) => s.kind === "bar");
  const lineSeries = series.filter((s) => s.kind !== "bar");
  const slotW = plotW / Math.max(1, data.length);
  const barW = barSeries.length ? Math.min(20, (slotW * 0.58) / barSeries.length) : 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-[11px]">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5 font-medium text-[#4a4b59]">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            {s.label}
          </span>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-[205px] w-full overflow-visible"
        role="img"
        aria-label="Performance trend over time"
      >
        <defs>
          {lineSeries.map((s) => (
            <linearGradient key={s.key} id={`trend-grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0.0" />
            </linearGradient>
          ))}
        </defs>

        {/* Gridlines & Y-axis ticks */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const val = Math.round(niceMax * ratio);
          const y = yAt(val);
          const formatted =
            val >= 1000 ? `${valuePrefix}${(val / 1000).toFixed(1)}k` : `${valuePrefix}${val}`;
          return (
            <g key={ratio}>
              <line
                x1={padL}
                y1={y}
                x2={W - padR}
                y2={y}
                stroke="#eeecf5"
                strokeDasharray={ratio === 0 ? undefined : "3 3"}
              />
              <text
                x={padL - 8}
                y={y + 3}
                textAnchor="end"
                fontSize="9.5"
                fill="#8a8b99"
              >
                {formatted}
              </text>
            </g>
          );
        })}

        {/* Optional grouped bars */}
        {barSeries.map((s, bIdx) =>
          data.map((row, i) => {
            const val = Math.max(0, Number(row[s.key] || 0));
            const cx = xAt(i);
            const x = cx - (barSeries.length * barW) / 2 + bIdx * barW;
            const y = yAt(val);
            const h = Math.max(1, padT + plotH - y);
            return (
              <rect
                key={`${s.key}-${i}`}
                x={x}
                y={y}
                width={Math.max(4, barW - 2)}
                height={h}
                rx="3"
                fill={s.color}
                fillOpacity="0.82"
              >
                <title>{`${row.label} · ${s.label}: ${valuePrefix}${val.toLocaleString()}`}</title>
              </rect>
            );
          }),
        )}

        {/* Area & Line series */}
        {lineSeries.map((s) => {
          const pts = data.map((row, i) => [xAt(i), yAt(Number(row[s.key] || 0))] as const);
          const dLine = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
          const dArea = `${dLine} L${pts[pts.length - 1][0].toFixed(1)},${padT + plotH} L${pts[0][0].toFixed(1)},${padT + plotH} Z`;
          return (
            <g key={s.key}>
              {s.kind === "area" && <path d={dArea} fill={`url(#trend-grad-${s.key})`} />}
              <path
                d={dLine}
                fill="none"
                stroke={s.color}
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {pts.map(([x, y], i) => (
                <circle
                  key={`${s.key}-pt-${i}`}
                  cx={x}
                  cy={y}
                  r="3.2"
                  fill="#ffffff"
                  stroke={s.color}
                  strokeWidth="2"
                >
                  <title>{`${data[i].label} · ${s.label}: ${valuePrefix}${Number(data[i][s.key] || 0).toLocaleString()}`}</title>
                </circle>
              ))}
            </g>
          );
        })}

        {/* X-axis month labels */}
        {data.map((row, i) => (
          <text
            key={row.month || i}
            x={xAt(i)}
            y={H - 8}
            textAnchor="middle"
            fontSize="10"
            fontWeight="500"
            fill="#7c7d8c"
          >
            {row.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

export function RadialGaugeCard({
  percent,
  label,
  sublabel,
  color = "#10b981",
  variant = "ring",
  metrics = [],
}: {
  percent: number;
  label: string;
  sublabel?: string;
  color?: string;
  variant?: "ring" | "semicircle";
  metrics?: { label: string; value: ReactNode }[];
}) {
  const clamped = Math.max(0, Math.min(100, Number(percent) || 0));

  if (variant === "semicircle") {
    const r = 56;
    const circ = Math.PI * r;
    const offset = circ - (clamped / 100) * circ;
    const angleRad = Math.PI - (clamped / 100) * Math.PI;
    const nx = 75 + Math.cos(angleRad) * 40;
    const ny = 74 - Math.sin(angleRad) * 40;

    return (
      <div className="flex flex-col items-center justify-between">
        <svg viewBox="0 0 150 92" className="h-28 w-44" aria-label={label}>
          <path
            d="M 19 74 A 56 56 0 0 1 131 74"
            fill="none"
            stroke="#eeecf7"
            strokeWidth="12"
            strokeLinecap="round"
          />
          <path
            d="M 19 74 A 56 56 0 0 1 131 74"
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
          />
          <line
            x1="75"
            y1="74"
            x2={nx}
            y2={ny}
            stroke="#171725"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <circle cx="75" cy="74" r="4.5" fill="#171725" />
        </svg>
        <div className="-mt-1 text-center">
          <strong className="text-2xl font-bold text-[#171725] tabular-nums">
            {clamped.toFixed(1)}%
          </strong>
          <p className="text-xs font-medium text-[#5c5d6d]">{label}</p>
          {sublabel && <p className="text-[10px] text-[#8a8b99]">{sublabel}</p>}
        </div>
        {metrics.length > 0 && (
          <div className="mt-3 w-full divide-y divide-[#f1eff8] rounded-xl border border-[#eeecf5] bg-[#fbfbfe] px-3 py-1.5 text-xs">
            {metrics.map((m) => (
              <div key={m.label} className="flex items-center justify-between py-1">
                <span className="text-[#777884]">{m.label}</span>
                <strong className="text-[#171725] tabular-nums">{m.value}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const r = 46;
  const circ = 2 * Math.PI * r;
  const offset = circ - (clamped / 100) * circ;

  return (
    <div className="flex flex-col items-center justify-between">
      <div className="relative flex h-32 w-32 items-center justify-center">
        <svg viewBox="0 0 116 116" className="h-32 w-32 -rotate-90" aria-label={label}>
          <circle cx="58" cy="58" r={r} fill="none" stroke="#eeecf7" strokeWidth="11" />
          <circle
            cx="58"
            cy="58"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="11"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <strong className="text-xl font-bold text-[#171725] tabular-nums">
            {clamped.toFixed(1)}%
          </strong>
          <span className="max-w-[76px] truncate text-[10px] text-[#7c7d8c]">{label}</span>
        </div>
      </div>
      {sublabel && <p className="mt-1 text-center text-[11px] text-[#7c7d8c]">{sublabel}</p>}
      {metrics.length > 0 && (
        <div className="mt-3 w-full divide-y divide-[#f1eff8] rounded-xl border border-[#eeecf5] bg-[#fbfbfe] px-3 py-1.5 text-xs">
          {metrics.map((m) => (
            <div key={m.label} className="flex items-center justify-between py-1">
              <span className="text-[#777884]">{m.label}</span>
              <strong className="text-[#171725] tabular-nums">{m.value}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
  href?: string;
}

export function DonutBreakdownChart({
  segments,
  centerValue,
  centerLabel,
}: {
  segments: DonutSegment[];
  centerValue?: ReactNode;
  centerLabel?: string;
}) {
  const positive = segments.filter((s) => s.value > 0);
  const total = positive.reduce((s, item) => s + item.value, 0);
  const r = 42;
  const circ = 2 * Math.PI * r;
  let acc = 0;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="relative flex h-32 w-32 shrink-0 items-center justify-center">
        <svg viewBox="0 0 108 108" className="h-32 w-32 -rotate-90" role="img" aria-label={centerLabel || "Breakdown"}>
          <circle cx="54" cy="54" r={r} fill="none" stroke="#f0eef9" strokeWidth="13" />
          {total > 0 &&
            positive.map((seg) => {
              const len = (seg.value / total) * circ;
              const dashArray = `${Math.max(1, len - 1.5)} ${circ}`;
              const dashOffset = -acc;
              acc += len;
              return (
                <circle
                  key={seg.label}
                  cx="54"
                  cy="54"
                  r={r}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth="13"
                  strokeDasharray={dashArray}
                  strokeDashoffset={dashOffset}
                >
                  <title>{`${seg.label}: ${seg.value}`}</title>
                </circle>
              );
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <strong className="text-xl font-bold text-[#171725] tabular-nums">
            {centerValue ?? total}
          </strong>
          {centerLabel && (
            <span className="text-[10px] font-medium text-[#7c7d8c]">{centerLabel}</span>
          )}
        </div>
      </div>

      <div className="w-full min-w-0 flex-1 space-y-2 text-xs">
        {segments.map((seg) => {
          const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
          const row = (
            <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-[#f7f6fb]">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="truncate text-[#3d3e4d]">{seg.label}</span>
              </span>
              <span className="shrink-0 tabular-nums text-[#7c7d8c]">
                <strong className="text-[#171725]">{seg.value}</strong> ({pct}%)
              </span>
            </div>
          );
          return seg.href ? (
            <Link key={seg.label} href={seg.href} className="block">
              {row}
            </Link>
          ) : (
            <div key={seg.label}>{row}</div>
          );
        })}
      </div>
    </div>
  );
}

const SCATTER_COLORS = [
  "#7068cf",
  "#3da7bc",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#3b82f6",
  "#14b8a6",
];

export function CarrierPerformanceChart({
  carriers = [],
}: {
  carriers?: { id: string; name: string; departures: number; on_time: number; on_time_percent: number }[];
}) {
  if (!carriers.length) {
    return (
      <p className="py-6 text-xs text-[#858693]">
        No recorded actual departures yet. Record ATD milestones on active shipments to benchmark carrier schedule reliability.
      </p>
    );
  }

  const maxDep = Math.max(5, ...carriers.map((c) => c.departures));
  const W = 320;
  const H = 175;
  const padL = 36;
  const padR = 14;
  const padT = 14;
  const padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  return (
    <div className="grid items-center gap-4 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-[175px] w-full"
          role="img"
          aria-label="Carrier on-time departure scatter plot"
        >
          {[50, 75, 90, 100].map((pct) => {
            const y = padT + plotH - ((pct - 40) / 60) * plotH;
            return (
              <g key={pct}>
                <line
                  x1={padL}
                  y1={y}
                  x2={W - padR}
                  y2={y}
                  stroke={pct === 90 ? "#cbd5e1" : "#f0eef8"}
                  strokeDasharray="3 3"
                />
                <text x={padL - 5} y={y + 3} textAnchor="end" fontSize="9" fill="#8a8b99">
                  {pct}%
                </text>
              </g>
            );
          })}
          {carriers.slice(0, 8).map((c, idx) => {
            const clampedPct = Math.max(42, Math.min(100, c.on_time_percent));
            const cx = padL + (c.departures / (maxDep * 1.1)) * plotW;
            const cy = padT + plotH - ((clampedPct - 40) / 60) * plotH;
            const radius = Math.min(11, 5.5 + Math.sqrt(c.departures) * 1.2);
            const color = SCATTER_COLORS[idx % SCATTER_COLORS.length];
            return (
              <g key={c.id}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill={color}
                  fillOpacity="0.82"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                >
                  <title>{`${c.name}: ${c.on_time_percent}% on-time (${c.on_time}/${c.departures} departures)`}</title>
                </circle>
              </g>
            );
          })}
          <text
            x={padL + plotW / 2}
            y={H - 5}
            textAnchor="middle"
            fontSize="9.5"
            fill="#7c7d8c"
          >
            Total Recorded Departures →
          </text>
        </svg>
      </div>

      <div className="space-y-2 lg:col-span-5">
        {carriers.slice(0, 6).map((c, idx) => (
          <div
            key={c.id}
            className="flex items-center justify-between gap-2 rounded-xl border border-[#f0eef8] bg-[#fbfbfe] px-3 py-2 text-xs"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: SCATTER_COLORS[idx % SCATTER_COLORS.length] }}
              />
              <span className="truncate font-semibold text-[#2d2e3d]">{c.name}</span>
            </div>
            <div className="shrink-0 text-right tabular-nums">
              <strong
                className={
                  c.on_time_percent >= 90
                    ? "text-emerald-700"
                    : c.on_time_percent >= 75
                      ? "text-amber-700"
                      : "text-rose-700"
                }
              >
                {c.on_time_percent}%
              </strong>
              <span className="ml-1.5 text-[10px] text-[#858693]">
                ({c.on_time}/{c.departures})
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function UtilizationBars({
  rows,
  capacity,
}: {
  rows: { id: string; label: string; value: number; sublabel?: string; href?: string }[];
  capacity: number;
}) {
  const safeCap = Math.max(1, capacity || 15);
  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const pct = Math.round((row.value / safeCap) * 100);
        const barWidth = Math.min(100, pct);
        const delta = pct - 100;
        const barColor =
          pct >= 100 ? "bg-rose-500" : pct >= 80 ? "bg-amber-500" : "bg-[#7068cf]";
        const inner = (
          <div className="rounded-xl border border-[#f0eef8] bg-[#fbfbfe] p-3 transition hover:border-[#d5d0f0]">
            <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-[#2d2e3d]">{row.label}</span>
              <div className="flex items-center gap-2 tabular-nums">
                <strong className="text-[#171725]">
                  {row.value} / {safeCap} jobs ({pct}%)
                </strong>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    delta > 0
                      ? "bg-rose-50 text-rose-700"
                      : delta >= -20
                        ? "bg-amber-50 text-amber-700"
                        : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {delta > 0 ? `+${delta}% over` : `${100 - pct}% spare`}
                </span>
              </div>
            </div>
            <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-[#eae7f8]">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${barWidth}%` }}
              />
            </div>
            {row.sublabel && (
              <p className="mt-1.5 text-[10px] text-[#858693]">{row.sublabel}</p>
            )}
          </div>
        );
        return row.href ? (
          <Link key={row.id} href={row.href} className="block">
            {inner}
          </Link>
        ) : (
          <div key={row.id}>{inner}</div>
        );
      })}
    </div>
  );
}
