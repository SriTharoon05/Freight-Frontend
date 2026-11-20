"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import {
  mailCategories,
  mailCategoryDescriptions,
  mailQueues,
  type MailQueue,
} from "@/lib/mail-triage";
import {
  ArrowUpRight,
  Inbox,
  MessageSquare,
  RefreshCw,
  Search,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { freight, type Page, dateLabel } from "@/lib/freight";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  ErrorBanner,
  Pager,
  buttonClass,
  inputClass,
  secondaryClass,
} from "./shared";
import { QueryFeedback } from "./query-feedback";
import { PackingDocuments } from "./packing-documents";
import { OutlookDraftButton } from "./outlook-draft-button";

export type EmailRequest = {
  id: string;
  source_email_id: string;
  subject: string;
  from_address: string;
  body: string;
  customer_id: string | null;
  received_at: string;
  last_company_reply_at: string | null;
  response_status: "checking" | "pending" | "replied" | "awaiting_supplier";
  rfq_id: string | null;
  review_required: boolean;
  category: keyof typeof mailCategories;
  priority: "critical" | "medium" | "low";
  workflow: MailQueue;
  triage_reason: string;
  classification_evidence?: string;
  priority_reason?: string;
  shipment_id: string | null;
  quoted_at: string | null;
  confirmed_at: string | null;
  manually_reviewed: boolean;
  summary_bullets?: string[];
  action_items?: string[];
};
type Requests = Page<EmailRequest> & {
  pending_total: number;
  replied_total: number;
  coverage_complete: boolean;
  connected_mailboxes: string[];
  mailbox_options: { id: string; address: string }[];
  reclassifying_total: number;
};
type Message = {
  id: string;
  subject: string;
  body: string;
  from_address: string;
  received_at: string;
  direction: string;
};

export function EmailRequests({
  onCreate,
  onOpen,
  workflow = "rfq",
}: {
  onCreate?: (email: EmailRequest) => Promise<void>;
  onOpen?: (identity: string) => Promise<void>;
  workflow?: MailQueue;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [focus, setFocus] = useState(params?.get("conversation") || "");
  const client = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [mailbox, setMailbox] = useState("");
  const [conversation, setConversation] = useState<EmailRequest | null>(null);
  const [messagePage, setMessagePage] = useState(1);
  const [messageFocus, setMessageFocus] = useState(params?.get("message") || "");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");
  const [reviewCategory, setReviewCategory] =
    useState<keyof typeof mailCategories>("other");
  const [reviewPriority, setReviewPriority] = useState("medium");
  const [replyDraft, setReplyDraft] = useState("");
  const [replyMessageId, setReplyMessageId] = useState("");
  const q = useDebouncedValue(search.trim());
  const permitted = [
    "sales",
    "admin",
    "org_admin",
    "manager",
    "ops_manager",
  ].includes(user?.role || "");
  const requests = useQuery<Requests>({
    queryKey: [
      "freight",
      user?.tenant_id,
      "email-requests",
      status,
      page,
      q,
      mailbox,
      workflow,
      category,
      priority,
      focus,
    ],
    queryFn: ({ signal }) =>
      freight.get<Requests>(
        "/email-requests",
        {
          status,
          page,
          q,
          mailbox_id: mailbox || undefined,
          workflow,
          category,
          priority,
          conversation_id: focus || undefined,
        },
        signal,
      ),
    enabled: permitted,
    refetchInterval: (query) => (query.state.error ? 60000 : 30000),
  });
  const messages = useQuery<Page<Message>>({
    queryKey: [
      "freight",
      user?.tenant_id,
      "email-request-messages",
      conversation?.id,
      messagePage,
      messageFocus,
    ],
    queryFn: ({ signal }) =>
      freight.get<Page<Message>>(
        "/email-requests/" + conversation?.id + "/messages",
        { page: messagePage, message_id: messageFocus || undefined },
        signal,
      ),
    enabled: permitted && !!conversation,
    refetchInterval: (query) => (query.state.error ? 60000 : 30000),
  });
  useEffect(() => {
    if (requests.data)
      setPage((current) =>
        Math.min(current, Math.max(1, Math.ceil(requests.data.total / 20))),
      );
  }, [requests.data]);
  useEffect(() => {
    const item = requests.data?.items.find((mail: EmailRequest) => mail.id === focus);
    if (item && focus) {
      setConversation(item);
      setReviewCategory(item.category || "other");
      setReviewPriority(item.priority || "medium");
      setFocus("");
    }
  }, [requests.data, focus]);
  useEffect(() => {
    setConversation((current) => current
      ? requests.data?.items.find((item: EmailRequest) => item.id === current.id) || current
      : null);
  }, [requests.data]);
  const act = async (email: EmailRequest) => {
    setBusy(email.id);
    setActionError(null);
    try {
      if (email.shipment_id) router.push("/shipments/" + email.shipment_id);
      else if (workflow === "ready")
        router.push(
          "/shipments/new?conversation=" +
            email.id +
            (email.rfq_id ? "&rfq=" + email.rfq_id : ""),
        );
      else if (email.rfq_id && onOpen) await onOpen(email.rfq_id);
      else if (onCreate) await onCreate(email);
    } catch (error) {
      setActionError(error);
    } finally {
      setBusy(null);
    }
  };
  const openConversation = (email: EmailRequest) => {
    setConversation(email);
    setMessagePage(1);
    setMessageFocus("");
    setReviewCategory(email.category || "other");
    setReviewPriority(email.priority || "medium");
    setActionError(null);
  };
  const review = async (reset = false) => {
    if (!conversation || busy) return;
    setBusy(conversation.id);
    setActionError(null);
    try {
      await freight.patch(
        "/email-requests/" + conversation.id + "/triage",
        reset
          ? { reset: true }
          : { category: reviewCategory, priority: reviewPriority },
      );
      await client.invalidateQueries({
        queryKey: ["freight", user?.tenant_id, "email-requests"],
      });
      setConversation(null);
    } catch (error) {
      setActionError(error);
    } finally {
      setBusy(null);
    }
  };
  if (!permitted) return null;
  return (
    <section
      aria-label={mailQueues[workflow].title}
      className="rounded-2xl border border-[#e8e6f0] bg-white"
    >
      <div className="border-b border-[#eeecf5] p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">{mailQueues[workflow].title}</h2>
            <p className="mt-1 text-xs text-[#777884]">
              {mailQueues[workflow].description}
            </p>
          </div>
          <button
            type="button"
            className={secondaryClass}
            disabled={requests.isFetching}
            onClick={() => void requests.refetch()}
          >
            <RefreshCw
              className={
                "h-3.5 w-3.5 " + (requests.isFetching ? "animate-spin" : "")
              }
            />
            Refresh
          </button>
        </div>
        <div className="mt-3 grid gap-3 sm:flex sm:flex-wrap sm:items-center">
          {(workflow === "other" || workflow === "all") && (
            <label className="min-w-0 sm:min-w-[10rem] sm:flex-1 sm:max-w-xs">
              <span className="sr-only">Email category</span>
              <select
                aria-label="Email category"
                className={inputClass}
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All categories</option>
                {Object.entries(mailCategories)
                  .filter(([key]) => workflow === "all" || key !== "rfq")
                  .map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <label className="min-w-0 sm:min-w-[10rem] sm:flex-1 sm:max-w-xs">
            <span className="sr-only">Email priority</span>
            <select
              aria-label="Email priority"
              className={inputClass}
              value={priority}
              onChange={(event) => {
                setPriority(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All priorities</option>
              <option value="critical">Critical</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          <p className="self-center text-xs text-[#777884]">
            Critical first · Newest within each priority
          </p>
        </div>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search email requests</span>
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#858693]" />
            <input
              type="search"
              className={inputClass + " pl-9"}
              placeholder="Search content, subject or sender…"
              maxLength={200}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="min-w-0 lg:w-64">
            <span className="sr-only">Connected mailbox</span>
            <select
              aria-label="Connected mailbox"
              className={inputClass}
              value={mailbox}
              onChange={(event) => {
                setMailbox(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All connected inboxes</option>
              {requests.data?.mailbox_options?.map(
                (item: { id: string; address: string }) => (
                  <option key={item.id} value={item.id}>
                    {item.address}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>
        <div
          role="group"
          aria-label="Reply status"
          className="mt-4 flex flex-wrap gap-2"
        >
          {[
            {
              value: "pending",
              label: workflow === "supplier_rates" ? "Supplier replied" : "Awaiting reply",
              count: requests.data?.pending_total,
            },
            {
              value: "replied",
              label: workflow === "supplier_rates" ? "Awaiting supplier" : "Replied",
              count: requests.data?.replied_total,
            },
            { value: "all", label: "All conversations", count: undefined },
          ].map(({ value, label, count }) => (
            <button
              key={value}
              type="button"
              aria-pressed={status === value}
              className={
                "rounded-lg px-3 py-2 text-xs font-medium transition-colors " +
                (status === value
                  ? "bg-[#7068cf] text-white"
                  : "bg-[#f5f4fa] text-[#606174] hover:bg-[#eceaf7]")
              }
              onClick={() => {
                setStatus(value);
                setPage(1);
              }}
            >
              {label}
              {typeof count === "number" && (
                <span className="ml-2 rounded bg-black/10 px-1.5 py-0.5 tabular-nums">
                  {count}
                </span>
              )}
            </button>
          ))}
          {(search ||
            mailbox ||
            category ||
            priority ||
            status !== (workflow === "rfq" ? "pending" : "all")) && (
            <button
              type="button"
              className="px-2 text-xs text-[#7068cf] underline-offset-4 hover:underline"
              onClick={() => {
                setSearch("");
                setMailbox("");
                setStatus(workflow === "rfq" ? "pending" : "all");
                setCategory("");
                setPriority("");
                setPage(1);
              }}
            >
              Reset filters
            </button>
          )}
        </div>
      </div>
      <div className="p-4 sm:p-5">
        {!!requests.data?.items.length && <p className="mb-3 text-xs text-[#777884]">Briefs for {requests.data.items.length} of {requests.data.total} conversations · {requests.data.items.reduce((count: number, email: EmailRequest) => count + (email.action_items?.length || 0), 0)} action items on this page</p>}
        {!!requests.data?.reclassifying_total && (
          <p
            role="status"
            className="mb-4 rounded-xl bg-[#f4f2ff] px-4 py-3 text-xs text-[#655dc4]"
          >
            Updating categories for {requests.data.reclassifying_total} imported
            conversations. Results will appear automatically as classification
            finishes.
          </p>
        )}
        <ErrorBanner error={actionError} />
        <QueryFeedback
          error={requests.error}
          hasData={!!requests.data}
          fetching={requests.isFetching}
          updatedAt={requests.dataUpdatedAt}
          retry={() => void requests.refetch()}
        />
        {requests.data && !requests.data.coverage_complete && (
          <p
            role="status"
            className="mb-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900"
          >
            Importing Inbox and Sent Items. Requests marked “Checking” may
            already have a reply.{" "}
            <a className="font-semibold underline" href="/settings">
              View inbox settings
            </a>{" "}
            to check progress or connection errors.
          </p>
        )}
        {requests.data?.total === 0 && (
          <div className="py-12 text-center">
            <Inbox className="mx-auto mb-3 h-8 w-8 text-[#aaa6c4]" />
            <h3 className="text-sm font-semibold">
              {q || mailbox || category || priority
                ? "No matching conversations"
                : status === "pending"
                  ? requests.data.coverage_complete
                    ? "You’re caught up"
                    : "Checking your inboxes"
                  : "No conversations here yet"}
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-[#777884]">
              {q || mailbox || category || priority
                ? "Try a different subject, sender, inbox, category or priority."
                : workflow === "rfq"
                  ? "Only emails requesting quotes appear here. Other correspondence is in Other emails."
                  : workflow === "potential"
                    ? "Conversations appear here after the requesting customer replies to our selling quote."
                    : workflow === "ready"
                      ? "Customer confirmations appear here for review before you create a job."
                      : "Emails appear here automatically as your connected inboxes sync."}
            </p>
          </div>
        )}
        <div className="divide-y divide-[#eeecf5]">
          {requests.data?.items.map((email: EmailRequest) => (
            <article
              key={email.id}
              className="flex flex-col justify-between gap-4 py-5 first:pt-1 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    className={
                      "rounded-md px-2 py-1 text-[10px] font-semibold " +
                      (email.response_status === "replied"
                        ? "bg-emerald-50 text-emerald-700"
                        : email.response_status === "pending"
                          ? "bg-amber-50 text-amber-800"
                          : "bg-slate-100 text-slate-600")
                    }
                  >
                    {email.response_status === "awaiting_supplier"
                      ? "Awaiting supplier"
                      : email.response_status === "pending"
                      ? workflow === "supplier_rates" ? "Carrier / agent replied" : "Awaiting reply"
                      : email.response_status === "replied"
                        ? "Replied"
                        : "Checking"}
                  </span>
                  {email.rfq_id && (
                    <span className="text-[10px] text-[#777884]">
                      RFQ prepared
                    </span>
                  )}
                  <span
                    className={
                      "rounded-md px-2 py-1 text-[10px] font-semibold " +
                      (email.priority === "critical"
                        ? "bg-red-50 text-red-700"
                        : email.priority === "medium"
                          ? "bg-amber-50 text-amber-800"
                          : "bg-slate-100 text-slate-600")
                    }
                  >
                    {email.priority === "critical"
                      ? "Critical"
                      : email.priority === "medium"
                        ? "Medium"
                        : "Low"}
                  </span>
                  {(workflow === "other" || workflow === "all") && (
                    <span className="text-[11px] text-[#606174]">
                      {mailCategories[email.category] || "General mail"}
                    </span>
                  )}
                  {email.review_required && (
                    <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800">
                      Needs review
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="block break-words text-left text-sm font-semibold leading-relaxed text-[#343444] hover:text-[#7068cf] focus-visible:underline"
                  onClick={() => {
                    openConversation(email);
                  }}
                >
                  {email.subject || "(No subject)"}
                </button>
                <p className="mt-1 break-words text-xs text-[#777884]">
                  {email.from_address} <span aria-hidden="true">·</span>{" "}
                  {dateLabel(email.received_at)}
                </p>
                <ul aria-label="Email summary" className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed text-[#606174]">{(email.summary_bullets?.length ? email.summary_bullets : [email.body.slice(0, 180).replace(/\s+/g, " ")]).map((bullet, index) => <li key={index}>{bullet}</li>)}</ul>
                {(() => {
                  const filteredActions = (email.action_items || []).filter(
                    (act) => !((email.response_status === "replied" || email.quoted_at) && /\b(quote|quotation|rates?|pricing|rfq)\b/i.test(act))
                  );
                  return filteredActions.length ? (
                    <div className="mt-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                      <strong>Action items</strong>
                      <ul className="mt-1 list-disc space-y-1 pl-4">
                        {filteredActions.map((action, index) => <li key={index}>{action}</li>)}
                      </ul>
                    </div>
                  ) : null;
                })()}
                <p className="mt-2 text-[11px] text-[#777884]">
                  {email.triage_reason}
                </p>
                <PackingDocuments conversationId={email.id} />
                {(workflow === "rfq" || workflow === "potential") &&
                  email.quoted_at && (
                    <p className="mt-1 text-[11px] text-[#606174]">
                      Quote sent {dateLabel(email.quoted_at)}
                    </p>
                  )}
                {workflow === "ready" && email.confirmed_at && (
                  <p className="mt-1 text-[11px] text-emerald-700">
                    Customer confirmed {dateLabel(email.confirmed_at)}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  className={secondaryClass}
                  onClick={() => {
                    openConversation(email);
                  }}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Conversation
                </button>
                {(workflow === "ready" ||
                  email.shipment_id ||
                  onCreate ||
                  onOpen) && (
                  <button
                    type="button"
                    disabled={busy !== null}
                    className={email.rfq_id ? secondaryClass : buttonClass}
                    onClick={() => void act(email)}
                  >
                    {busy === email.id
                      ? "Opening…"
                      : email.shipment_id
                        ? "Open job"
                        : email.rfq_id
                          ? workflow === "ready"
                            ? "Review & create job"
                            : "Open RFQ"
                          : workflow === "ready"
                            ? "Review & create job"
                            : "Prepare RFQ"}
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
        {!!requests.data?.total && (
          <Pager
            page={page}
            total={requests.data.total}
            limit={20}
            onChange={setPage}
          />
        )}
      </div>
      <Sheet
        open={!!conversation}
        onOpenChange={(open) => {
          if (!open) setConversation(null);
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:w-full sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>
              {conversation?.subject || "Conversation history"}
            </SheetTitle>
            <SheetDescription>
              Messages received by your connected mailboxes. Read status does
              not determine whether a reply is pending.
            </SheetDescription>
          </SheetHeader>
          {conversation && <PackingDocuments conversationId={conversation.id} />}
          {conversation && (
            <div className="mt-5 rounded-xl border border-[#e3dff3] bg-[#faf9fe] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[#1f2029]">
                  Reply in same Outlook thread
                </h3>
                {!!messages.data?.items?.length && (
                  <select
                    aria-label="Reply target message"
                    className={`${inputClass} !w-auto !py-1 text-xs`}
                    value={replyMessageId}
                    onChange={(e) => setReplyMessageId(e.target.value)}
                  >
                    <option value="">Latest inbound message in thread</option>
                    {messages.data.items.map((m: Message) => (
                      <option key={m.id} value={m.id}>
                        {m.direction === "outbound" ? "Sent" : "From"} {m.from_address} · {dateLabel(m.received_at)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <textarea
                rows={4}
                aria-label="Outlook thread reply body"
                className={`${inputClass} mt-2.5`}
                placeholder={`Write reply to ${conversation.from_address}…`}
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
              />
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                <OutlookDraftButton
                  conversationId={conversation.id}
                  messageId={replyMessageId || undefined}
                  body={replyDraft}
                  label="Create Outlook draft (same thread)"
                />
                <span className="text-[11px] text-[#777884]">
                  Preserves Outlook thread ID &amp; quoted history
                </span>
              </div>
            </div>
          )}
          <div className="mt-5 rounded-xl bg-[#f7f6fb] p-4">
            <h3 className="text-sm font-semibold">Review classification</h3>
            <p className="mb-3 mt-1 text-xs text-[#777884]">
              Correct a category or priority. Your choice is kept during future
              syncs; automatic workflow still follows the conversation.
            </p>
            {conversation?.classification_evidence && (
              <div className="mb-3 rounded-lg border border-[#e8e6f0] bg-white p-3 text-xs">
                <p className="font-semibold text-[#343444]">
                  Classification evidence
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-[#606174]">
                  “{conversation.classification_evidence}”
                </p>
                <p className="mt-2 text-[#777884]">
                  {conversation.triage_reason}
                </p>
              </div>
            )}
            {conversation?.review_required && (
              <p className="mb-3 text-xs text-amber-800">
                The message needs review because its purpose is unclear or the
                evidence conflicts. Check the conversation and attachments
                before choosing a category.
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs">
                Category
                <select
                  aria-label="Review category"
                  className={inputClass + " mt-1"}
                  value={reviewCategory}
                  onChange={(event) =>
                    setReviewCategory(
                      event.target.value as keyof typeof mailCategories,
                    )
                  }
                >
                  {Object.entries(mailCategories).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                Priority
                <select
                  aria-label="Review priority"
                  className={inputClass + " mt-1"}
                  value={reviewPriority}
                  onChange={(event) => setReviewPriority(event.target.value)}
                >
                  <option value="critical">Critical</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </label>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[#606174]">
              {mailCategoryDescriptions[reviewCategory]}
            </p>
            {conversation?.priority_reason && (
              <p className="mt-2 text-xs text-[#777884]">
                Priority: {conversation.priority_reason}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={buttonClass}
                disabled={!!busy}
                onClick={() => void review()}
              >
                {busy ? "Saving…" : "Save classification"}
              </button>
              <button
                type="button"
                className={secondaryClass}
                disabled={!!busy}
                onClick={() => void review(true)}
              >
                Use automatic classification
              </button>
            </div>
            <ErrorBanner error={actionError} />
          </div>
          <div className="mt-5">
            {messageFocus && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#f4f2ff] p-3 text-xs">
              <span>Showing the source email for this quoted rate or request.</span>
              <button type="button" className={secondaryClass} onClick={() => { setMessageFocus(""); setMessagePage(1); }}>Show full conversation</button>
            </div>}
            <QueryFeedback
              error={messages.error}
              hasData={!!messages.data}
              fetching={messages.isFetching}
              updatedAt={messages.dataUpdatedAt}
              retry={() => void messages.refetch()}
            />
            {messages.data?.items.map((message: Message) => (
              <article
                key={message.id}
                className="mb-4 rounded-xl border border-[#eeecf5] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        "rounded px-1.5 py-0.5 text-[10px] font-semibold " +
                        (message.direction === "outbound"
                          ? "bg-purple-100 text-[#7068cf]"
                          : "bg-slate-100 text-slate-700")
                      }
                    >
                      {message.direction === "outbound" ? "Sent reply" : "Received"}
                    </span>
                    <strong className="break-all">{message.from_address}</strong>
                  </div>
                  <time
                    dateTime={message.received_at}
                    className="text-[#777884]"
                  >
                    {dateLabel(message.received_at)}
                  </time>
                </div>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {message.body || "(Message has no text body)"}
                </p>
              </article>
            ))}
            {messages.data?.total === 0 && (
              <p className="py-8 text-sm text-[#777884]">
                No imported messages are available for this conversation.
              </p>
            )}
            {!!messages.data?.total && (
              <Pager
                page={messagePage}
                total={messages.data.total}
                limit={30}
                onChange={setMessagePage}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}

