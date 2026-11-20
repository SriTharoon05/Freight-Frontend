"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
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
import { OutlookDraftButton } from "./outlook-draft-button";

type Row = Record<string, any>;

export function AuditPanel({ id }: { id: string }) {
  const client = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
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

  const handleInvoiceFileOcr = async (file: File | undefined) => {
    if (!file) return;
    setOcrBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post<{
        reference: string;
        currency: string;
        due_date: string;
        lines: { name: string; amount: number }[];
      }>(`/freight/jobs/${id}/audit-extract-file`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = res.data;
      setBill((prev) => ({
        ...prev,
        reference: data.reference || prev.reference,
        currency: data.currency || prev.currency,
        due_date: data.due_date || prev.due_date,
        lines: data.lines?.length ? data.lines : prev.lines,
      }));
      toast.success(
        `Extracted ${data.lines?.length || 0} billed lines from ${file.name}`,
      );
    } catch (cause) {
      setError(cause);
    } finally {
      setOcrBusy(false);
    }
  };

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
      <details className="mb-5" open>
        <summary className="cursor-pointer text-xs font-semibold text-[#7068cf]">
          Audit carrier invoice (AI OCR or manual entry)
        </summary>

        {/* InstaDoc / Expedock AI Carrier Invoice OCR Auto-Fill */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-[#c9c4eb] bg-[#f8f7fe] p-3.5 text-xs">
          <div className="flex items-center gap-2 text-[#3a3852]">
            <Sparkles className="h-4 w-4 shrink-0 text-[#7068cf]" />
            <span>
              <strong>AI Carrier Invoice Reader:</strong> Upload a PDF, Excel, or scanned invoice to auto-extract reference, currency, due date, and billed lines.
            </span>
          </div>
          <label className={`${secondaryClass} cursor-pointer`}>
            {ocrBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {ocrBusy ? "Reading invoice…" : "Upload Invoice PDF / XLSX"}
            <input
              type="file"
              accept=".pdf,.xlsx,.csv,.png,.jpg,.jpeg"
              className="hidden"
              disabled={ocrBusy}
              onChange={(e) => {
                void handleInvoiceFileOcr(e.target.files?.[0]);
                e.currentTarget.value = "";
              }}
            />
          </label>
        </div>

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
          <div className="mt-3 flex flex-wrap items-center gap-2">
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
            <OutlookDraftButton
              jobId={id}
              body={draft}
              label="Create Dispute Draft in Outlook"
            />
          </div>
        </div>
      )}
    </Panel>
  );
}
