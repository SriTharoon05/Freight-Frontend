"use client";

import Link from "next/link";
import { dateLabel, formatRateUnitLabel, moneyLabel } from "@/lib/freight";
import { secondaryClass } from "./shared";

export type EmailRate = Record<string, any>;
export type RateSuggestions = { items: EmailRate[]; total: number; policy?: string };

export function SupplierRateSuggestions({ data, loading, onApply, canApply }: {
  data?: RateSuggestions;
  loading?: boolean;
  onApply?: (rate: EmailRate) => void;
  canApply?: (rate: EmailRate) => boolean;
}) {
  return (
    <section aria-label="Suggested from email" className="rounded-xl border border-[#e5e3ef] bg-[#fcfbff] p-4">
      <h3 className="text-sm font-semibold">Suggested from email</h3>
      <p className="mt-1 text-xs leading-relaxed text-[#777884]">{data ? "Supplier quotations for this lane. Review the source email before quoting." : "Enter the route to find supplier email rates."}</p>
      {loading && <p role="status" className="mt-3 text-xs">Checking email rates…</p>}
      <div className="mt-3 space-y-3">
        {data?.items.map((rate) => (
          <article key={rate.id} className="rounded-lg border border-[#e8e6f0] bg-white p-3 text-xs">
            <div className="flex flex-wrap justify-between gap-2">
              <strong className="break-all">{rate.provider_address}</strong>
              <span className="font-semibold">{moneyLabel(rate.amount, rate.currency)} / {rate.unit === "unknown" ? "pricing unit unclear" : rate.unit}</span>
            </div>
            <p className="mt-2">{rate.origin} → {rate.destination} · Quoted {dateLabel(rate.received_at)}</p>
            <p className="mt-1 font-medium">{rate.valid_until ? `Valid until ${dateLabel(rate.valid_until)}` : rate.details?.validity_unparsed ? "Validity unclear · verify the source email" : "No stated validity · confirm with the supplier"}</p>
            <p className="mt-1 text-[#777884]">{rate.scope === "lane" ? "Email lane quote" : "Shipment quote · verify cargo applicability"}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Link href={rate.email_href} target="_blank" rel="noopener noreferrer" className="font-medium text-[#7068cf] underline underline-offset-2">Verify quoted rate in email ↗</Link>
              {onApply && <button type="button" className={secondaryClass} disabled={canApply ? !canApply(rate) : false} onClick={() => onApply(rate)}>Use buying rate</button>}
            </div>
          </article>
        ))}
      </div>
      {!loading && data?.total === 0 && <p className="mt-3 text-xs text-[#777884]">No current email rate found for this route.</p>}
    </section>
  );
}

export type CardSuggestions = { items: Record<string, any>[]; total: number };

export function RateCardSuggestions({ data, loading, onApply, canApply, children }: {
  data?: CardSuggestions;
  loading?: boolean;
  onApply?: (rate: Record<string, any>) => void;
  canApply?: (rate: Record<string, any>) => boolean;
  children?: React.ReactNode;
}) {
  return (
    <section aria-label="Suggested from rate card" className="rounded-xl border border-[#e5e3ef] bg-[#fcfbff] p-4">
      <h3 className="text-sm font-semibold">Suggested from rate card</h3>
      <p className="mt-1 text-xs leading-relaxed text-[#777884]">{data ? "Active rate cards matching this country lane and transport mode." : "Enter the route to find matching rate cards."}</p>
      {loading && <p role="status" className="mt-3 text-xs">Checking rate cards…</p>}
      <div className="mt-3 space-y-3">
        {data?.items.map(rate => (
          <article key={rate.id} className="rounded-lg border border-[#e5e3ef] bg-white p-3 text-xs">
            <strong>{rate.carrier_name || "Carrier rate card"}</strong>
            <p className="mt-1">{rate.origin_country_code} → {rate.dest_country_code} · {rate.transport_mode === "sea" ? "Ocean" : rate.transport_mode}</p>
            {rate.base_rate_paise !== undefined && (
              <p className="mt-1">
                {rate.rate_unit && rate.unit_rate_paise !== undefined ? (
                  <>
                    Rate <strong>{moneyLabel(Number(rate.unit_rate_paise) / 100, rate.currency_code)} {formatRateUnitLabel(rate.rate_unit)}</strong>
                    {Number(rate.base_rate_paise) > 0 && !["per_shipment", "per_container"].includes(rate.rate_unit)
                      ? ` · Base/Min ${moneyLabel(Number(rate.base_rate_paise) / 100, rate.currency_code)}`
                      : ""}
                  </>
                ) : (
                  <>Base {moneyLabel(Number(rate.base_rate_paise) / 100, rate.currency_code)} · Per kg {moneyLabel(Number(rate.per_kg_rate_paise) / 100, rate.currency_code)} · Per cbm {moneyLabel(Number(rate.per_cbm_rate_paise) / 100, rate.currency_code)}</>
                )}
                {Number(rate.markup_percent || 0) > 0 ? ` · Card markup ${rate.markup_percent}%` : ""}
              </p>
            )}
            <p className="mt-1 text-[#777884]">{rate.valid_until ? `Valid until ${dateLabel(rate.valid_until)}` : "No stated expiry"}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link href="/rates" className={secondaryClass}>View rate cards</Link>
              {onApply && rate.base_rate_paise !== undefined && <button type="button" className={secondaryClass} disabled={canApply ? !canApply(rate) : false} onClick={() => onApply(rate)}>Use rate card</button>}
            </div>
          </article>
        ))}
      </div>
      {!loading && data?.total === 0 && <div className="mt-3 text-xs"><strong>Not available</strong><p className="mt-1 text-[#777884]">No active rate card matches this lane and transport mode.</p></div>}
      {children}
    </section>
  );
}
