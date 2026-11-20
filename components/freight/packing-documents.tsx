"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Paperclip, Download } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { api } from "@/lib/api-client";
import { freight, dateLabel } from "@/lib/freight";
import { ErrorBanner, secondaryClass } from "./shared";

type StructuredPackingItem = {
  description?: string;
  pieces?: number;
  gross_weight?: number;
  net_weight?: number;
  weight_unit?: string;
  volume?: number;
  commodity_number?: string;
  marks?: string;
  dimension_items?: Array<{
    pieces?: number;
    length?: number;
    width?: number;
    height?: number;
    unit?: string;
  }>;
};

type PackingDocument = {
  id: string;
  filename: string;
  status: string;
  received_at: string;
  customer_source: boolean;
  relevant?: boolean;
  method?: string;
  summary?: string[];
  fields?: Record<string, string[]>;
  structured_items?: StructuredPackingItem[];
  structured_route?: {
    origin?: string;
    destination?: string;
    incoterms?: string;
    mode?: string;
    equipment?: string;
  };
  text?: string;
  warning?: string;
};

function formatItemDimensions(item: StructuredPackingItem): string {
  const dims = (item.dimension_items || []).filter(
    (d) => (d.length || 0) > 0 && (d.width || 0) > 0 && (d.height || 0) > 0,
  );
  if (!dims.length) return "—";
  return dims
    .map(
      (d) =>
        `${d.pieces || 1} × ${d.length}×${d.width}×${d.height} ${d.unit || "cm"}`,
    )
    .join("; ");
}

export function PackingDocuments({ conversationId }: { conversationId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState<unknown>(null);
  const tenant = useAuthStore((state) => state.user?.tenant_id);
  const context = useQuery<{
    packing_documents: PackingDocument[];
    packing_pending: boolean;
    packing_needs_review: boolean;
    bill_review_required?: boolean;
  }>({
    queryKey: ["freight", tenant, "packing-documents", conversationId],
    queryFn: ({ signal }) =>
      freight.get(`/email-requests/${conversationId}/context`, undefined, signal),
    enabled: open && !!tenant,
    refetchInterval: open ? 15000 : false,
  });
  const documents: PackingDocument[] = context.data?.packing_documents || [];
  async function download(document: PackingDocument) {
    setBusy(document.id);
    setError(null);
    try {
      const response = await api.get(
        `/freight/mail-attachments/${document.id}/download`,
        { responseType: "blob" },
      );
      const url = URL.createObjectURL(response.data);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = document.filename;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="mt-3">
      <button
        type="button"
        className={secondaryClass}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Paperclip className="h-3.5 w-3.5" /> Packing list & attachments
      </button>
      {open && (
        <section
          aria-label="Packing list details"
          className="mt-3 space-y-3 rounded-xl border border-[#e8e6f0] bg-[#faf9fd] p-3 text-xs text-[#505166]"
        >
          <p className="font-semibold">Cargo details from email attachments</p>
          <p>
            Review the source file before quoting. Customer packing list items,
            dimensions, weights, and routes automatically prefill when you
            click Prepare RFQ.
          </p>
          {context.data?.bill_review_required && (
            <p className="rounded-lg bg-amber-50 p-2 text-amber-900">
              This thread mentions an AWB/BL. Review existing transport
              documents before issuing another bill.
            </p>
          )}
          {context.isLoading && (
            <p role="status">Reading and extracting attachments…</p>
          )}
          <ErrorBanner error={context.error || error} />
          {context.data?.packing_pending && (
            <p role="status" className="text-amber-800">
              Reading attachments in the background. Details will appear here
              automatically.
            </p>
          )}
          {context.data?.packing_needs_review && (
            <p role="alert" className="text-amber-800">
              Attachment discovery or reading could not finish. Review the
              original email or retry.
            </p>
          )}
          {context.data &&
            !context.data.packing_pending &&
            !context.data.packing_needs_review &&
            !context.data.packing_documents?.length && (
              <p>
                No readable file attachments were found in the imported
                conversation.
              </p>
            )}
          {context.data &&
            (context.data.packing_pending ||
              context.data.packing_needs_review ||
              documents.some((document) => document.status === "needs_review")) && (
              <button
                type="button"
                className={secondaryClass}
                disabled={!!busy}
                onClick={async () => {
                  setBusy("retry");
                  setError(null);
                  try {
                    await freight.post(
                      `/email-requests/${conversationId}/attachments/retry`,
                      {},
                    );
                    await context.refetch();
                  } catch (failure) {
                    setError(failure);
                  } finally {
                    setBusy("");
                  }
                }}
              >
                {busy === "retry"
                  ? "Queuing…"
                  : context.data.packing_pending
                    ? "Read these attachments next"
                    : "Retry attachment reading"}
              </button>
            )}
          {documents.map((document) => {
            const route = document.structured_route;
            const hasRoute =
              route &&
              (route.origin ||
                route.destination ||
                route.incoterms ||
                route.equipment);
            return (
              <article
                key={document.id}
                className="rounded-lg border border-[#e8e6f0] bg-white p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="break-all font-semibold">
                      {document.filename}
                    </p>
                    <p className="mt-1 text-[#777884]">
                      {dateLabel(document.received_at)} ·{" "}
                      {document.customer_source
                        ? "Customer source"
                        : "Other participant"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={secondaryClass}
                    disabled={!!busy}
                    onClick={() => void download(document)}
                  >
                    <Download className="h-3.5 w-3.5" />
                    {busy === document.id ? "Downloading…" : "Original file"}
                  </button>
                </div>
                <p className="mt-2 text-[#777884]">
                  {document.status === "read"
                    ? document.method
                    : document.status === "pending"
                      ? "Waiting to be read"
                      : "Needs manual review"}
                </p>
                {hasRoute && (
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    {(route?.origin || route?.destination) && (
                      <span className="rounded bg-[#f0eef9] px-2 py-0.5 font-medium text-[#4b4494]">
                        Route: {route.origin || "?"} → {route.destination || "?"}
                      </span>
                    )}
                    {route?.incoterms && (
                      <span className="rounded bg-[#f0eef9] px-2 py-0.5 font-medium text-[#4b4494]">
                        Incoterms: {route.incoterms}
                      </span>
                    )}
                    {route?.equipment && (
                      <span className="rounded bg-[#f0eef9] px-2 py-0.5 font-medium text-[#4b4494]">
                        Equipment: {route.equipment}
                      </span>
                    )}
                  </div>
                )}
                {!!document.structured_items?.length && (
                  <div className="mt-3 overflow-x-auto rounded-lg border border-[#eeecf5]">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-[#f5f4fa] text-[#505166]">
                        <tr>
                          <th className="px-2 py-1.5 font-semibold">
                            Commodity
                          </th>
                          <th className="px-2 py-1.5 font-semibold">Pkgs</th>
                          <th className="px-2 py-1.5 font-semibold">
                            Dimensions
                          </th>
                          <th className="px-2 py-1.5 font-semibold">G.W.</th>
                          <th className="px-2 py-1.5 font-semibold">CBM</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#eeecf5]">
                        {document.structured_items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-2 py-1.5 font-medium text-[#343444]">
                              {item.description || "Cargo"}
                              {item.commodity_number
                                ? ` (HS ${item.commodity_number})`
                                : ""}
                            </td>
                            <td className="px-2 py-1.5">{item.pieces ?? 1}</td>
                            <td className="px-2 py-1.5">
                              {formatItemDimensions(item)}
                            </td>
                            <td className="px-2 py-1.5">
                              {item.gross_weight
                                ? `${item.gross_weight} ${item.weight_unit || "kg"}`
                                : "—"}
                            </td>
                            <td className="px-2 py-1.5">
                              {item.volume ? `${item.volume} m³` : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {!!Object.keys(document.fields || {}).length && (
                  <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                    {Object.entries(document.fields || {}).map(
                      ([label, values]) => (
                        <div
                          key={label}
                          className="rounded-lg bg-[#f5f4fa] p-2"
                        >
                          <dt className="font-semibold">{label}</dt>
                          <dd className="mt-1 whitespace-pre-wrap break-words">
                            {values.join("\n")}
                          </dd>
                        </div>
                      ),
                    )}
                  </dl>
                )}
                {!!document.summary?.length && (
                  <ul
                    aria-label="Attachment summary"
                    className="mt-3 list-disc space-y-1 pl-4"
                  >
                    {document.summary.map((line, index) => (
                      <li key={index} className="break-words">
                        {line}
                      </li>
                    ))}
                  </ul>
                )}
                {document.text && (
                  <details className="mt-3">
                    <summary className="cursor-pointer font-medium">
                      View extracted table / text
                    </summary>
                    <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[#f5f4fa] p-3 font-mono text-[11px]">
                      {document.text}
                    </pre>
                  </details>
                )}
                {document.status === "read" && !document.relevant && (
                  <p className="mt-2">
                    No packing or cargo fields identified. Review the original
                    if this is a packing list.
                  </p>
                )}
                {document.warning && (
                  <p className="mt-3 text-amber-800">{document.warning}</p>
                )}
              </article>
            );
          })}
          <p className="text-[#777884]">
            PDFs up to 25 pages, Excel (.xlsx), CSV, Word (.docx) and images · 8
            MB per file. Large or encrypted files need manual review.
          </p>
        </section>
      )}
    </div>
  );
}
