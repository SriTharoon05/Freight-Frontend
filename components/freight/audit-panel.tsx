"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { freight, type Page, errorMessage, moneyLabel } from "@/lib/freight";
import {
  Panel,
  Field,
  ErrorBanner,
  ChargeSelect,
  inputClass,
  buttonClass,
  secondaryClass,
} from "./shared";
type Row = Record<string, any>;
export function AuditPanel({ id }: { id: string }) {
  const client = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [bill, setBill] = useState({
    reference: "",
    rate_contract_id: "",
    currency: "USD",
    due_date: "",
    lines: [{ name: "", amount: 0 }],
  });
  const contracts = useQuery<Page<Row>>({
    queryKey: ["freight", id, "rate-contracts"],
    queryFn: () => freight.get<Page<Row>>(`/jobs/${id}/rate-contracts`),
  });
  const flags = useQuery<Page<Row>>({
    queryKey: ["freight", id, "audit-flags"],
    queryFn: () => freight.get<Page<Row>>(`/jobs/${id}/audit-flags`),
  });
  const resolve = async (flag: Row, status: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await freight.patch<Row>(
        `/jobs/${id}/audit-flags/${flag.id}`,
        { status, note: "" },
      );
      if (result.evidence?.dispute_draft)
        setDraft(result.evidence.dispute_draft);
      client.invalidateQueries({ queryKey: ["freight"] });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel title="Carrier invoice audit">
      <ErrorBanner error={error || flags.error} />
      <details className="mb-5">
        <summary className="cursor-pointer text-xs font-semibold text-[#7068cf]">
          Audit carrier invoice
        </summary>
        <form
          className="mt-4 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              await freight.post(`/jobs/${id}/carrier-invoices`, bill);
              client.invalidateQueries({ queryKey: ["freight"] });
              setBill({
                reference: "",
                rate_contract_id: "",
                currency: "USD",
                due_date: "",
                lines: [{ name: "", amount: 0 }],
              });
            } catch (e) {
              setError(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Invoice reference">
              <input
                required
                className={inputClass}
                value={bill.reference}
                onChange={(e) =>
                  setBill({ ...bill, reference: e.target.value })
                }
              />
            </Field>
            <Field label="Rate contract">
              <select
                required
                className={inputClass}
                value={bill.rate_contract_id}
                onChange={(e) => {
                  const c = contracts.data?.items.find(
                    (r: Row) => r.id === e.target.value,
                  );
                  setBill({
                    ...bill,
                    rate_contract_id: e.target.value,
                    currency: c?.currency_code || "USD",
                  });
                }}
              >
                <option value="">Select contract</option>
                {contracts.data?.items.map((c: Row) => (
                  <option key={c.id} value={c.id}>
                    {c.origin_country_code} → {c.dest_country_code} ·{" "}
                    {moneyLabel(
                      Number(c.base_rate_paise) / 100,
                      c.currency_code,
                    )}{" "}
                    · {c.valid_from}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Due date">
              <input
                type="date"
                required
                className={inputClass}
                value={bill.due_date}
                onChange={(e) => setBill({ ...bill, due_date: e.target.value })}
              />
            </Field>
          </div>
          {bill.lines.map((line, i) => (
            <div key={i} className="grid gap-3 md:grid-cols-3">
              <ChargeSelect
                value=""
                onChange={(_, type) =>
                  setBill({
                    ...bill,
                    lines: bill.lines.map((r, n) =>
                      n === i ? { ...r, name: type?.name || "" } : r,
                    ),
                  })
                }
              />
              <Field label="Description as billed">
                <input
                  required
                  className={inputClass}
                  value={line.name}
                  onChange={(e) =>
                    setBill({
                      ...bill,
                      lines: bill.lines.map((r, n) =>
                        n === i ? { ...r, name: e.target.value } : r,
                      ),
                    })
                  }
                />
              </Field>
              <Field label={`Amount (${bill.currency})`}>
                <input
                  required
                  type="number"
                  min="0"
                  step=".01"
                  className={inputClass}
                  value={line.amount}
                  onChange={(e) =>
                    setBill({
                      ...bill,
                      lines: bill.lines.map((r, n) =>
                        n === i ? { ...r, amount: Number(e.target.value) } : r,
                      ),
                    })
                  }
                />
              </Field>
            </div>
          ))}
          <div className="flex gap-3">
            <button
              type="button"
              className={secondaryClass}
              onClick={() =>
                setBill({
                  ...bill,
                  lines: [...bill.lines, { name: "", amount: 0 }],
                })
              }
            >
              Add billed charge
            </button>
            <button disabled={busy} className={buttonClass}>
              Run four-way match
            </button>
          </div>
        </form>
      </details>
      <div className="space-y-3">
        {flags.data?.items.map((flag: Row) => (
          <article
            key={flag.id}
            className="rounded-xl border border-amber-100 bg-amber-50/40 p-4"
          >
            <div className="flex justify-between text-xs">
              <strong>
                {flag.invoice_reference} · {flag.flag_type.replaceAll("_", " ")}
              </strong>
              <span>{flag.status}</span>
            </div>
            <p className="my-3 text-xs">{flag.evidence_text}</p>
            <div className="flex flex-wrap items-center gap-2">
              <strong className="mr-auto text-sm">
                {moneyLabel(Number(flag.delta_paise) / 100, flag.currency_code)}
              </strong>
              {flag.status === "open" && (
                <>
                  <button
                    disabled={busy}
                    className={buttonClass}
                    onClick={() => resolve(flag, "confirmed")}
                  >
                    Confirm discrepancy
                  </button>
                  <button
                    disabled={busy}
                    className={secondaryClass}
                    onClick={() => resolve(flag, "dismissed")}
                  >
                    Dismiss
                  </button>
                </>
              )}
              {flag.status === "confirmed" && (
                <>
                  <button
                    disabled={busy}
                    className={secondaryClass}
                    onClick={() => setDraft(flag.evidence?.dispute_draft || "")}
                  >
                    Dispute draft
                  </button>
                  <button
                    disabled={busy}
                    className={secondaryClass}
                    onClick={() => resolve(flag, "recovered")}
                  >
                    Record recovery
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
      {flags.data?.total === 0 && (
        <p className="py-4 text-xs text-[#858693]">
          No invoice discrepancies recorded.
        </p>
      )}
      {draft && (
        <div className="mt-5">
          <Field label="Dispute email draft">
            <textarea
              className={inputClass}
              rows={10}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </Field>
          <div className="mt-3 flex gap-2">
            <button
              className={secondaryClass}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(draft);
                  toast.success("Copied");
                } catch (e) {
                  toast.error(errorMessage(e));
                }
              }}
            >
              Copy
            </button>
            <span title="Email write endpoint is not connected">
              <button className={buttonClass} disabled>
                Send
              </button>
            </span>
          </div>
        </div>
      )}
    </Panel>
  );
}
