"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  Navigation,
  RefreshCw,
  Truck,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { PartnerDirectory } from "@/components/freight/partner-directory";
import { Panel, ErrorBanner, secondaryClass } from "@/components/freight/shared";
import { freight, dateLabel } from "@/lib/freight";
import { useAuthStore } from "@/lib/auth-store";

type LiveFleetItem = {
  task_id: string;
  job_id: string;
  job_reference: string;
  shipment_status: string;
  customer: string;
  route: string;
  kind: string;
  status: string;
  latest_milestone: string;
  partner_name: string;
  scheduled_at: string | null;
  driver_eta: string | null;
  container_number: string;
  seal_number: string;
  tracking_status: string;
  driver: { name?: string; phone?: string; vehicle?: string } | null;
  last_location: {
    latitude: number;
    longitude: number;
    accuracy: number;
    captured_at: string;
    speed_kmh?: number;
    heading?: number;
    area?: { name?: string };
    location_note?: string;
    trail?: { latitude: number; longitude: number; captured_at: string }[];
  } | null;
  location_note: string;
  location_stale: boolean;
  location_age_seconds: number | null;
  updated_at: string | null;
};

export default function PartnersPage() {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<"fleet" | "directory">("fleet");
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("active");

  const fleet = useQuery<{ items: LiveFleetItem[]; total: number; as_of: string }>({
    queryKey: ["freight", user?.tenant_id, "partner-fleet-live"],
    queryFn: () => freight.get("/partner-fleet/live"),
    enabled: !!user && tab === "fleet",
    refetchInterval: 15_000,
  });

  const allItems: LiveFleetItem[] = fleet.data?.items || [];
  const filtered = allItems.filter((item: LiveFleetItem) => {
    if (statusFilter === "active") {
      return !["completed", "cancelled", "rejected"].includes(item.status);
    }
    if (statusFilter === "gps_live") {
      return !!item.last_location && !item.location_stale;
    }
    return true;
  });

  const inspected =
    filtered.find((t: LiveFleetItem) => t.task_id === selectedTaskId) ||
    filtered.find((t: LiveFleetItem) => !!t.last_location) ||
    filtered[0] ||
    null;

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#171725]">
              Field Fleet, Drivers &amp; Partner Network
            </h1>
            <p className="mt-1 text-sm text-[#777884]">
              Monitor live GPS locations, checkpoint updates, driver vehicles, and ETAs across pickup, delivery, and customs tasks — or manage partner approvals.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              aria-pressed={tab === "fleet"}
              onClick={() => setTab("fleet")}
              className={`${secondaryClass} ${
                tab === "fleet" ? "!border-[#7068cf] !bg-[#f4f2ff] !text-[#7068cf]" : ""
              }`}
            >
              <Navigation size={14} />
              Live Driver &amp; Agent Tracker
            </button>
            <button
              type="button"
              aria-pressed={tab === "directory"}
              onClick={() => setTab("directory")}
              className={`${secondaryClass} ${
                tab === "directory" ? "!border-[#7068cf] !bg-[#f4f2ff] !text-[#7068cf]" : ""
              }`}
            >
              <Users size={14} />
              Partner Directory &amp; Approvals
            </button>
          </div>
        </div>

        {tab === "directory" ? (
          <PartnerDirectory />
        ) : (
          <>
            <ErrorBanner error={fleet.error} />

            {/* Summary KPIs */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="rounded-2xl border border-[#eeecf5] bg-white p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#7c7d8c]">
                  Active Field Tasks
                </p>
                <strong className="mt-1 block text-2xl font-bold text-[#171725] tabular-nums">
                  {
                    allItems.filter(
                      (i: LiveFleetItem) => !["completed", "cancelled", "rejected"].includes(i.status),
                    ).length
                  }
                </strong>
              </div>
              <div className="rounded-2xl border border-[#eeecf5] bg-white p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  Live GPS Streaming
                </p>
                <strong className="mt-1 block text-2xl font-bold text-emerald-700 tabular-nums">
                  {allItems.filter((i: LiveFleetItem) => i.last_location && !i.location_stale).length}
                </strong>
              </div>
              <div className="rounded-2xl border border-[#eeecf5] bg-white p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                  Awaiting Proof Review
                </p>
                <strong className="mt-1 block text-2xl font-bold text-amber-700 tabular-nums">
                  {allItems.filter((i: LiveFleetItem) => i.status === "awaiting_verification").length}
                </strong>
              </div>
              <div className="rounded-2xl border border-[#eeecf5] bg-white p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#7068cf]">
                  Verified Completed
                </p>
                <strong className="mt-1 block text-2xl font-bold text-[#7068cf] tabular-nums">
                  {allItems.filter((i: LiveFleetItem) => i.status === "completed").length}
                </strong>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-12">
              {/* Left: Fleet Task List */}
              <div className="xl:col-span-7">
                <Panel
                  title="Field assignments & live driver telemetry"
                  action={
                    <div className="flex flex-wrap items-center gap-2">
                      {[
                        ["active", "Active"],
                        ["gps_live", "GPS Live"],
                        ["all", "All"],
                      ].map(([k, label]) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setStatusFilter(k)}
                          className={`${secondaryClass} !px-2.5 !py-1 text-[11px] ${
                            statusFilter === k
                              ? "!border-[#7068cf] !bg-[#f4f2ff] !text-[#7068cf]"
                              : ""
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => void fleet.refetch()}
                        className={`${secondaryClass} !px-2.5 !py-1`}
                      >
                        <RefreshCw
                          size={13}
                          className={fleet.isFetching ? "animate-spin" : ""}
                        />
                      </button>
                    </div>
                  }
                >
                  {!filtered.length ? (
                    <div className="py-10 text-center text-xs text-[#7c7d8c]">
                      <Truck className="mx-auto mb-2 h-7 w-7 text-[#b0b1c0]" />
                      No field transport or customs tasks match this filter. Dispatch a partner on any Job&apos;s <strong>Assignments</strong> tab to track live GPS &amp; milestones here.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filtered.map((item: LiveFleetItem) => {
                        const selected = inspected?.task_id === item.task_id;
                        const loc = item.last_location;
                        return (
                          <article
                            key={item.task_id}
                            onClick={() => setSelectedTaskId(item.task_id)}
                            className={`cursor-pointer rounded-xl border p-4 transition ${
                              selected
                                ? "border-[#7068cf] bg-[#f8f7ff]"
                                : "border-[#eeecf5] bg-[#fbfbfe] hover:border-[#cfcbe9]"
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Link
                                  href={`/shipments/${item.job_id}?tab=Assignments`}
                                  className="text-sm font-bold text-[#7068cf] hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {item.job_reference}
                                </Link>
                                <span className="text-xs font-medium text-[#343444]">
                                  {item.route} · {item.customer}
                                </span>
                                <span className="rounded-full bg-[#eeecfd] px-2 py-0.5 text-[10px] font-bold uppercase text-[#5c53c2]">
                                  {(item.latest_milestone || item.status).replaceAll("_", " ")}
                                </span>
                              </div>
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                                  loc && !item.location_stale
                                    ? "bg-emerald-100 text-emerald-800"
                                    : loc
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {loc && !item.location_stale
                                  ? "GPS Live"
                                  : loc
                                    ? "GPS Delayed"
                                    : item.tracking_status.replaceAll("_", " ")}
                              </span>
                            </div>

                            <div className="mt-2 grid gap-1 text-xs text-[#545568] sm:grid-cols-2">
                              <p>
                                Partner: <strong>{item.partner_name}</strong> ({item.kind.replaceAll("_", " ")})
                              </p>
                              {item.driver && (
                                <p>
                                  Driver: <strong>{item.driver.name}</strong>
                                  {item.driver.phone ? ` · ${item.driver.phone}` : ""}
                                  {item.driver.vehicle ? ` · ${item.driver.vehicle}` : ""}
                                </p>
                              )}
                              {loc && (
                                <p className="sm:col-span-2 flex flex-wrap items-center gap-1.5">
                                  <MapPin size={12} className="text-[#7068cf]" />
                                  <strong>
                                    {item.location_note ||
                                      (loc.area?.name
                                        ? `Near ${loc.area.name}`
                                        : `${Number(loc.latitude).toFixed(4)}, ${Number(loc.longitude).toFixed(4)}`)}
                                  </strong>
                                  <span>· ±{Math.round(Number(loc.accuracy || 0))}m</span>
                                  {typeof loc.speed_kmh === "number" && (
                                    <span>· {loc.speed_kmh} km/h</span>
                                  )}
                                  <span>· {dateLabel(loc.captured_at)}</span>
                                </p>
                              )}
                              {(item.driver_eta || item.container_number) && (
                                <p className="sm:col-span-2 text-indigo-900 font-medium">
                                  {item.driver_eta ? `Revised ETA: ${dateLabel(item.driver_eta)}` : ""}
                                  {item.driver_eta && item.container_number ? " · " : ""}
                                  {item.container_number
                                    ? `Container: ${item.container_number}${item.seal_number ? ` / Seal ${item.seal_number}` : ""}`
                                    : ""}
                                </p>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </Panel>
              </div>

              {/* Right: Live Map & Telemetry Inspector */}
              <div className="xl:col-span-5">
                <Panel title="Live GPS position & breadcrumb inspector">
                  {inspected && inspected.last_location ? (
                    <div className="space-y-3 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <strong className="text-sm text-[#171725]">
                            {inspected.job_reference} · {inspected.driver?.name || inspected.partner_name}
                          </strong>
                          <p className="text-[#777884]">
                            {inspected.location_note ||
                              inspected.last_location.area?.name ||
                              "Live GPS Coordinates"}{" "}
                            ({Number(inspected.last_location.latitude).toFixed(5)},{" "}
                            {Number(inspected.last_location.longitude).toFixed(5)})
                          </p>
                        </div>
                        <a
                          href={`https://www.google.com/maps?q=${inspected.last_location.latitude},${inspected.last_location.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-[#7068cf] underline"
                        >
                          Google Maps <ExternalLink size={12} />
                        </a>
                      </div>

                      <iframe
                        title="Live fleet driver map"
                        className="h-64 w-full rounded-xl border border-[#e5e3f1]"
                        loading="lazy"
                        referrerPolicy="strict-origin-when-cross-origin"
                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(inspected.last_location.longitude) - 0.015},${Number(inspected.last_location.latitude) - 0.015},${Number(inspected.last_location.longitude) + 0.015},${Number(inspected.last_location.latitude) + 0.015}&layer=mapnik&marker=${inspected.last_location.latitude},${inspected.last_location.longitude}`}
                      />

                      <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#f7f6fb] p-3">
                        <div>
                          <span className="text-[10px] text-[#7c7d8c]">Last GPS Ping</span>
                          <p className="font-semibold text-[#171725]">
                            {dateLabel(inspected.last_location.captured_at)}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#7c7d8c]">Driver Revised ETA</span>
                          <p className="font-semibold text-[#171725]">
                            {inspected.driver_eta ? dateLabel(inspected.driver_eta) : "On schedule"}
                          </p>
                        </div>
                      </div>

                      {!!inspected.last_location.trail?.length && (
                        <div>
                          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#7c7d8c]">
                            Recent GPS Breadcrumbs ({inspected.last_location.trail.length})
                          </p>
                          <div className="max-h-32 overflow-y-auto space-y-1 rounded-lg border border-[#eeecf5] p-2 text-[11px]">
                            {inspected.last_location.trail
                              .slice()
                              .reverse()
                              .map((pt: { latitude: number; longitude: number; captured_at: string }, idx: number) => (
                                <div key={idx} className="flex justify-between text-[#5c5d6e]">
                                  <span className="font-mono">
                                    {Number(pt.latitude).toFixed(4)}, {Number(pt.longitude).toFixed(4)}
                                  </span>
                                  <span>{dateLabel(pt.captured_at)}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-xs text-[#7c7d8c]">
                      <Clock className="mx-auto mb-2 h-6 w-6 text-[#b0b1c0]" />
                      Select a task with an active GPS fix to inspect its live map position and breadcrumb trail.
                    </div>
                  )}
                </Panel>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
