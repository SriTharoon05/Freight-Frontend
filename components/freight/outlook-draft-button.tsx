"use client";

import { useState } from "react";
import { ExternalLink, Loader2, MailPlus } from "lucide-react";
import { toast } from "sonner";
import { freight, errorMessage } from "@/lib/freight";
import { buttonClass, secondaryClass } from "./shared";

export interface OutlookDraftResult {
  draft_id?: string;
  outlook_conversation_id?: string;
  mode: "same_thread_reply" | "new_thread_draft";
  mailbox: string;
  subject: string;
  web_link?: string;
  attached_filename?: string | null;
}

export function OutlookDraftButton({
  conversationId,
  messageId,
  rfqId,
  jobId,
  documentId,
  attachRfqQuotePdf = false,
  markDocumentSent = false,
  mailboxId,
  to = [],
  cc = [],
  subject = "",
  body,
  label = "Create Outlook draft (same thread)",
  variant = "primary",
  disabled = false,
  onCreated,
}: {
  conversationId?: string | null;
  messageId?: string | null;
  rfqId?: string | null;
  jobId?: string | null;
  documentId?: string | null;
  attachRfqQuotePdf?: boolean;
  markDocumentSent?: boolean;
  mailboxId?: string | null;
  to?: string[];
  cc?: string[];
  subject?: string;
  body: string;
  label?: string;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  onCreated?: (res: OutlookDraftResult) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<OutlookDraftResult | null>(null);
  const [err, setErr] = useState<string>("");

  async function handleCreate() {
    if (!body.trim()) {
      toast.error("Write or generate the email body before creating an Outlook draft.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const payload: Record<string, unknown> = {
        body,
        attach_rfq_quote_pdf: attachRfqQuotePdf,
        mark_document_sent: markDocumentSent,
      };
      if (conversationId) payload.conversation_id = conversationId;
      if (messageId) payload.message_id = messageId;
      if (rfqId) payload.rfq_id = rfqId;
      if (jobId) payload.job_id = jobId;
      if (documentId) payload.document_id = documentId;
      if (mailboxId) payload.mailbox_id = mailboxId;
      const cleanTo = to.map((a) => a.trim()).filter(Boolean);
      const cleanCc = cc.map((a) => a.trim()).filter(Boolean);
      if (cleanTo.length) payload.to = cleanTo;
      if (cleanCc.length) payload.cc = cleanCc;
      if (subject.trim()) payload.subject = subject.trim();

      const res = await freight.post<OutlookDraftResult>("/outlook-drafts", payload);
      setCreated(res);
      toast.success(
        res.mode === "same_thread_reply"
          ? `Draft saved in ${res.mailbox} (same thread)`
          : `Draft saved in ${res.mailbox}`,
      );
      onCreated?.(res);
    } catch (cause) {
      const msg = errorMessage(cause);
      setErr(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={disabled || busy || !body.trim()}
        onClick={() => void handleCreate()}
        className={
          variant === "primary"
            ? buttonClass
            : `${secondaryClass} !border-[#7068cf] !text-[#7068cf] hover:!bg-[#f4f2ff]`
        }
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <MailPlus className="h-3.5 w-3.5" />
        )}
        {busy ? "Creating draft…" : label}
      </button>
      {created && (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800">
          {created.mode === "same_thread_reply" ? "Threaded draft ready" : "Draft ready"}
          {created.attached_filename ? ` · 📎 ${created.attached_filename}` : ""}
          {created.web_link && (
            <a
              href={created.web_link}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 inline-flex items-center gap-0.5 font-semibold text-[#7068cf] underline"
            >
              Open in Outlook <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </span>
      )}
      {err && !created && (
        <span className="text-[11px] text-rose-600">{err}</span>
      )}
    </span>
  );
}
