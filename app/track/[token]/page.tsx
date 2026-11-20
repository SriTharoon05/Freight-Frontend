"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, Globe, MapPin, ShieldCheck, Truck } from "lucide-react";
import { api } from "@/lib/api-client";
import { dateLabel } from "@/lib/freight";

type PublicTrackData = {
  company_name: string;
  shipment_ref: string;
  status: string;
  mode: string;
  origin: { code: string; name: string };
  destination: { code: string; name: string };
  carrier: string;
  container_number: string;
  packages: number;
  weight_kg: number;
  volume_cbm: number;
  incoterms: string;
  etd: string | null;
  eta: string | null;
  atd: string | null;
  ata: string | null;
  icegate_status: string | null;
  milestones: { id: string; event_type: string; planned_at: string | null; occurred_at: string | null }[];
  field_transport: {
    kind: string;
    status: string;
    milestone?: string;
    area?: string;
    latitude?: number;
    longitude?: number;
    captured_at?: string;
    driver_eta?: string;
  }[];
};

export default function PublicCustomerTrackPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token || "";

  const query = useQuery<PublicTrackData>({
    queryKey: ["public-track", token],
    queryFn: async () => {
      const res = await api.get<PublicTrackData>(`/freight/public-track/${token}`);
      return res.data;
    },
    enabled: !!token,
    refetchInterval: 30_000,
  });

  if (query.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f2ff] p-6 text-sm text-[#5c5d6e]">
        Loading live shipment tracking…
      </div>
    );
  }

  if (query.error || !query.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f2ff] p-6">
        <div className="max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-bold text-[#171725]">Tracking link unavailable</h1>
          <p className="mt-2 text-xs text-[#6b6c7b]">
            This shipment tracking link may have expired or been revoked. Please contact your logistics coordinator for a fresh link.
          </p>
        </div>
      </div>
    );
  }

  const d = query.data;

  return (
    <main className="min-h-screen bg-[#f4f2ff] px-4 py-8 text-[#171725] sm:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-2xl bg-gradient-to-r from-[#181732] via-[#232048] to-[#2c275c] p-6 text-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#a5b4fc]">
                {d.company_name} · Live Shipment Visibility
              </span>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">
                {d.shipment_ref}
              </h1>
              <p className="mt-1 text-xs text-[#cbd5f5]">
                {d.origin.name} ({d.origin.code}) → {d.destination.name} ({d.destination.code}) ·{" "}
                <span className="uppercase">{d.mode}</span>
                {d.incoterms ? ` · ${d.incoterms}` : ""}
              </p>
            </div>
            <span className="rounded-full bg-emerald-400/20 px-3.5 py-1.5 text-xs font-bold uppercase text-emerald-300">
              {d.status.replaceAll("_", " ")}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-white/10 p-3.5 text-xs sm:grid-cols-4">
            <div>
              <span className="text-[10px] text-[#a5b4fc]">ETD / ATD</span>
              <p className="mt-0.5 font-semibold">{dateLabel(d.atd || d.etd)}</p>
            </div>
            <div>
              <span className="text-[10px] text-[#a5b4fc]">ETA / ATA</span>
              <p className="mt-0.5 font-semibold">{dateLabel(d.ata || d.eta)}</p>
            </div>
            <div>
              <span className="text-[10px] text-[#a5b4fc]">Cargo Summary</span>
              <p className="mt-0.5 font-semibold">
                {d.packages} pkgs · {d.weight_kg} kg · {d.volume_cbm} m³
              </p>
            </div>
            <div>
              <span className="text-[10px] text-[#a5b4fc]">Container / Customs</span>
              <p className="mt-0.5 font-semibold">
                {d.container_number || d.icegate_status || d.carrier || "In Schedule"}
              </p>
            </div>
          </div>
        </header>

        {d.field_transport.length > 0 && (
          <section className="rounded-2xl border border-[#e5e3f2] bg-white p-5 shadow-xs">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Truck className="h-4 w-4 text-[#7068cf]" />
              Live First-Mile / Last-Mile Road Status
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {d.field_transport.map((leg: PublicTrackData["field_transport"][number], idx: number) => (
                <div key={idx} className="rounded-xl border border-[#eeecf5] bg-[#fbfbfe] p-3.5 text-xs">
                  <div className="flex items-center justify-between">
                    <strong className="capitalize text-[#171725]">
                      {leg.kind.replaceAll("_", " ")}
                    </strong>
                    <span className="rounded-full bg-[#eeecfd] px-2.5 py-0.5 text-[10px] font-bold uppercase text-[#5c53c2]">
                      {(leg.milestone || leg.status || "").replaceAll("_", " ")}
                    </span>
                  </div>
                  {leg.area && (
                    <p className="mt-1.5 flex items-center gap-1 text-[#4a4b5c]">
                      <MapPin className="h-3.5 w-3.5 text-[#7068cf]" />
                      <span>{leg.area}</span>
                    </p>
                  )}
                  {leg.captured_at && (
                    <p className="mt-1 text-[11px] text-[#7c7d8c]">
                      Updated {dateLabel(leg.captured_at)}
                      {leg.driver_eta ? ` · Revised ETA ${dateLabel(leg.driver_eta)}` : ""}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-[#e5e3f2] bg-white p-5 shadow-xs">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Globe className="h-4 w-4 text-[#7068cf]" />
            Shipment Milestone Timeline
          </h2>
          <div className="mt-4 space-y-3">
            {d.milestones.map((m: PublicTrackData["milestones"][number]) => {
              const done = !!m.occurred_at;
              return (
                <div
                  key={m.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-[#f0eef8] bg-[#fbfbfe] p-3.5 text-xs"
                >
                  <div className="flex items-start gap-2.5">
                    {done ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    )}
                    <div>
                      <strong className="text-[#171725]">{m.event_type}</strong>
                      <p className="mt-0.5 text-[11px] text-[#7c7d8c]">
                        {done
                          ? `Completed ${dateLabel(m.occurred_at)}`
                          : m.planned_at
                            ? `Planned ${dateLabel(m.planned_at)}`
                            : "Scheduled"}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                      done ? "bg-emerald-100 text-emerald-800" : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {done ? "Completed" : "Upcoming"}
                  </span>
                </div>
              );
            })}
            {!d.milestones.length && (
              <p className="py-4 text-xs text-[#858693]">
                Milestones will appear here as your shipment progresses.
              </p>
            )}
          </div>
        </section>

        <footer className="flex items-center justify-center gap-1.5 text-center text-[11px] text-[#7c7d8c]">
          <ShieldCheck className="h-3.5 w-3.5 text-[#7068cf]" />
          Verified read-only shipment tracking powered by {d.company_name} · Auto-refreshes every 30s
        </footer>
      </div>
    </main>
  );
}
