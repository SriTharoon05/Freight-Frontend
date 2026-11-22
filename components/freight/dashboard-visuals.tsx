"use client";

import React, { useEffect, useRef, useState, type ReactNode } from "react";
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
            [
              "origin",
              "Booking & Origin",
              [
                "inquiry_received",
                "quoted",
                "quote_sent",
                "quote_accepted",
                "booked",
                "booking_confirmed",
                "draft",
                "pickup_scheduled",
                "pickup_in_progress",
                "on_hold",
              ],
            ],
            [
              "export_ops",
              "Customs & Gate-In",
              [
                "picked_up",
                "at_warehouse",
                "at_origin_warehouse",
                "customs_export",
                "customs_export_pending",
                "customs_export_cleared",
                "gate_in",
                "loaded_on_vessel",
                "awaiting_departure",
              ],
            ],
            ["in_transit", "Mainline In-Transit", ["departed", "in_transit", "transshipment", "exception"]],
            [
              "arrival_clearance",
              "Arrival & Clearance",
              [
                "arrived",
                "arrived_at_destination_port",
                "customs_import",
                "customs_import_pending",
                "customs_import_cleared",
                "customs_hold",
                "at_destination_warehouse",
                "out_for_delivery",
                "delivery_attempted",
              ],
            ],
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
  origin_lat?: number;
  origin_lng?: number;
  dest_code: string;
  dest_name?: string;
  dest_country?: string;
  dest_lat?: number;
  dest_lng?: number;
  mode?: string;
  shipments: number;
  delivered?: number;
  in_transit?: number;
  delayed?: number;
  dd_risk?: number;
  at_risk?: number;
  evaluated?: number;
  on_time_pct: number | null;
  avg_transit_days?: number | null;
}

// Real-world geographic [latitude, longitude] coordinates for global air & sea freight hubs
const REAL_HUB_LAT_LNG: Record<string, [number, number]> = {
  // North America
  LAX: [33.9416, -118.4085], USLAX: [33.7405, -118.2719], LGB: [33.7542, -118.2165],
  SFO: [37.6213, -122.379], OAK: [37.7955, -122.2792], SEA: [47.4502, -122.3088],
  ORD: [41.9742, -87.9073], JFK: [40.6413, -73.7781], NYC: [40.684, -74.006],
  USNYC: [40.684, -74.006], EWR: [40.6895, -74.1745], SAV: [32.1276, -81.2021],
  MIA: [25.7959, -80.287], IAH: [29.9902, -95.3368], HOU: [29.7355, -95.2654],
  DFW: [32.8998, -97.0403], ABI: [32.4113, -99.6819], ATL: [33.6407, -84.4277],
  BOS: [42.3656, -71.0096], CHS: [32.7833, -79.9333], ORF: [36.9466, -76.3292],
  YYZ: [43.6777, -79.6248], YVR: [49.1967, -123.1815], YUL: [45.4706, -73.7408],
  MEX: [19.4363, -99.0721], VER: [19.2006, -96.1342], ZLO: [19.0522, -104.3158],
  // South America
  GRU: [-23.4356, -46.4731], SSZ: [-23.9608, -46.3336], GIG: [-22.8099, -43.2505],
  EZE: [-34.8222, -58.5358], BUE: [-34.6037, -58.3816], SCL: [-33.393, -70.7858],
  VAP: [-33.0472, -71.6127], BOG: [4.7016, -74.1469], LIM: [-12.0219, -77.1143],
  CLL: [-12.0566, -77.1475], GYE: [-2.1574, -79.8836], MVD: [-34.9011, -56.1645],
  // Europe
  LHR: [51.47, -0.4543], LGW: [51.1537, -0.1821], FXS: [51.9542, 1.3105],
  SOU: [50.8998, -1.4044], MAN: [53.3537, -2.275], DUB: [53.4264, -6.2499],
  RTM: [51.949, 4.145], NLRTM: [51.949, 4.145], AMS: [52.3105, 4.7683],
  ANR: [51.2667, 4.4], BEANR: [51.2667, 4.4], BRU: [50.9014, 4.4844],
  ZEE: [51.3308, 3.2075], LUX: [49.6233, 6.2044],
  CDG: [49.0097, 2.5479], LEH: [49.4833, 0.1167], MRS: [43.4393, 5.2214],
  HAM: [53.5413, 9.9841], DEHAM: [53.5413, 9.9841], BRV: [53.5683, 8.5667],
  FRA: [50.0379, 8.5622], MUC: [48.3537, 11.775], BER: [52.3667, 13.5033],
  LEJ: [51.4239, 12.2364], "2MT": [51.66, 12.33],
  AAL: [57.0928, 9.8492], CPH: [55.618, 12.6508], AAR: [56.1518, 10.2108],
  OSL: [60.1976, 11.1004], ARN: [59.6498, 17.9238], GOT: [57.697, 11.8897],
  HEL: [60.3172, 24.9633],
  ZRH: [47.4582, 8.5555], BSL: [47.59, 7.5292], VIE: [48.1103, 16.5697],
  MXP: [45.6301, 8.7255], FCO: [41.8003, 12.2389], GOA: [44.4071, 8.934],
  TRN: [45.2008, 7.6496], TRS: [45.6495, 13.7768],
  BCN: [41.2974, 2.0833], VLC: [39.4461, -0.32], MAD: [40.4983, -3.5676],
  ALG_ES: [36.1408, -5.4414], LIS: [38.7756, -9.1354], OPO: [41.2481, -8.6814],
  WAW: [52.1657, 20.9671], GDN: [54.535, 18.6658], PRG: [50.1008, 14.26],
  BUD: [47.4369, 19.2556], OTP: [44.5711, 26.085], CND: [44.1733, 28.6383],
  ATH: [37.9364, 23.9445], PIR: [37.9421, 23.6371], IST: [41.2753, 28.7519],
  // Middle East & Africa
  DXB: [25.2532, 55.3657], DWC: [24.8967, 55.1614], JEA: [24.9857, 55.0273],
  AEJEA: [24.9857, 55.0273], AUH: [24.433, 54.6511], AAN: [24.2617, 55.6092],
  SHJ: [25.3286, 55.5172], DOH: [25.2731, 51.6081], BAH: [26.2708, 50.6336],
  KWI: [29.2266, 47.9689], MCT: [23.5933, 58.2844], SLL: [16.9392, 54.0002],
  JED: [21.6796, 39.1565], DMM: [26.4712, 49.7979], RUH: [24.9576, 46.6988],
  AMM: [31.7226, 35.9932], AQJ: [29.5267, 35.0078], TLV: [32.0055, 34.8854],
  AAC: [31.0733, 33.8358], CAI: [30.1219, 31.4056], ALY: [31.1839, 29.865],
  PSD: [31.2565, 32.2841], SOK: [29.6, 32.35],
  AAE: [36.8222, 7.8092], ALG: [36.691, 3.2154], TUN: [36.851, 10.2272],
  CAS: [33.3675, -7.5898], TNG: [35.8844, -5.5033],
  LOS: [6.5774, 3.3212], ACC: [5.6052, -0.1668], ABJ: [5.2614, -3.9263],
  NBO: [-1.3192, 36.9278], MBA: [-4.0435, 39.6682], DAR: [-6.8781, 39.2026],
  ADD: [8.9779, 38.7993], DJB: [11.5472, 43.1594],
  JNB: [-26.1392, 28.246], DUR: [-29.8722, 31.025], CPT: [-33.9715, 18.6021],
  // India & South Asia
  BOM: [19.0896, 72.8656], NSA: [18.95, 72.95], INNSA: [18.95, 72.95],
  MUN: [22.7469, 69.7019], INMUN: [22.7469, 69.7019], PIP: [20.9167, 71.5053],
  AMD: [23.0772, 72.6347], DEL: [28.5562, 77.1], INDEL: [28.5562, 77.1],
  MAA: [13.0827, 80.2707], INMAA: [13.0827, 80.2707], BLR: [13.1986, 77.7066],
  HYD: [17.2403, 78.4294], COK: [9.9667, 76.2667], TUT: [8.7642, 78.1348],
  CCU: [22.6547, 88.4467], VTZ: [17.7215, 83.2245],
  CMB: [6.9497, 79.8428], DAC: [23.8433, 90.3978], CGP: [22.3019, 91.8133],
  KHI: [24.8415, 66.989], LHE: [31.5216, 74.4036],
  // East & Southeast Asia
  SIN: [1.3521, 103.8198], SGSIN: [1.3521, 103.8198],
  PKG: [3.0, 101.4], MYPKG: [3.0, 101.4], TPP: [1.3625, 103.5472],
  KUL: [2.7456, 101.7072], PEN: [5.2971, 100.2769],
  BKK: [13.69, 100.7501], LCH: [13.0828, 100.8839],
  SGN: [10.8188, 106.652], HAN: [21.2212, 105.8072], HPH: [20.8449, 106.6881],
  CGK: [-6.1256, 106.6558], SUB: [-7.2108, 112.7328], MNL: [14.5086, 121.0194],
  HKG: [22.308, 113.9185], SZX: [22.6393, 113.8107], CNSZX: [22.502, 113.883],
  YAT: [22.575, 114.276], CAN: [23.3924, 113.2988], CNNSA: [22.748, 113.604],
  SHA: [31.2304, 121.4737], CNSHA: [31.2304, 121.4737], PVG: [31.1443, 121.8083],
  NGB: [29.8683, 121.544], CNNGB: [29.8683, 121.544], TAO: [36.0671, 120.3826],
  CNTAO: [36.0671, 120.3826], TSN: [38.9942, 117.7042], CNTSN: [38.9942, 117.7042],
  XMN: [24.4798, 118.0894], DLC: [38.914, 121.6147],
  TPE: [25.0797, 121.2342], KHH: [22.5771, 120.35],
  ICN: [37.4602, 126.4407], PUS: [35.1028, 129.0403],
  NRT: [35.772, 140.3929], HND: [35.5494, 139.7798], TYO: [35.6762, 139.6503],
  YOK: [35.4437, 139.638], KIX: [34.432, 135.2304], NGO: [34.8584, 136.8054],
  // Oceania
  SYD: [-33.9399, 151.1753], MEL: [-37.669, 144.841], BNE: [-27.3842, 153.1175],
  PER: [-31.9403, 115.9672], AKL: [-37.0082, 174.785],
};

const REAL_COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  US: [38.9, -96.8], "UNITED STATES": [38.9, -96.8], USA: [38.9, -96.8],
  CA: [51.0, -102.0], CANADA: [51.0, -102.0],
  MX: [21.2, -101.5], MEXICO: [21.2, -101.5],
  BR: [-22.9, -46.6], BRAZIL: [-22.9, -46.6],
  AR: [-34.6, -58.4], ARGENTINA: [-34.6, -58.4],
  CL: [-33.4, -70.6], CHILE: [-33.4, -70.6],
  CO: [4.7, -74.1], COLOMBIA: [4.7, -74.1],
  PE: [-12.0, -77.0], PERU: [-12.0, -77.0],
  GB: [51.5, -0.1], UK: [51.5, -0.1], "UNITED KINGDOM": [51.5, -0.1],
  NL: [52.1, 4.8], NETHERLANDS: [52.1, 4.8],
  BE: [50.85, 4.35], BELGIUM: [50.85, 4.35],
  FR: [48.85, 2.35], FRANCE: [48.85, 2.35],
  DE: [51.16, 10.45], GERMANY: [51.16, 10.45],
  DK: [56.26, 9.5], DENMARK: [56.26, 9.5],
  NO: [59.9, 10.75], NORWAY: [59.9, 10.75],
  SE: [59.33, 18.06], SWEDEN: [59.33, 18.06],
  FI: [60.17, 24.94], FINLAND: [60.17, 24.94],
  CH: [47.37, 8.54], SWITZERLAND: [47.37, 8.54],
  AT: [48.2, 16.37], AUSTRIA: [48.2, 16.37],
  IT: [43.8, 11.2], ITALY: [43.8, 11.2],
  ES: [40.4, -3.7], SPAIN: [40.4, -3.7],
  PT: [38.7, -9.1], PORTUGAL: [38.7, -9.1],
  PL: [52.23, 21.01], POLAND: [52.23, 21.01],
  CZ: [50.07, 14.43], CZECHIA: [50.07, 14.43],
  GR: [37.98, 23.72], GREECE: [37.98, 23.72],
  TR: [41.0, 28.97], TURKEY: [41.0, 28.97],
  AE: [24.45, 54.65], "UNITED ARAB EMIRATES": [24.45, 54.65], UAE: [24.45, 54.65],
  SA: [24.7, 46.67], "SAUDI ARABIA": [24.7, 46.67],
  QA: [25.28, 51.53], QATAR: [25.28, 51.53],
  OM: [23.58, 58.4], OMAN: [23.58, 58.4],
  KW: [29.37, 47.97], KUWAIT: [29.37, 47.97],
  BH: [26.22, 50.58], BAHRAIN: [26.22, 50.58],
  EG: [30.04, 31.23], EGYPT: [30.04, 31.23],
  DZ: [36.75, 3.05], ALGERIA: [36.75, 3.05],
  MA: [33.57, -7.59], MOROCCO: [33.57, -7.59],
  ZA: [-29.85, 31.02], "SOUTH AFRICA": [-29.85, 31.02],
  KE: [-1.29, 36.82], KENYA: [-1.29, 36.82],
  NG: [6.52, 3.38], NIGERIA: [6.52, 3.38],
  IN: [20.59, 78.96], INDIA: [20.59, 78.96],
  LK: [6.93, 79.85], "SRI LANKA": [6.93, 79.85],
  BD: [23.81, 90.41], BANGLADESH: [23.81, 90.41],
  PK: [24.86, 67.0], PAKISTAN: [24.86, 67.0],
  SG: [1.35, 103.82], SINGAPORE: [1.35, 103.82],
  MY: [3.14, 101.68], MALAYSIA: [3.14, 101.68],
  TH: [13.75, 100.5], THAILAND: [13.75, 100.5],
  VN: [10.82, 106.63], VIETNAM: [10.82, 106.63],
  ID: [-6.2, 106.84], INDONESIA: [-6.2, 106.84],
  PH: [14.6, 120.98], PHILIPPINES: [14.6, 120.98],
  HK: [22.31, 114.17], "HONG KONG": [22.31, 114.17],
  CN: [31.23, 121.47], CHINA: [31.23, 121.47],
  TW: [25.03, 121.56], TAIWAN: [25.03, 121.56],
  KR: [37.56, 126.97], "SOUTH KOREA": [37.56, 126.97],
  JP: [35.67, 139.65], JAPAN: [35.67, 139.65],
  AU: [-33.86, 151.2], AUSTRALIA: [-33.86, 151.2],
  NZ: [-36.84, 174.76], "NEW ZEALAND": [-36.84, 174.76],
};

function cleanHubCode(raw?: string): string {
  const trimmed = (raw || "").trim().toUpperCase();
  if (!trimmed) return "";
  const prefix = trimmed.split(/[\s\-/(_]/)[0] || trimmed;
  return prefix;
}

export function resolveRealLatLng(
  code?: string,
  country?: string,
  name?: string,
  explicitLat?: number,
  explicitLng?: number,
): [number, number] {
  if (
    typeof explicitLat === "number" &&
    typeof explicitLng === "number" &&
    Number.isFinite(explicitLat) &&
    Number.isFinite(explicitLng)
  ) {
    return [explicitLat, explicitLng];
  }

  const rawCode = (code || "").trim().toUpperCase();
  const c = cleanHubCode(code);
  const cc = (country || "").trim().toUpperCase();
  const nm = (name || "").trim().toLowerCase();

  // Disambiguate shared 3-letter codes by city/country metadata
  if (c === "MCT") {
    if (cc === "BR" || cc === "BRAZIL" || nm.includes("miracatu")) {
      return [-24.2814, -47.4597];
    }
    if (cc === "BE" || cc === "BELGIUM" || nm.includes("mourcourt")) {
      return [50.6532, 3.4447];
    }
    return [23.5933, 58.2844];
  }
  if (c === "MTC") {
    if (cc === "AR" || cc === "ARGENTINA" || nm.includes("montecarlo")) {
      return [-26.5685, -54.7579];
    }
    return [42.6139, -82.8369];
  }

  if (rawCode && REAL_HUB_LAT_LNG[rawCode]) return REAL_HUB_LAT_LNG[rawCode];
  if (c && REAL_HUB_LAT_LNG[c]) return REAL_HUB_LAT_LNG[c];
  if (c.length === 5 && REAL_HUB_LAT_LNG[c.slice(2)]) return REAL_HUB_LAT_LNG[c.slice(2)];

  // City-name keyword resolution
  if (nm.includes("al arish")) return REAL_HUB_LAT_LNG.AAC;
  if (nm.includes("alborg") || nm.includes("aalborg")) return REAL_HUB_LAT_LNG.AAL;
  if (nm.includes("annaba")) return REAL_HUB_LAT_LNG.AAE;
  if (nm.includes("al ain")) return REAL_HUB_LAT_LNG.AAN;
  if (nm.includes("abilene")) return REAL_HUB_LAT_LNG.ABI;
  if (nm.includes("ahmedabad")) return REAL_HUB_LAT_LNG.AMD;
  if (nm.includes("abu dhabi")) return REAL_HUB_LAT_LNG.AUH;
  if (nm.includes("vienna") || nm.includes("wien")) return REAL_HUB_LAT_LNG.VIE;
  if (nm.includes("muldestausee")) return REAL_HUB_LAT_LNG["2MT"];
  if (nm.includes("nhava") || nm.includes("mumbai") || nm.includes("bombay")) return REAL_HUB_LAT_LNG.BOM;
  if (nm.includes("mundra")) return REAL_HUB_LAT_LNG.MUN;
  if (nm.includes("chennai") || nm.includes("madras")) return REAL_HUB_LAT_LNG.MAA;
  if (nm.includes("delhi")) return REAL_HUB_LAT_LNG.DEL;
  if (nm.includes("bangalore") || nm.includes("bengaluru")) return REAL_HUB_LAT_LNG.BLR;
  if (nm.includes("shanghai")) return REAL_HUB_LAT_LNG.SHA;
  if (nm.includes("shenzhen") || nm.includes("yantian") || nm.includes("nansha")) return REAL_HUB_LAT_LNG.SZX;
  if (nm.includes("ningbo")) return REAL_HUB_LAT_LNG.NGB;
  if (nm.includes("qingdao")) return REAL_HUB_LAT_LNG.TAO;
  if (nm.includes("jebel") || nm.includes("dubai")) return REAL_HUB_LAT_LNG.DXB;
  if (nm.includes("singapore")) return REAL_HUB_LAT_LNG.SIN;
  if (nm.includes("rotterdam")) return REAL_HUB_LAT_LNG.RTM;
  if (nm.includes("antwerp")) return REAL_HUB_LAT_LNG.ANR;
  if (nm.includes("hamburg")) return REAL_HUB_LAT_LNG.HAM;
  if (nm.includes("frankfurt")) return REAL_HUB_LAT_LNG.FRA;
  if (nm.includes("london") || nm.includes("felixstowe")) return REAL_HUB_LAT_LNG.LHR;
  if (nm.includes("los angeles") || nm.includes("long beach")) return REAL_HUB_LAT_LNG.LAX;
  if (nm.includes("new york") || nm.includes("newark")) return REAL_HUB_LAT_LNG.NYC;

  if (cc && REAL_COUNTRY_CENTROIDS[cc]) return REAL_COUNTRY_CENTROIDS[cc];
  if (c.length >= 2 && REAL_COUNTRY_CENTROIDS[c.slice(0, 2)]) {
    return REAL_COUNTRY_CENTROIDS[c.slice(0, 2)];
  }
  return [25.2532, 55.3657];
}

export type CorridorHealthKey = "ontime" | "scheduled" | "watch" | "delayed";

export function getCorridorStatus(lane: CorridorLane): {
  key: CorridorHealthKey;
  color: string;
  badgeText: string;
  otpText: string;
  textClass: string;
} {
  const delayed = Number(lane.delayed || 0);
  const ddRisk = Number(lane.dd_risk || 0);
  const evaluated = Number(lane.evaluated || 0);
  const delivered = Number(lane.delivered || 0);
  const pct =
    typeof lane.on_time_pct === "number" && Number.isFinite(lane.on_time_pct)
      ? lane.on_time_pct
      : null;

  if (delayed > 0 || (pct !== null && pct < 75)) {
    return {
      key: "delayed",
      color: "#f43f5e",
      badgeText: delayed > 0 ? `${delayed} Delayed` : "Delayed (<75%)",
      otpText:
        pct !== null
          ? `${pct}% OTP (${delayed} past ETD/ETA)`
          : `${delayed} past ETD/ETA`,
      textClass: "text-rose-300",
    };
  }

  if (ddRisk > 0 || (pct !== null && pct < 90)) {
    return {
      key: "watch",
      color: "#f59e0b",
      badgeText: ddRisk > 0 ? `${ddRisk} D&D Watch` : "Watch (75–89%)",
      otpText: pct !== null ? `${pct}% OTP` : "D&D Free-Time Watch",
      textClass: "text-amber-300",
    };
  }

  if (evaluated > 0 || delivered > 0 || (pct !== null && pct >= 90)) {
    return {
      key: "ontime",
      color: "#10b981",
      badgeText: `${pct ?? 100}% On-Time`,
      otpText: `${pct ?? 100}% On-Time`,
      textClass: "text-emerald-300",
    };
  }

  return {
    key: "scheduled",
    color: "#38bdf8",
    badgeText: "Scheduled / Active",
    otpText: "On schedule (awaiting ETD/ETA)",
    textClass: "text-sky-300",
  };
}

function computeCurvedArc(
  start: [number, number],
  end: [number, number],
  segments = 36,
): [number, number][] {
  const [lat1, lng1] = start;
  let [lat2, lng2] = end;
  // Choose shortest longitudinal path
  const dLngRaw = lng2 - lng1;
  if (dLngRaw > 180) lng2 -= 360;
  else if (dLngRaw < -180) lng2 += 360;

  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  const span = Math.hypot(dLat, dLng);
  if (span < 0.05) return [start, end];

  // Subtle poleward curvature mimicking great-circle geodesic flight/shipping paths
  const midLat = (lat1 + lat2) / 2;
  const midLng = (lng1 + lng2) / 2;
  const poleSign = midLat >= 0 ? 1 : -1;
  const lift = Math.min(18, span * 0.16) * poleSign;
  const ctrlLat = Math.max(-78, Math.min(78, midLat + lift));
  const ctrlLng = midLng;

  const pts: [number, number][] = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const inv = 1 - t;
    const lat = inv * inv * lat1 + 2 * inv * t * ctrlLat + t * t * lat2;
    const lng = inv * inv * lng1 + 2 * inv * t * ctrlLng + t * t * lng2;
    pts.push([lat, lng]);
  }
  return pts;
}

type LeafletGlobal = {
  map: (el: HTMLElement, opts?: Record<string, unknown>) => any;
  tileLayer: (url: string, opts?: Record<string, unknown>) => any;
  geoJSON: (data: unknown, opts?: Record<string, unknown>) => any;
  layerGroup: () => any;
  polyline: (pts: [number, number][], opts?: Record<string, unknown>) => any;
  circleMarker: (pt: [number, number], opts?: Record<string, unknown>) => any;
  marker: (pt: [number, number], opts?: Record<string, unknown>) => any;
  divIcon: (opts?: Record<string, unknown>) => any;
  latLngBounds: (pts: [number, number][]) => any;
};

let leafletLoadPromise: Promise<LeafletGlobal | null> | null = null;
let worldGeoJsonPromise: Promise<unknown | null> | null = null;

function loadWorldGeoJson(): Promise<unknown | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!worldGeoJsonPromise) {
    worldGeoJsonPromise = fetch("/leaflet/world-countries.json")
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);
  }
  return worldGeoJsonPromise;
}

function ensureLeafletLoaded(): Promise<LeafletGlobal | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  const w = window as unknown as { L?: LeafletGlobal };
  if (w.L) return Promise.resolve(w.L);
  if (leafletLoadPromise) return leafletLoadPromise;

  leafletLoadPromise = new Promise((resolve) => {
    if (!document.getElementById("freight-leaflet-css")) {
      const link = document.createElement("link");
      link.id = "freight-leaflet-css";
      link.rel = "stylesheet";
      link.href = "/leaflet/leaflet.css";
      document.head.appendChild(link);
    }

    const existingScript = document.getElementById(
      "freight-leaflet-js",
    ) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(w.L || null), { once: true });
      existingScript.addEventListener("error", () => resolve(null), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = "freight-leaflet-js";
    script.src = "/leaflet/leaflet.js";
    script.async = true;
    script.onload = () => resolve(w.L || null);
    script.onerror = () => resolve(null);
    document.body.appendChild(script);
  });

  return leafletLoadPromise;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// 100% free, keyless map basemaps (Natural Earth self-hosted vector + OSM + Esri public imagery)
const RASTER_TILE_THEMES = {
  osm: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics",
    maxZoom: 18,
  },
} as const;

type CorridorMapStyle = "vector" | "osm" | "satellite";

export function GlobalCorridorMap({
  lanes = [],
  summary,
}: {
  lanes?: CorridorLane[];
  summary?: {
    booked?: number;
    in_transit: number;
    arrived?: number;
    delivered: number;
    dd_at_risk: number;
    delayed: number;
  };
}) {
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [mapStyle, setMapStyle] = useState<CorridorMapStyle>("vector");
  const [mapReady, setMapReady] = useState<boolean>(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const baseLayerGroupRef = useRef<any>(null);
  const overlayGroupRef = useRef<any>(null);
  const hasFittedBoundsRef = useRef<boolean>(false);
  const prevLanesSigRef = useRef<string>("");

  const visibleLanes = lanes.slice(0, 12);
  const safeSelectedIdx =
    visibleLanes.length > 0 ? Math.min(selectedIdx, visibleLanes.length - 1) : 0;
  const activeLane = visibleLanes[safeSelectedIdx] || visibleLanes[0] || null;
  const activeStatus = activeLane ? getCorridorStatus(activeLane) : null;

  // Initialize real interactive Leaflet world map on mount
  useEffect(() => {
    let cancelled = false;
    void ensureLeafletLoaded().then((L) => {
      if (cancelled || !L || !mapContainerRef.current || mapInstanceRef.current) return;

      const map = L.map(mapContainerRef.current, {
        center: [24, 28],
        zoom: 2,
        minZoom: 2,
        maxZoom: 12,
        zoomControl: true,
        scrollWheelZoom: false,
        worldCopyJump: true,
        attributionControl: true,
      });

      const baseGroup = L.layerGroup().addTo(map);
      const overlayGroup = L.layerGroup().addTo(map);

      mapInstanceRef.current = map;
      baseLayerGroupRef.current = baseGroup;
      overlayGroupRef.current = overlayGroup;
      setMapReady(true);
    });

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        baseLayerGroupRef.current = null;
        overlayGroupRef.current = null;
      }
    };
  }, []);

  // Switch basemap between Self-Hosted Natural Earth Vector Radar, Free OSM Street Map & Satellite
  useEffect(() => {
    if (!mapReady || typeof window === "undefined") return;
    const L = (window as unknown as { L?: LeafletGlobal }).L;
    const map = mapInstanceRef.current;
    const baseGroup = baseLayerGroupRef.current;
    if (!L || !map || !baseGroup) return;

    let stale = false;
    baseGroup.clearLayers();

    if (mapContainerRef.current) {
      mapContainerRef.current.style.background =
        mapStyle === "osm" ? "#dbeafe" : "#081022";
    }

    if (mapStyle === "vector") {
      // Subtle maritime/aviation graticule lines across oceans
      for (const lat of [-60, -30, 0, 30, 60]) {
        L.polyline(
          [
            [lat, -360],
            [lat, 360],
          ],
          {
            color: lat === 0 ? "rgba(99,179,237,0.16)" : "rgba(148,163,184,0.08)",
            weight: lat === 0 ? 1 : 0.7,
            dashArray: lat === 0 ? undefined : "4 6",
            interactive: false,
          },
        ).addTo(baseGroup);
      }
      for (const lng of [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150]) {
        L.polyline(
          [
            [-80, lng],
            [82, lng],
          ],
          {
            color: "rgba(148,163,184,0.07)",
            weight: 0.7,
            dashArray: "4 6",
            interactive: false,
          },
        ).addTo(baseGroup);
      }

      void loadWorldGeoJson().then((geoData) => {
        if (stale || !geoData || !baseLayerGroupRef.current) return;
        const baseStyle = {
          fillColor: "#162344",
          fillOpacity: 0.96,
          color: "#2c4175",
          weight: 0.85,
        };
        const geoLayer = L.geoJSON(geoData, {
          style: () => baseStyle,
          onEachFeature: (feature: any, layer: any) => {
            const countryName = feature?.properties?.n;
            if (countryName) {
              layer.on({
                mouseover: () =>
                  layer.setStyle({
                    fillColor: "#1f3260",
                    color: "#4a69b8",
                    weight: 1.1,
                  }),
                mouseout: () => layer.setStyle(baseStyle),
              });
            }
          },
        });
        geoLayer.addTo(baseGroup);
        if (overlayGroupRef.current && overlayGroupRef.current.bringToFront) {
          overlayGroupRef.current.bringToFront();
        }
      });
    } else {
      const theme = RASTER_TILE_THEMES[mapStyle];
      const nextTile = L.tileLayer(theme.url, {
        attribution: theme.attribution,
        maxZoom: theme.maxZoom,
      });
      nextTile.addTo(baseGroup);
    }

    return () => {
      stale = true;
    };
  }, [mapStyle, mapReady]);

  // Plot real geodesic trade corridors & deduplicated hub markers
  useEffect(() => {
    if (!mapReady || typeof window === "undefined") return;
    const L = (window as unknown as { L?: LeafletGlobal }).L;
    const map = mapInstanceRef.current;
    const group = overlayGroupRef.current;
    if (!L || !map || !group) return;

    group.clearLayers();
    if (!visibleLanes.length) return;

    const allPoints: [number, number][] = [];
    const hubRegistry = new Map<
      string,
      {
        coord: [number, number];
        code: string;
        name: string;
        country: string;
        color: string;
        isSelected: boolean;
        laneIdx: number;
        shipments: number;
      }
    >();

    // Draw unselected lanes first so the selected lane sits cleanly on top
    const drawOrder = visibleLanes
      .map((lane, idx) => ({ lane, idx }))
      .sort((a, b) => (a.idx === safeSelectedIdx ? 1 : b.idx === safeSelectedIdx ? -1 : 0));

    for (const { lane, idx } of drawOrder) {
      const start = resolveRealLatLng(
        lane.origin_code,
        lane.origin_country,
        lane.origin_name,
        lane.origin_lat,
        lane.origin_lng,
      );
      const end = resolveRealLatLng(
        lane.dest_code,
        lane.dest_country,
        lane.dest_name,
        lane.dest_lat,
        lane.dest_lng,
      );
      allPoints.push(start, end);

      const status = getCorridorStatus(lane);
      const isSelected = idx === safeSelectedIdx;
      const arcPoints = computeCurvedArc(start, end, 40);
      const cleanOrig = cleanHubCode(lane.origin_code) || lane.origin_code;
      const cleanDest = cleanHubCode(lane.dest_code) || lane.dest_code;

      if (isSelected) {
        L.polyline(arcPoints, {
          color: status.color,
          weight: 8,
          opacity: 0.24,
          interactive: false,
        }).addTo(group);
      }

      const arcLine = L.polyline(arcPoints, {
        color: status.color,
        weight: isSelected ? 3.2 : Math.min(2.6, 1.8 + lane.shipments * 0.15),
        opacity: isSelected ? 0.98 : 0.78,
        dashArray: lane.mode === "air" ? "6 5" : undefined,
      });

      const tooltipHtml = `
        <div style="font-family:Inter,system-ui,sans-serif;font-size:11px;line-height:1.35;">
          <div style="font-weight:700;color:#0f172a;">
            ${escapeHtml(lane.origin_name || cleanOrig)} (${escapeHtml(cleanOrig)}) &rarr; ${escapeHtml(lane.dest_name || cleanDest)} (${escapeHtml(cleanDest)})
          </div>
          <div style="color:#475569;margin-top:2px;">
            <strong style="text-transform:uppercase;">${escapeHtml(lane.mode || "ocean")}</strong>
            &middot; ${lane.shipments} shipment${lane.shipments === 1 ? "" : "s"}
            &middot; <span style="font-weight:600;">${escapeHtml(status.badgeText)}</span>
          </div>
        </div>
      `;
      arcLine.bindTooltip(tooltipHtml, { sticky: true, direction: "top" });
      arcLine.on("click", () => setSelectedIdx(idx));
      arcLine.addTo(group);

      const registerHub = (
        coord: [number, number],
        codeStr: string,
        nameStr?: string,
        countryStr?: string,
        hubColor?: string,
      ) => {
        const key = `${coord[0].toFixed(2)},${coord[1].toFixed(2)}`;
        const prev = hubRegistry.get(key);
        if (!prev) {
          hubRegistry.set(key, {
            coord,
            code: codeStr,
            name: nameStr || codeStr,
            country: countryStr || "",
            color: hubColor || status.color,
            isSelected,
            laneIdx: idx,
            shipments: lane.shipments,
          });
        } else {
          prev.shipments += lane.shipments;
          if (isSelected) {
            prev.isSelected = true;
            prev.color = hubColor || status.color;
            prev.laneIdx = idx;
          } else if (status.key === "delayed") {
            prev.color = "#f43f5e";
          }
        }
      };

      registerHub(start, cleanOrig, lane.origin_name, lane.origin_country, status.color);
      registerHub(end, cleanDest, lane.dest_name, lane.dest_country, status.color);
    }

    // Render crisp hub markers and non-overlapping IATA/UNLOCODE pill badges
    const darkTheme = mapStyle !== "osm";
    for (const hub of Array.from(hubRegistry.values())) {
      const marker = L.circleMarker(hub.coord, {
        radius: hub.isSelected ? 6.5 : 4.8,
        color: darkTheme ? "#0f172a" : "#ffffff",
        weight: 2,
        fillColor: hub.color,
        fillOpacity: 1,
      });
      marker.bindTooltip(
        `<div style="font-family:Inter,system-ui,sans-serif;font-size:11px;">
          <strong>${escapeHtml(hub.name)} (${escapeHtml(hub.code)})</strong>${
            hub.country ? ` &middot; ${escapeHtml(hub.country)}` : ""
          }
        </div>`,
        { direction: "top", offset: [0, -6] },
      );
      marker.on("click", () => setSelectedIdx(hub.laneIdx));
      marker.addTo(group);

      const labelBg = darkTheme
        ? hub.isSelected
          ? "rgba(15,23,42,0.94)"
          : "rgba(15,23,42,0.82)"
        : hub.isSelected
          ? "rgba(15,23,42,0.92)"
          : "rgba(255,255,255,0.92)";
      const labelFg = darkTheme || hub.isSelected ? "#f8fafc" : "#0f172a";
      const borderCol = hub.isSelected ? hub.color : "rgba(148,163,184,0.35)";

      const codeBadge = L.marker(hub.coord, {
        interactive: false,
        icon: L.divIcon({
          className: "freight-hub-badge",
          html: `<span style="display:inline-block;transform:translate(-50%,-135%);padding:1px 5px;border-radius:4px;background:${labelBg};color:${labelFg};border:1px solid ${borderCol};font-size:9.5px;font-weight:700;letter-spacing:0.03em;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.3);">${escapeHtml(
            hub.code,
          )}</span>`,
          iconSize: [0, 0],
        }),
      });
      codeBadge.addTo(group);
    }

    const sig = visibleLanes
      .map((l) => `${l.origin_code}-${l.dest_code}-${l.shipments}`)
      .join("|");
    if ((!hasFittedBoundsRef.current || prevLanesSigRef.current !== sig) && allPoints.length >= 2) {
      hasFittedBoundsRef.current = true;
      prevLanesSigRef.current = sig;
      try {
        map.fitBounds(L.latLngBounds(allPoints), {
          padding: [34, 34],
          maxZoom: 5,
        });
      } catch {}
    }
  }, [visibleLanes, safeSelectedIdx, mapStyle, mapReady]);

  function fitAllCorridors() {
    if (typeof window === "undefined") return;
    const L = (window as unknown as { L?: LeafletGlobal }).L;
    const map = mapInstanceRef.current;
    if (!L || !map || !visibleLanes.length) return;
    const pts: [number, number][] = [];
    for (const lane of visibleLanes) {
      pts.push(
        resolveRealLatLng(
          lane.origin_code,
          lane.origin_country,
          lane.origin_name,
          lane.origin_lat,
          lane.origin_lng,
        ),
        resolveRealLatLng(
          lane.dest_code,
          lane.dest_country,
          lane.dest_name,
          lane.dest_lat,
          lane.dest_lng,
        ),
      );
    }
    if (pts.length >= 2) {
      map.fitBounds(L.latLngBounds(pts), { padding: [34, 34], maxZoom: 5 });
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#232946] bg-gradient-to-br from-[#121629] via-[#181f38] to-[#1d2544] p-5 text-white shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8ea0c8]">
            Global Trade-Lane Visibility · Real Geodesic Map
          </span>
          <h3 className="text-sm font-semibold text-white">
            Active Freight Corridors &amp; Hub Status
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-2.5 text-[10px] text-[#cbd5e1]">
            <span className="inline-flex items-center gap-1.5" title="Evaluated shipments departed/arrived on time (≥90%)">
              <span className="h-2.5 w-2.5 rounded-full bg-[#10b981]" /> On-Time (≥90%)
            </span>
            <span className="inline-flex items-center gap-1.5" title="Booked or in-transit shipments on schedule awaiting ETD/ETA">
              <span className="h-2.5 w-2.5 rounded-full bg-[#38bdf8]" /> Scheduled / Active
            </span>
            <span className="inline-flex items-center gap-1.5" title="75–89% OTP or container D&D free-time watch">
              <span className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]" /> Watch / D&amp;D
            </span>
            <span className="inline-flex items-center gap-1.5" title="Past scheduled ETD/ETA or <75% OTP">
              <span className="h-2.5 w-2.5 rounded-full bg-[#f43f5e]" /> Delayed
            </span>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 p-0.5 text-[10px]">
            <button
              type="button"
              onClick={() => setMapStyle("vector")}
              className={`rounded-md px-2 py-1 font-medium transition ${
                mapStyle === "vector"
                  ? "bg-[#7068cf] text-white"
                  : "text-[#b4c2e0] hover:text-white"
              }`}
            >
              Dark Radar
            </button>
            <button
              type="button"
              onClick={() => setMapStyle("osm")}
              className={`rounded-md px-2 py-1 font-medium transition ${
                mapStyle === "osm"
                  ? "bg-[#7068cf] text-white"
                  : "text-[#b4c2e0] hover:text-white"
              }`}
            >
              Street Map
            </button>
            <button
              type="button"
              onClick={() => setMapStyle("satellite")}
              className={`rounded-md px-2 py-1 font-medium transition ${
                mapStyle === "satellite"
                  ? "bg-[#7068cf] text-white"
                  : "text-[#b4c2e0] hover:text-white"
              }`}
            >
              Satellite
            </button>
            <button
              type="button"
              onClick={fitAllCorridors}
              className="rounded-md px-2 py-1 font-medium text-[#b4c2e0] transition hover:bg-white/10 hover:text-white"
              title="Zoom to fit all active trade corridors"
            >
              Fit Routes
            </button>
          </div>
        </div>
      </div>

      <div className="relative rounded-xl border border-white/10 bg-[#0b1020] p-2">
        <div className="relative h-[320px] w-full overflow-hidden rounded-lg border border-white/10 bg-[#0d1326]">
          <div
            ref={mapContainerRef}
            role="region"
            aria-label="Global freight corridors interactive world map"
            className="h-full w-full"
          />
          {!mapReady && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#0d1326]/90 text-xs text-[#94a3b8]">
              Loading interactive world map…
            </div>
          )}
        </div>

        {/* Interactive corridor selector pills for one-click inspection */}
        {visibleLanes.length > 1 && (
          <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-1">
            {visibleLanes.map((lane, idx) => {
              const st = getCorridorStatus(lane);
              const active = idx === safeSelectedIdx;
              const oCode = cleanHubCode(lane.origin_code) || lane.origin_code;
              const dCode = cleanHubCode(lane.dest_code) || lane.dest_code;
              return (
                <button
                  key={`${lane.origin_code}-${lane.dest_code}-${lane.mode}-${idx}`}
                  type="button"
                  onClick={() => setSelectedIdx(idx)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-semibold transition ${
                    active
                      ? "border-white/30 bg-white/15 text-white shadow-sm"
                      : "border-white/10 bg-[#141b33]/70 text-[#b4c2e0] hover:border-white/20 hover:text-white"
                  }`}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: st.color }}
                  />
                  <span>
                    {oCode} → {dCode}
                  </span>
                  <span className="text-[9px] font-normal text-[#8ea0c8]">
                    ({lane.shipments})
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Bottom live fleet stage strip aligned with lifecycle pipeline */}
        {summary && (
          <div
            className={`mt-2 grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-[#141b33]/90 px-3 py-2 text-[11px] ${
              summary.booked !== undefined ? "sm:grid-cols-5" : "sm:grid-cols-4"
            }`}
          >
            {summary.booked !== undefined && (
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[#a9b8d9]">
                  <span className="h-2 w-2 rounded-full bg-[#818cf8]" /> Booked / Origin
                </span>
                <strong className="tabular-nums text-white">{summary.booked}</strong>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[#a9b8d9]">
                <span className="h-2 w-2 rounded-full bg-[#38bdf8]" /> In Transit
              </span>
              <strong className="tabular-nums text-white">{summary.in_transit}</strong>
            </div>
            {summary.arrived !== undefined ? (
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[#a9b8d9]">
                  <span className="h-2 w-2 rounded-full bg-[#2dd4bf]" /> Arrived / Port
                </span>
                <strong className="tabular-nums text-white">{summary.arrived}</strong>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[#a9b8d9]">
                  <span className="h-2 w-2 rounded-full bg-amber-400" /> D&amp;D Watch
                </span>
                <strong className="tabular-nums text-white">{summary.dd_at_risk}</strong>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[#a9b8d9]">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> Delivered
              </span>
              <strong className="tabular-nums text-white">{summary.delivered}</strong>
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

      {activeLane && activeStatus ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/5 px-3.5 py-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-[#7068cf]/30 px-2 py-0.5 text-[10px] font-bold uppercase text-[#c7c2ff]">
              {activeLane.mode || "ocean"}
            </span>
            <strong className="text-white">
              {activeLane.origin_name || cleanHubCode(activeLane.origin_code)} (
              {cleanHubCode(activeLane.origin_code) || activeLane.origin_code}) →{" "}
              {activeLane.dest_name || cleanHubCode(activeLane.dest_code)} (
              {cleanHubCode(activeLane.dest_code) || activeLane.dest_code})
            </strong>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#cbd5e1] tabular-nums">
            <span>
              <strong>{activeLane.shipments}</strong> shipment
              {activeLane.shipments === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: activeStatus.color }}
              />
              <strong className={activeStatus.textClass}>{activeStatus.otpText}</strong>
            </span>
            {!!activeLane.avg_transit_days && (
              <span>
                Avg transit: <strong>{activeLane.avg_transit_days}d</strong>
              </span>
            )}
            {!!activeLane.dd_risk && (
              <span className="text-amber-300">
                D&amp;D watch: <strong>{activeLane.dd_risk}</strong>
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

function heatCellClass(score: number | null, lane?: CorridorLane): string {
  if (lane && Number(lane.delayed || 0) > 0) {
    return "bg-rose-500 text-white font-semibold";
  }
  if (score === null) {
    return lane
      ? "bg-sky-50 text-sky-700 font-semibold border border-sky-200/80"
      : "bg-[#f6f5fb] text-[#b0b1bf]";
  }
  if (score >= 90) return "bg-emerald-600 text-white font-semibold";
  if (score >= 75) return "bg-amber-400/90 text-[#1e1b2e] font-semibold";
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
              <th
                title="POL = Port / Airport of Loading (Origin) · POD = Port / Airport of Discharge (Destination)"
                className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[#858693]"
              >
                Origin (POL) \ Dest (POD)
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
                  const score =
                    cell && typeof cell.on_time_pct === "number" && Number.isFinite(cell.on_time_pct)
                      ? Math.round(cell.on_time_pct)
                      : null;
                  return (
                    <td
                      key={`${o}-${d}`}
                      title={
                        cell
                          ? score !== null
                            ? `${o} → ${d}: ${cell.on_time_pct}% on-time (${cell.shipments} shipments)`
                            : `${o} → ${d}: ${cell.shipments} scheduled (awaiting ETD/ETA)`
                          : `${o} → ${d}: no shipments`
                      }
                      className={`rounded-lg px-2 py-2.5 text-center tabular-nums transition ${heatCellClass(score, cell)}`}
                    >
                      {score !== null
                        ? `${score}%`
                        : cell
                          ? Number(cell.delayed || 0) > 0
                            ? "Delayed"
                            : "Scheduled"
                          : "—"}
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
  const rawMax = Math.max(0, ...allValues);
  const step = Math.max(1, Math.ceil((Math.max(3, rawMax) * 1.15) / 4));
  const niceMax = step * 4;

  const seriesTotals = new Map<string, number>();
  for (const s of series) {
    const sum = data.reduce((acc, row) => acc + Math.max(0, Number(row[s.key] || 0)), 0);
    seriesTotals.set(s.key, Math.round(sum * 100) / 100);
  }

  const xAt = (i: number) =>
    data.length === 1 ? padL + plotW / 2 : padL + (i / (data.length - 1)) * plotW;
  const yAt = (val: number) => padT + plotH - (Math.max(0, val) / (niceMax || 1)) * plotH;

  const barSeries = series.filter((s) => s.kind === "bar");
  const lineSeries = series.filter((s) => s.kind !== "bar");
  const slotW = plotW / Math.max(1, data.length);
  const barW = barSeries.length ? Math.min(24, (slotW * 0.52) / barSeries.length) : 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-[11px]">
        {series.map((s) => {
          const total = seriesTotals.get(s.key) || 0;
          const formattedTotal =
            total >= 1000
              ? `${valuePrefix}${(total / 1000).toFixed(1)}k`
              : `${valuePrefix}${total.toLocaleString()}`;
          return (
            <span
              key={s.key}
              className={`inline-flex items-center gap-1.5 font-medium ${
                total === 0 ? "text-[#9ca3af]" : "text-[#4a4b59]"
              }`}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  backgroundColor: s.color,
                  opacity: total === 0 ? 0.45 : 1,
                }}
              />
              <span>{s.label}</span>
              <span className="rounded bg-[#f3f2f9] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[#5b5c6e]">
                {formattedTotal}
              </span>
            </span>
          );
        })}
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

        {/* Gridlines & evenly-spaced integer Y-axis ticks */}
        {[0, 1, 2, 3, 4].map((tickIdx) => {
          const val = step * tickIdx;
          const y = yAt(val);
          const formatted =
            val >= 1000 ? `${valuePrefix}${(val / 1000).toFixed(1)}k` : `${valuePrefix}${val}`;
          return (
            <g key={tickIdx}>
              <line
                x1={padL}
                y1={y}
                x2={W - padR}
                y2={y}
                stroke={tickIdx === 0 ? "#dfe1ec" : "#eeecf5"}
                strokeDasharray={tickIdx === 0 ? undefined : "3 3"}
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

        {/* Optional grouped bars (only rendered when value > 0) */}
        {barSeries.map((s, bIdx) =>
          data.map((row, i) => {
            const val = Math.max(0, Number(row[s.key] || 0));
            if (val <= 0) return null;
            const cx = xAt(i);
            const x = cx - (barSeries.length * barW) / 2 + bIdx * barW;
            const y = yAt(val);
            const h = Math.max(3, padT + plotH - y);
            return (
              <rect
                key={`${s.key}-${i}`}
                x={x}
                y={y}
                width={Math.max(8, barW - 2)}
                height={h}
                rx="4"
                fill={s.color}
                fillOpacity="0.85"
              >
                <title>{`${row.label} · ${s.label}: ${valuePrefix}${val.toLocaleString()}`}</title>
              </rect>
            );
          }),
        )}

        {/* Area & Line series (suppresses flat 0-lines along the X-axis) */}
        {lineSeries.map((s) => {
          const values = data.map((row) => Math.max(0, Number(row[s.key] || 0)));
          const firstNonZero = values.findIndex((v) => v > 0);
          // Never paint a colored stroke along y=0 when the entire series is zero
          if (firstNonZero === -1) return null;

          let lastNonZero = values.length - 1;
          while (lastNonZero > firstNonZero && values[lastNonZero] <= 0) {
            lastNonZero -= 1;
          }
          const startIdx = Math.max(0, firstNonZero - 1);
          const endIdx = Math.min(data.length - 1, lastNonZero + 1);
          const sliceIndices: number[] = [];
          for (let idx = startIdx; idx <= endIdx; idx += 1) {
            sliceIndices.push(idx);
          }

          const pts = sliceIndices.map((idx) => [xAt(idx), yAt(values[idx]), idx] as const);
          const dLine = pts
            .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
            .join(" ");
          const dArea = `${dLine} L${pts[pts.length - 1][0].toFixed(1)},${padT + plotH} L${pts[0][0].toFixed(1)},${padT + plotH} Z`;
          return (
            <g key={s.key}>
              {s.kind === "area" && pts.length > 1 && (
                <path d={dArea} fill={`url(#trend-grad-${s.key})`} />
              )}
              {pts.length > 1 && (
                <path
                  d={dLine}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {pts
                .filter(([, , idx]) => values[idx] > 0 || pts.length === 1)
                .map(([x, y, idx]) => (
                  <circle
                    key={`${s.key}-pt-${idx}`}
                    cx={x}
                    cy={y}
                    r="3.6"
                    fill="#ffffff"
                    stroke={s.color}
                    strokeWidth="2.2"
                  >
                    <title>{`${data[idx].label} · ${s.label}: ${valuePrefix}${values[idx].toLocaleString()}`}</title>
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
