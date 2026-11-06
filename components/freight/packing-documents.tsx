"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Paperclip, Download } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { api } from "@/lib/api-client";
import { freight, dateLabel } from "@/lib/freight";
import { ErrorBanner, secondaryClass } from "./shared";

type PackingDocument = {
  id: string; filename: string; status: string; received_at: string;
  customer_source: boolean; relevant?: boolean; method?: string;
  summary?: string[]; fields?: Record<string, string[]>; text?: string; warning?: string;
};

export function PackingDocuments({ conversationId }: { conversationId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState<unknown>(null);
  const tenant = useAuthStore((state) => state.user?.tenant_id);
  const context = useQuery<{ packing_documents: PackingDocument[]; packing_pending: boolean; packing_needs_review: boolean; bill_review_required?: boolean }>({
    queryKey: ["freight", tenant, "packing-documents", conversationId],
    queryFn: ({ signal }) => freight.get(`/email-requests/${conversationId}/context`, undefined, signal),
    enabled: open && !!tenant,
    refetchInterval: open ? 15000 : false,
  });
  const documents: PackingDocument[] = context.data?.packing_documents || [];
  async function download(document: PackingDocument) {
    setBusy(document.id); setError(null);
    try {
      const response = await api.get(`/freight/mail-attachments/${document.id}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const anchor = window.document.createElement("a");
      anchor.href = url; anchor.download = document.filename; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (failure) { setError(failure); }
    finally { setBusy(""); }
  }
  return <div className="mt-3">
    <button type="button" className={secondaryClass} aria-expanded={open} onClick={() => setOpen(!open)}>
      <Paperclip className="h-3.5 w-3.5" /> Packing list & attachments
    </button>
    {open && <section aria-label="Packing list details" className="mt-3 space-y-3 rounded-xl border border-[#e8e6f0] bg-[#faf9fd] p-3 text-xs text-[#505166]">
      <p className="font-semibold">Cargo details from email attachments</p>
      <p>Review the source file before quoting. Customer attachment notes are included when you prepare an RFQ; verify totals and units before creating a job.</p>
      {context.data?.bill_review_required && <p className="rounded-lg bg-amber-50 p-2 text-amber-900">This thread mentions an AWB/BL. Review existing transport documents before issuing another bill.</p>}
      {context.isLoading && <p role="status">Loading attachments…</p>}
      <ErrorBanner error={context.error || error} />
      {context.data?.packing_pending && <p role="status" className="text-amber-800">Reading attachments in the background. Details will appear here automatically.</p>}
      {context.data?.packing_needs_review && <p role="alert" className="text-amber-800">Attachment discovery or reading could not finish. Review the original email or retry.</p>}
      {context.data && !context.data.packing_pending && !context.data.packing_needs_review && !context.data.packing_documents?.length && <p>No readable file attachments were found in the imported conversation.</p>}
      {context.data && (context.data.packing_pending || context.data.packing_needs_review || documents.some(document => document.status === "needs_review")) && <button type="button" className={secondaryClass} disabled={!!busy} onClick={async () => {
        setBusy("retry"); setError(null);
        try { await freight.post(`/email-requests/${conversationId}/attachments/retry`, {}); await context.refetch(); }
        catch (failure) { setError(failure); } finally { setBusy(""); }
      }}>{busy === "retry" ? "Queuing…" : context.data.packing_pending ? "Read these attachments next" : "Retry attachment reading"}</button>}
      {documents.map(document => <article key={document.id} className="rounded-lg border border-[#e8e6f0] bg-white p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div><p className="break-all font-semibold">{document.filename}</p><p className="mt-1 text-[#777884]">{dateLabel(document.received_at)} · {document.customer_source ? "Customer source" : "Other participant"}</p></div>
          <button type="button" className={secondaryClass} disabled={!!busy} onClick={() => void download(document)}><Download className="h-3.5 w-3.5" />{busy === document.id ? "Downloading…" : "Original file"}</button>
        </div>
        <p className="mt-2 text-[#777884]">{document.status === "read" ? document.method : document.status === "pending" ? "Waiting to be read" : "Needs manual review"}</p>
        {!!Object.keys(document.fields || {}).length && <dl className="mt-3 grid gap-2 sm:grid-cols-2">{Object.entries(document.fields || {}).map(([label, values]) => <div key={label} className="rounded-lg bg-[#f5f4fa] p-2"><dt className="font-semibold">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words">{values.join("\n")}</dd></div>)}</dl>}
        {!!document.summary?.length && <ul aria-label="Attachment summary" className="mt-3 list-disc space-y-1 pl-4">{document.summary.map((line, index) => <li key={index} className="break-words">{line}</li>)}</ul>}
        {document.text && <details className="mt-3"><summary className="cursor-pointer font-medium">View extracted table / text</summary><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[#f5f4fa] p-3 font-mono text-[11px]">{document.text}</pre></details>}
        {document.status === "read" && !document.relevant && <p className="mt-2">No packing or cargo fields identified. Review the original if this is a packing list.</p>}
        {document.warning && <p className="mt-3 text-amber-800">{document.warning}</p>}
      </article>)}
      <p className="text-[#777884]">PDFs up to 8 pages, Excel (.xlsx), CSV, Word (.docx) and images · 8 MB per file. Scans use English OCR. Large, encrypted or unsupported files need manual review.</p>
    </section>}
  </div>;
}
