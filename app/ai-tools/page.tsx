"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Leaf,
  Loader2,
  Scale,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import {
  Panel,
  Field,
  ErrorBanner,
  inputClass,
  buttonClass,
  secondaryClass,
} from "@/components/freight/shared";
import { freight, moneyLabel } from "@/lib/freight";

type Row = Record<string, any>;

export default function AiFreightSuitePage() {
  const [hsDesc, setHsDesc] = useState("");
  const [origCountry, setOrigCountry] = useState("CN");
  const [destCountry, setDestCountry] = useState("IN");
  const [fobUsd, setFobUsd] = useState(25000);
  const [freightUsd, setFreightUsd] = useState(1850);
  const [insUsd, setInsUsd] = useState(0);
  const [hsBusy, setHsBusy] = useState(false);
  const [hsError, setHsError] = useState<unknown>(null);
  const [hsResult, setHsResult] = useState<Row | null>(null);

  const [cOrigin, setCOrigin] = useState("Shanghai");
  const [cDest, setCDest] = useState("Nhava Sheva");
  const [cWeightKg, setCWeightKg] = useState(12500);
  const [cMode, setCMode] = useState("ocean");
  const [cBusy, setCBusy] = useState(false);
  const [cError, setCError] = useState<unknown>(null);
  const [cResult, setCResult] = useState<Row | null>(null);

  const [idKind, setIdKind] = useState<"container" | "awb">("container");
  const [idValue, setIdValue] = useState("");
  const [idBusy, setIdBusy] = useState(false);
  const [idResult, setIdResult] = useState<Row | null>(null);

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="rounded-2xl border border-[#2a2752] bg-gradient-to-r from-[#181732] via-[#232048] to-[#2c275c] p-6 text-white">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#a5b4fc]">
            <Sparkles size={13} />
            AI Forwarding &amp; Compliance Intelligence
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            AI Customs, Landed Duty, Carbon (ESG) &amp; Equipment Suite
          </h1>
          <p className="mt-1 max-w-3xl text-xs text-[#c7d2fe]">
            Classify 6–8 digit HS tariff codes, screen DG/regulatory compliance, compute CIF landed customs duties with live RBI FX rates, benchmark ISO 14083 Scope-3 CO₂e emissions, and validate ISO 6346 container &amp; IATA Mod-7 MAWB check digits before carrier filing.
          </p>
        </header>

        <Panel title="1. AI HS Tariff Classifier, Compliance Screener & CIF Landed Duty Calculator">
          <ErrorBanner error={hsError} />
          <form
            className="grid gap-4 md:grid-cols-6"
            onSubmit={async (e) => {
              e.preventDefault();
              setHsBusy(true);
              setHsError(null);
              try {
                const res = await freight.post<Row>("/ai-customs/classify", {
                  description: hsDesc,
                  origin_country: origCountry,
                  dest_country: destCountry,
                  fob_value_usd: Number(fobUsd) || 0,
                  freight_usd: Number(freightUsd) || 0,
                  insurance_usd: Number(insUsd) || 0,
                });
                setHsResult(res);
              } catch (cause) {
                setHsError(cause);
              } finally {
                setHsBusy(false);
              }
            }}
          >
            <div className="md:col-span-3">
              <Field label="Cargo / commodity commercial description">
                <input
                  required
                  className={inputClass}
                  placeholder="e.g. Industrial centrifugal stainless steel pumps, Lithium-ion battery packs, Cotton knitted T-shirts"
                  value={hsDesc}
                  onChange={(e) => setHsDesc(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Origin country">
              <input
                className={inputClass}
                value={origCountry}
                onChange={(e) => setOrigCountry(e.target.value.toUpperCase())}
              />
            </Field>
            <Field label="Destination country">
              <input
                className={inputClass}
                value={destCountry}
                onChange={(e) => setDestCountry(e.target.value.toUpperCase())}
              />
            </Field>
            <Field label="FOB cargo value (USD)">
              <input
                type="number"
                min="0"
                step="any"
                className={inputClass}
                value={fobUsd}
                onChange={(e) => setFobUsd(Number(e.target.value))}
              />
            </Field>
            <Field label="Freight charges (USD)">
              <input
                type="number"
                min="0"
                step="any"
                className={inputClass}
                value={freightUsd}
                onChange={(e) => setFreightUsd(Number(e.target.value))}
              />
            </Field>
            <Field label="Insurance (USD, 0 = auto 1.125%)">
              <input
                type="number"
                min="0"
                step="any"
                className={inputClass}
                value={insUsd}
                onChange={(e) => setInsUsd(Number(e.target.value))}
              />
            </Field>
            <div className="flex items-end md:col-span-4">
              <button disabled={hsBusy || hsDesc.trim().length < 2} className={buttonClass}>
                {hsBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Scale className="h-3.5 w-3.5" />}
                {hsBusy ? "Classifying & calculating duty…" : "Classify HS Code & Calculate Landed Duty"}
              </button>
            </div>
          </form>

          {hsResult && (
            <div className="mt-5 grid gap-4 lg:grid-cols-12">
              <div className="space-y-3 rounded-xl border border-[#e5e3f2] bg-[#faf9fe] p-4 lg:col-span-7">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#7068cf]">
                      Recommended Harmonized Tariff Code
                    </span>
                    <div className="mt-0.5 font-mono text-2xl font-bold text-[#171725]">
                      HS {hsResult.hs_code}
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                    {Math.round(Number(hsResult.confidence || 0.85) * 100)}% confidence ·{" "}
                    {hsResult.method === "ai_broker" ? "AI Customs Broker" : "Tariff Schedule"}
                  </span>
                </div>
                <p className="text-xs text-[#4a4b5c]">{hsResult.heading_description}</p>

                <div className="grid gap-3 pt-2 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-[#7c7d8c]">
                      Regulatory &amp; DG Screening
                    </p>
                    <ul className="mt-1.5 space-y-1 text-xs text-[#2d2e3e]">
                      {(hsResult.compliance_flags || []).map((flag: string, i: number) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                          <span>{flag}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-[#7c7d8c]">
                      Mandatory Clearance Documents
                    </p>
                    <ul className="mt-1.5 space-y-1 text-xs text-[#2d2e3e]">
                      {(hsResult.required_documents || []).map((doc: string, i: number) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                          <span>{doc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[#e5e3f2] bg-white p-4 text-xs lg:col-span-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#7c7d8c]">
                  Estimated CIF &amp; Customs Duty Breakdown
                </p>
                <div className="mt-3 divide-y divide-[#f1eff8]">
                  <div className="flex justify-between py-1.5">
                    <span className="text-[#6b6c7b]">CIF Assessable Value</span>
                    <strong className="tabular-nums">{moneyLabel(hsResult.landed_cost?.cif_usd, "USD")}</strong>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-[#6b6c7b]">
                      Basic Customs Duty ({hsResult.landed_cost?.bcd_pct}%)
                    </span>
                    <strong className="tabular-nums">{moneyLabel(hsResult.landed_cost?.bcd_usd, "USD")}</strong>
                  </div>
                  {Number(hsResult.landed_cost?.sws_usd) > 0 && (
                    <div className="flex justify-between py-1.5">
                      <span className="text-[#6b6c7b]">
                        Social Welfare Surcharge ({hsResult.landed_cost?.sws_pct}%)
                      </span>
                      <strong className="tabular-nums">{moneyLabel(hsResult.landed_cost?.sws_usd, "USD")}</strong>
                    </div>
                  )}
                  <div className="flex justify-between py-1.5">
                    <span className="text-[#6b6c7b]">
                      IGST / Import VAT ({hsResult.landed_cost?.igst_pct}%)
                    </span>
                    <strong className="tabular-nums">{moneyLabel(hsResult.landed_cost?.igst_usd, "USD")}</strong>
                  </div>
                  <div className="flex justify-between py-2 font-semibold text-[#7068cf]">
                    <span>Total Import Duties &amp; Taxes</span>
                    <span className="tabular-nums">{moneyLabel(hsResult.landed_cost?.total_duty_usd, "USD")}</span>
                  </div>
                  <div className="flex justify-between pt-2.5 text-sm font-bold text-[#171725]">
                    <span>Total Landed Cost</span>
                    <span className="tabular-nums">{moneyLabel(hsResult.landed_cost?.total_landed_usd, "USD")}</span>
                  </div>
                  <p className="pt-1.5 text-right text-[11px] text-[#7c7d8c]">
                    ≈ {moneyLabel(hsResult.landed_cost?.total_landed_inr, "INR")} @ {hsResult.landed_cost?.usd_inr_rate} INR/USD
                  </p>
                </div>
              </div>
            </div>
          )}
        </Panel>

        <div className="grid gap-5 xl:grid-cols-12">
          <div className="xl:col-span-7">
            <Panel title="2. ISO 14083 / GLEC Scope-3 Carbon Footprint & Green Corridor Benchmark">
              <ErrorBanner error={cError} />
              <form
                className="grid gap-3 sm:grid-cols-5"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setCBusy(true);
                  setCError(null);
                  try {
                    const res = await freight.post<Row>("/carbon-estimate", {
                      origin: cOrigin,
                      destination: cDest,
                      weight_kg: Number(cWeightKg) || 1000,
                      mode: cMode,
                    });
                    setCResult(res);
                  } catch (cause) {
                    setCError(cause);
                  } finally {
                    setCBusy(false);
                  }
                }}
              >
                <Field label="Origin port / hub">
                  <input
                    required
                    className={inputClass}
                    value={cOrigin}
                    onChange={(e) => setCOrigin(e.target.value)}
                  />
                </Field>
                <Field label="Destination port / hub">
                  <input
                    required
                    className={inputClass}
                    value={cDest}
                    onChange={(e) => setCDest(e.target.value)}
                  />
                </Field>
                <Field label="Gross weight (kg)">
                  <input
                    type="number"
                    min="1"
                    step="any"
                    className={inputClass}
                    value={cWeightKg}
                    onChange={(e) => setCWeightKg(Number(e.target.value))}
                  />
                </Field>
                <Field label="Mode">
                  <select
                    className={inputClass}
                    value={cMode}
                    onChange={(e) => setCMode(e.target.value)}
                  >
                    <option value="ocean">Ocean</option>
                    <option value="air">Air</option>
                    <option value="road">Road</option>
                    <option value="rail">Rail</option>
                  </select>
                </Field>
                <div className="flex items-end">
                  <button disabled={cBusy} className={`${buttonClass} w-full`}>
                    <Leaf className="h-3.5 w-3.5" />
                    Calculate CO₂e
                  </button>
                </div>
              </form>

              {cResult && (
                <div className="mt-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-emerald-800">
                        {cResult.standard}
                      </span>
                      <div className="mt-0.5 text-xl font-bold text-emerald-950 tabular-nums">
                        {Number(cResult.selected?.kg_co2e || 0).toLocaleString()} kg CO₂e{" "}
                        <span className="text-xs font-normal">
                          ({cResult.selected?.tonnes_co2e} tCO₂e · {cResult.selected?.distance_km} km)
                        </span>
                      </div>
                    </div>
                    {cResult.savings_vs_air_pct > 0 && (
                      <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">
                        Saves {cResult.savings_vs_air_pct}% CO₂e vs Air Freight
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    {(cResult.comparisons || []).map((m: Row) => (
                      <div
                        key={m.mode}
                        className={`rounded-xl border p-3 text-xs ${
                          m.mode === cResult.selected_mode
                            ? "border-[#7068cf] bg-[#f4f2ff]"
                            : "border-[#eeecf5] bg-[#fbfbfe]"
                        }`}
                      >
                        <p className="font-bold uppercase text-[#474859]">{m.mode}</p>
                        <strong className="mt-1 block text-base text-[#171725] tabular-nums">
                          {Number(m.kg_co2e).toLocaleString()} kg
                        </strong>
                        <p className="text-[10px] text-[#7c7d8c]">{m.distance_km} km WTW</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Panel>
          </div>

          <div className="xl:col-span-5">
            <Panel title="3. ISO 6346 Container & IATA Mod-7 MAWB Validator">
              <p className="mb-3 text-xs text-[#777884]">
                Catch check-digit typos on Ocean Container numbers (e.g. <code>MSCU1234565</code>) and 11-digit IATA Air Waybills (e.g. <code>176-12345675</code>) before customs or carrier filing.
              </p>
              <form
                className="space-y-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setIdBusy(true);
                  try {
                    const res = await freight.post<Row>("/container-awb/validate", {
                      kind: idKind,
                      value: idValue,
                    });
                    setIdResult(res);
                  } finally {
                    setIdBusy(false);
                  }
                }}
              >
                <div className="grid grid-cols-3 gap-2">
                  <select
                    className={inputClass}
                    value={idKind}
                    onChange={(e) => {
                      setIdKind(e.target.value as "container" | "awb");
                      setIdResult(null);
                    }}
                  >
                    <option value="container">Ocean Container</option>
                    <option value="awb">Air MAWB (11-digit)</option>
                  </select>
                  <input
                    required
                    className={`${inputClass} col-span-2 font-mono`}
                    placeholder={idKind === "container" ? "MSCU1234567" : "176-12345675"}
                    value={idValue}
                    onChange={(e) => setIdValue(e.target.value)}
                  />
                </div>
                <button disabled={idBusy || idValue.trim().length < 3} className={secondaryClass}>
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Validate Check Digit
                </button>
              </form>

              {idResult && (
                <div
                  className={`mt-4 rounded-xl border p-3.5 text-xs ${
                    idResult.valid
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : "border-rose-200 bg-rose-50 text-rose-900"
                  }`}
                >
                  <strong className="block font-mono text-sm font-bold">
                    {idResult.normalized} — {idResult.valid ? "VALID ✓" : "CHECK-DIGIT MISMATCH ✕"}
                  </strong>
                  <p className="mt-1">{idResult.message}</p>
                </div>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
