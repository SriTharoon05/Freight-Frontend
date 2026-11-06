"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { freight, type Page, dateLabel, moneyLabel } from "@/lib/freight";
import { useAuthStore } from "@/lib/auth-store";
import { Panel, Pager, ErrorBanner, inputClass, secondaryClass } from "./shared";
type Row = Record<string, any>;
export function EmailRateCards() {
    const user = useAuthStore((state) => state.user);
    const client = useQueryClient();
    const [page, setPage] = useState(1);
    const [matches, setMatches] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState("");
    const [error, setError] = useState<unknown>(null);
    const permitted = ["admin", "org_admin", "manager", "ops_manager", "sales", "finance"].includes(user?.role || "");
    const rates = useQuery<Page<Row>>({ queryKey: ["freight", user?.tenant_id, "supplier-rates", page], queryFn: () => freight.get("/supplier-rates", { page }), enabled: permitted });
    const rfqs = useQuery<Page<Row>>({ queryKey: ["freight", user?.tenant_id, "rate-match-rfqs"], queryFn: () => freight.get("/rfqs", { limit: 100 }), enabled: permitted });
    if (!permitted)
        return null;
    return <Panel title="Email rate cards and shipment quotes"><p className="mb-4 text-xs text-[#777884]">General tariffs need explicit validity to become reusable rate cards. Quotes without validity stay with one enquiry and require confirmation after 14 days. Open the source to review exclusions and availability.</p><ErrorBanner error={error || rates.error || rfqs.error}/>{rates.data?.total === 0 && <p className="text-xs">No carrier or agent email rates captured yet.</p>}<div className="space-y-3">{rates.data?.items.map((rate: Row) => <article key={rate.id} className="rounded-xl border p-4 text-xs"><div className="flex flex-wrap justify-between gap-2"><strong>{rate.provider_address} · {rate.origin || "Lane unclear"} → {rate.destination || "Lane unclear"}</strong><span>{rate.effective_status.replaceAll("_", " ")}</span></div><p className="mt-2">{moneyLabel(rate.amount, rate.currency)} / {rate.unit} · {rate.mode || "Mode unclear"} · {rate.scope === "lane" ? "Reusable rate card" : "Shipment enquiry only"}</p><p className="mt-1">Received {dateLabel(rate.received_at)} · {rate.valid_until ? `Valid until ${dateLabel(rate.valid_until)}` : "No stated validity"}</p><p className="mt-2 text-[#777884]">{rate.details?.matching_reason}</p><Link href={rate.email_href} className="mt-2 inline-block text-[#7068cf] underline">Review source conversation</Link>{rate.status === "needs_review" && <div className="mt-3 flex flex-wrap gap-2"><select aria-label={`Match enquiry for ${rate.provider_address}`} className={`${inputClass} max-w-sm`} value={matches[rate.id] || ""} onChange={(event) => setMatches({ ...matches, [rate.id]: event.target.value })}><option value="">Choose verified shipment enquiry</option>{rfqs.data?.items.filter((rfq: Row) => !["lost", "won"].includes(rfq.status)).map((rfq: Row) => <option key={rfq.id} value={rfq.id}>{rfq.reference} · {rfq.customer_name} · {rfq.origin} → {rfq.destination}</option>)}</select><button className={secondaryClass} disabled={!matches[rate.id] || !!busy} onClick={async () => { setBusy(rate.id); setError(null); try {
        await freight.patch(`/supplier-rates/${rate.id}/match`, { rfq_id: matches[rate.id] });
        await client.invalidateQueries({ queryKey: ["freight"] });
    }
    catch (error) {
        setError(error);
    }
    finally {
        setBusy("");
    } }}>Save reviewed match</button></div>}</article>)}</div><Pager page={page} total={rates.data?.total || 0} limit={20} onChange={setPage}/></Panel>;
}
