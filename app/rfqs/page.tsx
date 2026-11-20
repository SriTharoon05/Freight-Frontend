"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutGrid,
  List,
  Plus,
  RefreshCw,
  Search,
  FileText,
  Calculator,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/shell/app-shell";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  EntityAutocomplete,
  ChargeSelect,
  Panel,
  Field,
  ErrorBanner,
  Pager,
  useDraft,
  inputClass,
  buttonClass,
  secondaryClass,
} from "@/components/freight/shared";
import { QueryFeedback } from "@/components/freight/query-feedback";
import { LocationAutocomplete } from "@/components/freight/location-autocomplete";
import {
  freight,
  blankCargo,
  blankDimensionItem,
  calculateConsignmentTotals,
  calculateRateBuyAmount,
  calculateSellFromBuy,
  formatCargoSummaryText,
  recalculateCommodityCargo,
  LB_PER_KG,
  type Cargo,
  type ChargeType,
  type Page,
  type Entity,
  dateLabel,
  moneyLabel,
  localDateInput,
  errorMessage,
} from "@/lib/freight";
import { useAuthStore } from "@/lib/auth-store";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { EmailRequests } from "@/components/freight/email-requests";
import { quotationDraft } from "@/lib/email-draft";
import { RfqCargoEditor } from "@/components/freight/rfq-cargo-editor";
import { TransportPriceQuoteModal } from "@/components/freight/transport-price-quote";
import { OutlookDraftButton } from "@/components/freight/outlook-draft-button";
import {
  SupplierRateSuggestions,
  RateCardSuggestions,
  type RateSuggestions,
} from "@/components/freight/supplier-rate-suggestions";

type Row = Record<string, any>;
const stages = ["new", "quote_draft", "quoted", "accepted", "won", "lost", "no_rate"];
const stageLabels: Record<string, string> = {
  new: "New",
  quoted: "Quoted",
  quote_draft: "Quote draft saved",
  accepted: "Accepted · job pending",
  won: "Job created",
  lost: "Lost",
  no_rate: "Needs rates",
};
const modes = ["ocean", "air", "road", "rail", "multimodal"];
const workspaceTabs = [
  ["inbox", "RFQ emails"],
  ["potential", "Potential jobs"],
  ["ready", "Jobs to create"],
  ["prepared", "Prepared RFQs"],
];

function normalizeRfqCargoItems(rawItems: any[], mode: string, airDivisor: "standard" | "express"): Cargo[] {
  if (!Array.isArray(rawItems) || rawItems.length === 0) return [blankCargo()];
  return rawItems.map((item) => {
    const base: Cargo = {
      ...blankCargo(),
      ...item,
      weight_unit: item?.weight_unit === "lb" ? "lb" : "kg",
    };
    const dims =
      Array.isArray(item?.dimension_items) && item.dimension_items.length > 0
        ? item.dimension_items.map((d: any) => ({
            pieces: Math.max(1, Number(d?.pieces) || 1),
            length: Math.max(0, Number(d?.length) || 0),
            width: Math.max(0, Number(d?.width) || 0),
            height: Math.max(0, Number(d?.height) || 0),
            unit: (d?.unit === "m" || d?.unit === "in" ? d.unit : "cm") as "cm" | "m" | "in",
            gross_weight: Math.max(0, Number(d?.gross_weight) || 0),
            volume: Math.max(0, Number(d?.volume) || 0),
            volumetric_weight: Math.max(0, Number(d?.volumetric_weight) || 0),
          }))
        : [
            {
              ...blankDimensionItem(),
              pieces: Math.max(1, Number(item?.pieces) || 1),
              gross_weight: Math.max(0, Number(item?.gross_weight) || 0),
              volume: Math.max(0, Number(item?.volume) || 0),
              volumetric_weight: Math.max(0, Number(item?.volumetric_weight) || 0),
            },
          ];
    return recalculateCommodityCargo(base, dims, mode || "air", airDivisor);
  });
}

export default function RfqsPage() {
  const user = useAuthStore((s) => s.user);
  const client = useQueryClient();
  const initialTab = useSearchParams().get("tab");
  const [tab, setTab] = useState(
    workspaceTabs.some(([key]) => key === initialTab) ? initialTab! : "inbox",
  );
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(useSearchParams().get("status") || "");
  const [mode, setMode] = useState("");
  const [search, setSearch] = useState("");
  const [kanban, setKanban] = useState(false);
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Row | null>(null);
  const [quoteDocState, setQuoteDocState] = useState<{
    rfq: Row;
    initialTab: "document" | "pdf" | "editor";
  } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const canPrepare = [
    "sales",
    "admin",
    "org_admin",
    "manager",
    "ops_manager",
  ].includes(user?.role || "");
  const activeTab = canPrepare ? tab : "prepared";
  const q = useDebouncedValue(search.trim());
  const draft = useDraft("new-rfq", {
    customer: null as Entity | null,
    staff: null as Entity | null,
    mode: "ocean",
    origin: "",
    destination: "",
    etd: "",
    equipment: "",
    cargo: "",
    cargo_items: [blankCargo()] as Cargo[],
    air_divisor: "standard" as "standard" | "express",
    total_chargeable_weight: "",
    chargeable_weight_manual: false,
    has_ai_prefill: false,
    source_email_id: "",
    source_subject: "",
    source_body: "",
    source_href: "",
  });
  const origin = useDebouncedValue(draft.value.origin.trim());
  const destination = useDebouncedValue(draft.value.destination.trim());
  const list = useQuery<Page<Row>>({
    queryKey: ["freight", user?.tenant_id, "rfqs", page, status, mode, q],
    queryFn: ({ signal }) =>
      freight.get<Page<Row>>("/rfqs", { page, status, mode, q }, signal),
    enabled: !!user && activeTab === "prepared",
  });
  const draftRates = useQuery<RateSuggestions>({
    queryKey: [
      "freight",
      user?.tenant_id,
      "draft-supplier-rates",
      draft.value.mode,
      origin,
      destination,
    ],
    queryFn: ({ signal }) =>
      freight.get(
        "/supplier-rate-suggestions",
        { mode: draft.value.mode, origin, destination },
        signal,
      ),
    enabled: canPrepare && adding && origin.length >= 2 && destination.length >= 2,
  });
  const draftCards = useQuery<Page<Row>>({
    queryKey: [
      "freight",
      user?.tenant_id,
      "draft-rate-cards",
      draft.value.mode,
      origin,
      destination,
    ],
    queryFn: ({ signal }) =>
      freight.get(
        "/rate-card-suggestions",
        { mode: draft.value.mode, origin, destination, limit: 10 },
        signal,
      ),
    enabled: canPrepare && adding && origin.length >= 2 && destination.length >= 2,
  });
  useEffect(() => {
    if (list.data)
      setPage((current) =>
        Math.min(current, Math.max(1, Math.ceil(list.data.total / 30))),
      );
  }, [list.data]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const d = draft.value;
      const items = Array.isArray(d.cargo_items) ? d.cargo_items : [blankCargo()];
      const totals = calculateConsignmentTotals(items);
      const finalCW = d.chargeable_weight_manual
        ? Number(d.total_chargeable_weight) || 0
        : totals.autoChargeableWeightKg;
      const cargoText = d.cargo.trim() || formatCargoSummaryText(items);

      await freight.post(
        d.source_email_id
          ? "/rfq-email-candidates/" + d.source_email_id
          : "/rfqs",
        {
          customer_id: d.customer?.id,
          assigned_user_id: d.staff?.id || user?.id,
          mode: d.mode,
          origin: d.origin.trim().toUpperCase(),
          destination: d.destination.trim().toUpperCase(),
          etd: d.etd ? new Date(d.etd).toISOString() : null,
          equipment: d.equipment,
          cargo: cargoText,
          cargo_items: items,
          air_divisor: d.air_divisor || "standard",
          total_pieces: totals.totalPieces,
          total_gross_weight: totals.totalGrossKg,
          total_volumetric_weight: totals.totalVolumetricKg,
          total_volume: totals.totalVolumeCbm,
          total_chargeable_weight: finalCW,
          chargeable_weight_manual: !!d.chargeable_weight_manual,
        },
      );
      setAdding(false);
      setTab("prepared");
      setPage(1);
      setStatus("");
      setMode("");
      setSearch("");
      draft.setValue((v) => ({
        ...v,
        source_email_id: "",
        source_subject: "",
        source_body: "",
        source_href: "",
        customer: null,
        cargo: "",
        cargo_items: [blankCargo()],
        total_chargeable_weight: "",
        chargeable_weight_manual: false,
        has_ai_prefill: false,
        origin: "",
        destination: "",
        etd: "",
        equipment: "",
      }));
      void client.invalidateQueries({ queryKey: ["freight"] });
      toast.success("RFQ prepared");
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  };

  const card = (row: Row) => (
    <button
      key={row.id}
      type="button"
      className="block w-full rounded-xl border border-[#e8e6f0] bg-white p-4 text-left transition-colors hover:border-[#7068cf] hover:bg-[#fcfbff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7068cf]"
      onClick={() => setSelected(row)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[#7068cf]">
          {row.reference}
        </span>
        <span
          className={
            "rounded-md px-2 py-1 text-[10px] font-medium " +
            (row.status === "won"
              ? "bg-emerald-50 text-emerald-700"
              : row.status === "lost"
                ? "bg-red-50 text-red-700"
                : "bg-[#f4f2ff] text-[#7068cf]")
          }
        >
          {stageLabels[row.status] || row.status}
        </span>
      </div>
      <p className="mt-3 break-words text-sm font-semibold">
        {row.customer_name}
      </p>
      <p className="mt-2 text-xs text-[#606174]">
        {row.origin} → {row.destination}
        <span className="ml-2 capitalize text-[#858693]">{row.mode}</span>
      </p>
      {Number(row.form?.total_chargeable_weight || 0) > 0 && (
        <p className="mt-1 text-[11px] text-[#777884]">
          {row.form?.total_pieces || 0} pcs · Chg Wt {Number(row.form.total_chargeable_weight).toFixed(2)} kg · {Number(row.form?.total_volume || 0).toFixed(3)} m³
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#f0eef6] pt-3 text-[11px] text-[#858693]">
        <span>ETD {dateLabel(row.etd)}</span>
        <button
          type="button"
          className="inline-flex items-center gap-1 font-semibold text-[#7068cf] hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            setQuoteDocState({ rfq: row, initialTab: "document" });
          }}
        >
          <FileText className="h-3 w-3" />
          Transport Quote
        </button>
      </div>
    </button>
  );

  return (
    <AppShell>
      <div className="space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Requests for quotation
            </h1>
            <p className="mt-1 text-sm text-[#777884]">
              Quote request → Quote sent → Customer confirmed → Create job.
            </p>
          </div>
          {canPrepare && (
            <Link href="/emails?workflow=supplier_rates" className={secondaryClass}>
              Supplier enquiries &amp; replies →
            </Link>
          )}
          {canPrepare && (
            <button
              type="button"
              className={buttonClass}
              onClick={() => {
                setError(null);
                draft.setValue((v) => ({
                  ...v,
                  source_email_id: "",
                  source_subject: "",
                  source_body: "",
                  source_href: "",
                  has_ai_prefill: false,
                }));
                setAdding(true);
              }}
            >
              <Plus className="h-4 w-4" />
              New RFQ
            </button>
          )}
        </header>
        {canPrepare && (
          <div
            role="tablist"
            aria-label="RFQ workspace"
            className="flex flex-wrap gap-1 border-b border-[#e5e3ee]"
          >
            {workspaceTabs.map(([value, label]) => (
              <button
                key={value}
                id={"rfq-tab-" + value}
                role="tab"
                type="button"
                tabIndex={activeTab === value ? 0 : -1}
                onKeyDown={(event) => {
                  if (
                    !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                      event.key,
                    )
                  )
                    return;
                  event.preventDefault();
                  const index = workspaceTabs.findIndex(
                    ([key]) => key === value,
                  );
                  const next =
                    workspaceTabs[
                      event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? workspaceTabs.length - 1
                          : (index +
                              (event.key === "ArrowRight" ? 1 : -1) +
                              workspaceTabs.length) %
                            workspaceTabs.length
                    ][0];
                  setTab(next);
                  document.getElementById("rfq-tab-" + next)?.focus();
                }}
                aria-selected={activeTab === value}
                aria-controls={"rfq-panel-" + value}
                className={
                  "border-b-2 px-4 py-3 text-sm font-medium transition-colors " +
                  (activeTab === value
                    ? "border-[#7068cf] text-[#7068cf]"
                    : "border-transparent text-[#777884] hover:text-[#343444]")
                }
                onClick={() => setTab(value)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <div
          id={"rfq-panel-" + activeTab}
          role="tabpanel"
          aria-labelledby={canPrepare ? "rfq-tab-" + activeTab : undefined}
        >
          {activeTab !== "prepared" ? (
            <EmailRequests
              key={activeTab}
              workflow={
                activeTab === "inbox"
                  ? "rfq"
                  : activeTab === "potential"
                    ? "potential"
                    : "ready"
              }
              onCreate={async (email) => {
                const context = await freight.get<Row>(`/email-requests/${email.id}/context`);
                const customer =
                  context.customer ||
                  (email.customer_id
                    ? await freight.get<Entity>(
                        "/entities/customers/" + email.customer_id,
                      )
                    : null);
                const nextMode = context.mode || draft.value.mode || "air";
                const normalizedItems = normalizeRfqCargoItems(
                  context.cargo_items || [],
                  nextMode,
                  "standard",
                );
                const totals = calculateConsignmentTotals(normalizedItems);
                draft.setValue((value) => ({
                  ...value,
                  source_email_id: context.source_email_id || email.source_email_id,
                  source_subject: context.subject || email.subject,
                  source_body: context.current_body || "",
                  source_href:
                    context.email_href || `/emails?workflow=all&conversation=${email.id}`,
                  customer,
                  cargo: context.cargo || "",
                  cargo_items: normalizedItems,
                  total_chargeable_weight:
                    totals.autoChargeableWeightKg > 0
                      ? totals.autoChargeableWeightKg.toFixed(2)
                      : "",
                  chargeable_weight_manual: false,
                  has_ai_prefill:
                    Array.isArray(context.cargo_items) && context.cargo_items.length > 0,
                  mode: nextMode,
                  origin: context.origin || "",
                  destination: context.destination || "",
                  etd: "",
                  equipment: (context as any).equipment || "",
                }));
                setError(null);
                setAdding(true);
              }}
              onOpen={async (identity) =>
                setSelected(await freight.get<Row>("/rfqs/" + identity))
              }
            />
          ) : (
            <section
              aria-label="Prepared RFQs"
              className="rounded-2xl border border-[#e8e6f0] bg-white p-4 sm:p-5"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Prepared RFQs</h2>
                  <p className="mt-1 text-xs text-[#777884]">
                    Quotes you have created or prepared from email requests.
                  </p>
                </div>
                <button
                  type="button"
                  className={secondaryClass}
                  disabled={list.isFetching}
                  onClick={() => void list.refetch()}
                >
                  <RefreshCw
                    className={
                      "h-3.5 w-3.5 " + (list.isFetching ? "animate-spin" : "")
                    }
                  />
                  Refresh
                </button>
              </div>
              <div className="mb-5 flex flex-col gap-3 xl:flex-row">
                <label className="relative min-w-0 flex-1">
                  <span className="sr-only">Search prepared RFQs</span>
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#858693]" />
                  <input
                    type="search"
                    maxLength={200}
                    className={inputClass + " pl-9"}
                    placeholder="Search reference, customer, or route…"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                  />
                </label>
                <div className="flex flex-wrap gap-3">
                  <select
                    aria-label="RFQ stage"
                    className={inputClass + " w-auto min-w-[140px] flex-1"}
                    value={status}
                    onChange={(event) => {
                      setStatus(event.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">All stages</option>
                    {stages.map((stage) => (
                      <option key={stage} value={stage}>
                        {stageLabels[stage]}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Transport mode"
                    className={inputClass + " w-auto min-w-[140px] flex-1"}
                    value={mode}
                    onChange={(event) => {
                      setMode(event.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">All modes</option>
                    {modes.map((value) => (
                      <option key={value} value={value}>
                        {value[0].toUpperCase() + value.slice(1)}
                      </option>
                    ))}
                  </select>
                  <div
                    role="group"
                    aria-label="RFQ view"
                    className="flex rounded-lg border border-[#e5e3ee] p-1"
                  >
                    <button
                      type="button"
                      aria-label="List view"
                      aria-pressed={!kanban}
                      className={
                        "rounded-md p-2 " +
                        (!kanban
                          ? "bg-[#f0eefb] text-[#7068cf]"
                          : "text-[#858693]")
                      }
                      onClick={() => setKanban(false)}
                    >
                      <List className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Board view"
                      aria-pressed={kanban}
                      className={
                        "rounded-md p-2 " +
                        (kanban
                          ? "bg-[#f0eefb] text-[#7068cf]"
                          : "text-[#858693]")
                      }
                      onClick={() => setKanban(true)}
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </button>
                  </div>
                  {(status || mode || search) && (
                    <button
                      type="button"
                      className={secondaryClass}
                      onClick={() => {
                        setStatus("");
                        setMode("");
                        setSearch("");
                        setPage(1);
                      }}
                    >
                      Reset filters
                    </button>
                  )}
                </div>
              </div>
              <QueryFeedback
                error={list.error}
                hasData={!!list.data}
                fetching={list.isFetching}
                updatedAt={list.dataUpdatedAt}
                retry={() => void list.refetch()}
              />
              {list.data?.total === 0 && (
                <div className="py-12 text-center">
                  <FileText className="mx-auto mb-3 h-8 w-8 text-[#aaa6c4]" />
                  <h3 className="text-sm font-semibold">
                    {status || mode || q
                      ? "No RFQs match your filters"
                      : "No prepared RFQs yet"}
                  </h3>
                  <p className="mt-2 text-xs text-[#777884]">
                    {status || mode || q
                      ? "Change or reset the filters to see more quotes."
                      : "Prepare a request from your inbox or create a new RFQ."}
                  </p>
                </div>
              )}
              {kanban && !!list.data?.total ? (
                <div className="flex gap-4 overflow-x-auto pb-3">
                  {(status ? [status] : stages).map((stage) => (
                    <div
                      key={stage}
                      className="w-64 shrink-0 space-y-3 rounded-xl bg-[#f7f6fc] p-3"
                    >
                      <h3 className="flex justify-between px-1 py-2 text-xs font-semibold text-[#606174]">
                        {stageLabels[stage]}
                        <span className="text-[#858693]">
                          {
                            list.data.items.filter(
                              (row: Row) => row.status === stage,
                            ).length
                          }
                        </span>
                      </h3>
                      {list.data.items
                        .filter((row: Row) => row.status === stage)
                        .map(card)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {list.data?.items.map(card)}
                </div>
              )}
              {!!list.data?.total && (
                <Pager
                  page={page}
                  total={list.data.total}
                  limit={30}
                  onChange={setPage}
                />
              )}
            </section>
          )}
        </div>
        <Sheet
          open={adding}
          onOpenChange={(open) => {
            if (!busy) setAdding(open);
          }}
        >
          <SheetContent className="w-full overflow-y-auto sm:w-full sm:max-w-4xl">
            <SheetHeader>
              <SheetTitle>
                {draft.value.source_email_id
                  ? "Prepare RFQ from email"
                  : "New RFQ"}
              </SheetTitle>
              <SheetDescription>
                Review the customer, route, and commodity dimensions before saving. Your draft is saved on this device.
              </SheetDescription>
            </SheetHeader>
            <ErrorBanner error={error || draft.storageError} />
            {draft.value.source_email_id && (
              <details className="mt-5 rounded-xl border border-[#e5e3ef] bg-[#f8f7fc] p-4">
                <summary className="cursor-pointer text-sm font-medium">
                  Customer email · {draft.value.source_subject || "Source request"}
                </summary>
                <p className="mt-3 max-h-72 overflow-y-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-[#606174]">
                  {draft.value.source_body ||
                    "Open the source conversation to review the customer request."}
                </p>
                <Link
                  href={draft.value.source_href || "/emails?workflow=all"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-xs font-medium text-[#7068cf] underline"
                >
                  Review source conversation ↗
                </Link>
              </details>
            )}
            <form onSubmit={save} className="mt-5 grid gap-4 sm:grid-cols-2">
              <EntityAutocomplete
                kind="customers"
                label="Customer"
                required
                value={draft.value.customer}
                onChange={(customer) =>
                  draft.setValue((v) => ({ ...v, customer }))
                }
              />
              <EntityAutocomplete
                kind="staff"
                label="Assigned staff"
                value={draft.value.staff}
                onChange={(staff) => draft.setValue((v) => ({ ...v, staff }))}
              />
              <Field label="Transport mode">
                <select
                  className={inputClass}
                  value={draft.value.mode}
                  onChange={(event) => {
                    const nextMode = event.target.value;
                    draft.setValue((v) => {
                      const recomputed = (v.cargo_items || [blankCargo()]).map((c: Cargo) =>
                        recalculateCommodityCargo(
                          c,
                          c.dimension_items?.length ? c.dimension_items : [blankDimensionItem()],
                          nextMode,
                          v.air_divisor || "standard",
                        ),
                      );
                      const totals = calculateConsignmentTotals(recomputed);
                      return {
                        ...v,
                        mode: nextMode,
                        cargo_items: recomputed,
                        total_chargeable_weight: v.chargeable_weight_manual
                          ? v.total_chargeable_weight
                          : totals.autoChargeableWeightKg > 0
                            ? totals.autoChargeableWeightKg.toFixed(2)
                            : "",
                      };
                    });
                  }}
                >
                  {modes.map((value) => (
                    <option key={value} value={value}>
                      {value[0].toUpperCase() + value.slice(1)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Estimated departure">
                <input
                  className={inputClass}
                  type="datetime-local"
                  value={draft.value.etd}
                  onChange={(event) =>
                    draft.setValue((v) => ({ ...v, etd: event.target.value }))
                  }
                />
              </Field>
              {(["origin", "destination"] as const).map((key) => (
                <LocationAutocomplete
                  key={key}
                  label={
                    key === "origin"
                      ? "Origin / loading point"
                      : "Destination / discharge point"
                  }
                  mode={draft.value.mode}
                  required
                  placeholder={
                    key === "origin"
                      ? draft.value.mode === "air"
                        ? "e.g. AMD, BOM, JFK"
                        : "e.g. INNSA, CNSHA"
                      : draft.value.mode === "air"
                        ? "e.g. AUH, DXB, LHR"
                        : "e.g. SGSIN, JEA"
                  }
                  value={draft.value[key]}
                  onChange={(val) =>
                    draft.setValue((v) => ({ ...v, [key]: val }))
                  }
                />
              ))}
              <Field label="Equipment">
                <input
                  className={inputClass}
                  value={draft.value.equipment}
                  placeholder="e.g. 1 × 40 ft container"
                  onChange={(event) =>
                    draft.setValue((v) => ({
                      ...v,
                      equipment: event.target.value,
                    }))
                  }
                />
              </Field>
              <div className="sm:col-span-2">
                <RfqCargoEditor
                  mode={draft.value.mode}
                  airDivisor={draft.value.air_divisor || "standard"}
                  onAirDivisorChange={(air_divisor) =>
                    draft.setValue((v) => ({ ...v, air_divisor }))
                  }
                  cargo={draft.value.cargo_items || [blankCargo()]}
                  onChangeCargo={(cargo_items) =>
                    draft.setValue((v) => ({ ...v, cargo_items }))
                  }
                  totalChargeableWeight={draft.value.total_chargeable_weight || ""}
                  chargeableWeightManual={!!draft.value.chargeable_weight_manual}
                  onChangeChargeableWeight={(total_chargeable_weight, chargeable_weight_manual) =>
                    draft.setValue((v) => ({
                      ...v,
                      total_chargeable_weight,
                      chargeable_weight_manual,
                    }))
                  }
                  cargoNotes={draft.value.cargo}
                  onChangeCargoNotes={(cargo) =>
                    draft.setValue((v) => ({ ...v, cargo }))
                  }
                  hasAiPrefill={!!draft.value.has_ai_prefill}
                />
              </div>
              <div className="sm:col-span-2">
                <ErrorBanner error={draftRates.error || draftCards.error} />
                <div className="grid gap-4 lg:grid-cols-2">
                  <SupplierRateSuggestions
                    data={
                      origin === draft.value.origin.trim() &&
                      destination === draft.value.destination.trim()
                        ? draftRates.data
                        : undefined
                    }
                    loading={draftRates.isFetching}
                  />
                  <RateCardSuggestions
                    data={
                      origin === draft.value.origin.trim() &&
                      destination === draft.value.destination.trim()
                        ? draftCards.data
                        : undefined
                    }
                    loading={draftCards.isFetching}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t border-[#eeecf5] pt-4 sm:col-span-2">
                <button
                  type="button"
                  className={secondaryClass}
                  disabled={busy}
                  onClick={() => setAdding(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={buttonClass}
                  disabled={busy || !draft.ready}
                >
                  {busy ? "Saving…" : "Save RFQ"}
                </button>
              </div>
            </form>
          </SheetContent>
        </Sheet>
        <Sheet
          open={!!selected}
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
        >
          <SheetContent className="w-full overflow-y-auto sm:w-full sm:max-w-5xl">
            <SheetHeader>
              <SheetTitle>
                {"Quote · " + (selected?.reference || "")}
              </SheetTitle>
              <SheetDescription>
                Review commodity dimensions, calculate rates with profit markup &amp; documentation fee, and preview the quotation PDF.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-5">
              {selected && (
                <QuoteEditor
                  key={selected.id}
                  rfq={selected}
                  close={() => setSelected(null)}
                  onOpenQuoteDoc={(r, initialTab = "document") => {
                    setSelected(null);
                    setQuoteDocState({ rfq: r, initialTab });
                  }}
                />
              )}
            </div>
          </SheetContent>
        </Sheet>
        <Sheet
          open={!!quoteDocState}
          onOpenChange={(open) => {
            if (!open) setQuoteDocState(null);
          }}
        >
          <SheetContent className="w-full overflow-y-auto sm:w-full sm:max-w-5xl">
            <SheetHeader>
              <SheetTitle>
                {"Transport Price Quote · " + (quoteDocState?.rfq?.reference || "")}
              </SheetTitle>
              <SheetDescription>
                Automatic transport price quote with cargo schedule and PDF preview.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-5">
              {quoteDocState && (
                <TransportPriceQuoteModal
                  key={`${quoteDocState.rfq.id}-${quoteDocState.initialTab}`}
                  rfq={quoteDocState.rfq}
                  initialTab={quoteDocState.initialTab}
                  onClose={() => setQuoteDocState(null)}
                  onSaved={() => {
                    void client.invalidateQueries({ queryKey: ["freight"] });
                  }}
                />
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </AppShell>
  );
}

function QuoteEditor({
  rfq,
  close,
  onOpenQuoteDoc,
}: {
  rfq: Row;
  close: () => void;
  onOpenQuoteDoc: (row: Row, initialTab?: "document" | "pdf" | "editor") => void;
}) {
  const tenantId = useAuthStore((state) => state.user?.tenant_id);
  const senderName = useAuthStore((state) => state.user?.full_name || "");
  const detail = useQuery<Row>({
    queryKey: ["freight", tenantId, "rfq", rfq.id],
    queryFn: () => freight.get<Row>("/rfqs/" + rfq.id),
  });
  const chargeSchedule = useQuery<Page<ChargeType>>({
    queryKey: ["freight", tenantId, "charge-schedule"],
    queryFn: () => freight.get<Page<ChargeType>>("/charge-schedule", { limit: 100 }),
  });
  const commercial = useQuery<Row>({
    queryKey: ["freight", tenantId, "settings"],
    queryFn: () => freight.get<Row>("/settings"),
  });

  const initialAirDivisor: "standard" | "express" =
    rfq.form?.air_divisor === "express" ? "express" : "standard";
  const initialCargoItems = normalizeRfqCargoItems(
    rfq.form?.cargo_items || [],
    rfq.mode || "air",
    initialAirDivisor,
  );
  const initialTotals = calculateConsignmentTotals(initialCargoItems);

  const client = useQueryClient(),
    [margin, setMargin] = useState<number>(
      rfq.form?.profit_margin_percent !== undefined
        ? Number(rfq.form.profit_margin_percent)
        : 15,
    ),
    [fixed, setFixed] = useState(rfq.form?.pricing_method === "fixed"),
    [pricingMethod, setPricingMethod] = useState<"margin" | "markup" | "fixed">(
      rfq.form?.pricing_method || "margin",
    ),
    [docFee, setDocFee] = useState<number>(
      rfq.form?.documentation_fee !== undefined ? Number(rfq.form.documentation_fee) : 50,
    ),
    [docCurrency, setDocCurrency] = useState<string>(
      rfq.form?.documentation_currency || "USD",
    ),
    [taxPercent, setTaxPercent] = useState<number>(
      rfq.form?.tax_percent !== undefined ? Number(rfq.form.tax_percent) : 0,
    ),
    [settingsApplied, setSettingsApplied] = useState(false),
    [type, setType] = useState(""),
    [price, setPrice] = useState(0),
    [currency, setCurrency] = useState(rfq.form?.quote_currency || "USD"),
    [exchangeRate, setExchangeRate] = useState(1),
    [buyRate, setBuyRate] = useState<number | null>(null),
    [ratePage, setRatePage] = useState(1),
    [cargoItems, setCargoItems] = useState<Cargo[]>(initialCargoItems),
    [airDivisor, setAirDivisor] = useState<"standard" | "express">(initialAirDivisor),
    [cargoNotes, setCargoNotes] = useState<string>(rfq.form?.cargo || ""),
    [chargeableManual, setChargeableManual] = useState<boolean>(!!rfq.form?.chargeable_weight_manual),
    [weight, setWeight] = useState(
      Number(rfq.form?.total_chargeable_weight) || initialTotals.autoChargeableWeightKg || 0,
    ),
    [volume, setVolume] = useState(
      Number(rfq.form?.total_volume) || initialTotals.totalVolumeCbm || 0,
    ),
    [lines, setLines] = useState<Row[]>(rfq.form?.quote_lines || []),
    [validity, setValidity] = useState(localDateInput(rfq.validity)),
    [reply, setReply] = useState(rfq.form?.email_draft || ""),
    [reason, setReason] = useState("price"),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false);
  const [sourceRates, setSourceRates] = useState<string[]>(rfq.form?.supplier_rate_ids || []);
  const [supplierExpiry, setSupplierExpiry] = useState<string | null>(null);
  const [procurement, setProcurement] = useState("");
  const [procurementSubject, setProcurementSubject] = useState("");
  const [procurementTo, setProcurementTo] = useState("");
  const [attachQuotePdf, setAttachQuotePdf] = useState(true);
  const emailRates = useQuery<{ items: Row[]; total: number; policy: string }>({
    queryKey: ["freight", tenantId, "rfq-supplier-rates", rfq.id],
    queryFn: () => freight.get(`/rfqs/${rfq.id}/supplier-rates`),
  });
  const rates = useQuery<Page<Row>>({
    queryKey: ["freight", tenantId, "rfq-rates", rfq.id, ratePage],
    queryFn: () =>
      freight.get<Page<Row>>(`/rfqs/${rfq.id}/rates`, {
        page: ratePage,
        limit: 10,
      }),
  });

  useEffect(() => {
    const s = commercial.data;
    if (!s || settingsApplied) return;
    if (rfq.form?.profit_margin_percent === undefined && s.default_profit_margin_percent !== undefined) {
      setMargin(Number(s.default_profit_margin_percent));
    }
    if (rfq.form?.pricing_method === undefined && s.default_pricing_method) {
      setPricingMethod(s.default_pricing_method === "markup" ? "markup" : "margin");
      setFixed(false);
    }
    if (rfq.form?.documentation_fee === undefined && s.default_documentation_fee !== undefined) {
      setDocFee(Number(s.default_documentation_fee));
    }
    if (rfq.form?.documentation_currency === undefined && s.default_documentation_currency) {
      setDocCurrency(s.default_documentation_currency);
    }
    if (rfq.form?.tax_percent === undefined && s.default_quote_tax_percent !== undefined) {
      setTaxPercent(Number(s.default_quote_tax_percent));
    }
    if (rfq.form?.quote_currency === undefined && s.default_quote_currency) {
      setCurrency(s.default_quote_currency);
      setExchangeRate(s.default_quote_currency === "USD" ? 1 : 0);
    }
    if (rfq.form?.air_divisor === undefined && s.default_air_divisor) {
      setAirDivisor(s.default_air_divisor === "express" ? "express" : "standard");
    }
    if (!rfq.validity && !validity && s.default_quote_validity_days) {
      const d = new Date();
      d.setDate(d.getDate() + Number(s.default_quote_validity_days || 14));
      setValidity(d.toISOString().slice(0, 16));
    }
    setSettingsApplied(true);
  }, [commercial.data, settingsApplied]);

  const effectiveMethod: "margin" | "markup" | "fixed" = fixed ? "fixed" : pricingMethod;
  const quotedMargin =
    buyRate !== null && price > 0 ? ((price - buyRate) * 100) / price : null;

  const cargoTotals = useMemo(() => calculateConsignmentTotals(cargoItems), [cargoItems]);

  const handleCargoChange = (nextCargo: Cargo[]) => {
    setCargoItems(nextCargo);
    const nextTotals = calculateConsignmentTotals(nextCargo);
    setVolume(nextTotals.totalVolumeCbm);
    if (!chargeableManual) {
      setWeight(nextTotals.autoChargeableWeightKg);
      setBuyRate(null);
    }
  };

  const applyMarkupToRate = (buy: number, nextMargin = margin, nextMethod = effectiveMethod) => {
    setBuyRate(buy);
    setPrice(calculateSellFromBuy(buy, nextMargin, nextMethod));
  };

  const buildFreightAndDocLines = () => {
    const schedule: ChargeType[] = chargeSchedule.data?.items || [];
    const modeFreightName =
      rfq.mode === "air" ? "Air Freight" : rfq.mode === "ocean" ? "Ocean Freight" : "Freight";
    const freightType =
      schedule.find((c: ChargeType) => c.name.toLowerCase() === modeFreightName.toLowerCase()) ||
      schedule.find((c: ChargeType) => c.name.toLowerCase().includes("freight")) ||
      schedule.find((c: ChargeType) => c.id === type) ||
      schedule[0];
    const docType =
      schedule.find((c: ChargeType) => c.name.toLowerCase().includes("documentation")) || freightType;

    if (!freightType) {
      toast.error("No charge types found in Charge Schedule. Add one in Settings first.");
      return;
    }

    const nextLines: Row[] = [
      {
        charge_type_id: freightType.id,
        side: "sell",
        quantity: 1,
        unit: "shipment",
        unit_price: Number(price) || 0,
        currency,
        exchange_rate: exchangeRate > 0 ? exchangeRate : 1,
      },
    ];
    if (docFee > 0 && docType) {
      nextLines.push({
        charge_type_id: docType.id,
        side: "sell",
        quantity: 1,
        unit: "shipment",
        unit_price: Number(docFee) || 0,
        currency: docCurrency || currency,
        exchange_rate: (docCurrency || currency) === "USD" ? 1 : exchangeRate > 0 ? exchangeRate : 1,
      });
    }
    setLines(nextLines);
    toast.success("Freight and documentation lines added to quote");
  };

  const buildQuotationDocumentSnapshot = () => {
    const schedule: ChargeType[] = chargeSchedule.data?.items || [];
    const nameMap = Object.fromEntries(schedule.map((c: ChargeType) => [c.id, c.name]));
    const docItems = lines.length
      ? lines.map((l, idx) => {
          const qtyNum = Number(l.quantity) || 1;
          const unitP = Number(l.unit_price) || 0;
          const sub = Number((qtyNum * unitP).toFixed(2));
          const tx = Number((sub * (taxPercent / 100)).toFixed(2));
          return {
            id: String(idx + 1),
            description: nameMap[l.charge_type_id] || `Freight Services (${rfq.origin} → ${rfq.destination})`,
            qty: `${qtyNum} ${l.unit || "shipment"}`,
            unit_price: unitP,
            subtotal: sub,
            tax: tx,
          };
        })
      : [
          ...(price > 0
            ? [
                {
                  id: "1",
                  description: `${(rfq.mode || "Freight").toUpperCase()} Freight (${rfq.origin} → ${rfq.destination})`,
                  qty: weight > 0 ? `${weight.toFixed(2)} kg` : volume > 0 ? `${volume.toFixed(3)} m³` : "1 Shipment",
                  unit_price: price,
                  subtotal: price,
                  tax: Number((price * (taxPercent / 100)).toFixed(2)),
                },
              ]
            : []),
          ...(docFee > 0
            ? [
                {
                  id: "2",
                  description: "Documentation Fee (AWB / B/L & Processing)",
                  qty: "1 Shipment",
                  unit_price: docFee,
                  subtotal: docFee,
                  tax: Number((docFee * (taxPercent / 100)).toFixed(2)),
                },
              ]
            : []),
        ];
    return {
      quote_number: rfq.reference,
      issue_date: new Date().toISOString().split("T")[0],
      valid_through: validity ? validity.split("T")[0] : "",
      currency,
      tax_percent: taxPercent,
      items: docItems,
      cargo_items: cargoItems,
    };
  };

  const save = async (status: string, openPreviewAfter = false) => {
    setBusy(true);
    setError(null);
    try {
      if (status === "quoted" && supplierExpiry && new Date(validity) > new Date(supplierExpiry))
        throw new Error("Customer quote validity cannot exceed the selected supplier quote validity.");
      const quotationDoc = buildQuotationDocumentSnapshot();
      await freight.patch(`/rfqs/${rfq.id}`, {
        status,
        quote_lines: lines,
        validity: validity ? new Date(validity).toISOString() : null,
        email_draft: reply,
        loss_reason: status === "lost" ? reason : "",
        supplier_rate_ids: sourceRates,
        cargo: cargoNotes || formatCargoSummaryText(cargoItems),
        cargo_items: cargoItems,
        air_divisor: airDivisor,
        total_pieces: cargoTotals.totalPieces,
        total_gross_weight: cargoTotals.totalGrossKg,
        total_volumetric_weight: cargoTotals.totalVolumetricKg,
        total_volume: volume,
        total_chargeable_weight: weight,
        chargeable_weight_manual: chargeableManual,
        documentation_fee: docFee,
        documentation_currency: docCurrency,
        profit_margin_percent: margin,
        pricing_method: effectiveMethod,
        tax_percent: taxPercent,
        quote_currency: currency,
        quotation_document: quotationDoc,
      });
      await client.invalidateQueries({ queryKey: ["freight"] });
      if (openPreviewAfter) {
        onOpenQuoteDoc(
          {
            ...(detail.data || rfq),
            validity: validity ? new Date(validity).toISOString() : rfq.validity,
            form: {
              ...(detail.data?.form || rfq.form || {}),
              cargo_items: cargoItems,
              total_chargeable_weight: weight,
              total_volume: volume,
              documentation_fee: docFee,
              tax_percent: taxPercent,
              quote_currency: currency,
              quotation_document: quotationDoc,
              quote_lines: lines,
            },
          },
          "pdf",
        );
      } else {
        close();
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title={`Quote · ${rfq.reference}`}
      action={
        <button className={secondaryClass} onClick={close}>
          Close
        </button>
      }
    >
      <ErrorBanner error={error || rates.error || emailRates.error} />

      <div className="mb-5">
        <RfqCargoEditor
          mode={rfq.mode || "air"}
          airDivisor={airDivisor}
          onAirDivisorChange={setAirDivisor}
          cargo={cargoItems}
          onChangeCargo={handleCargoChange}
          totalChargeableWeight={weight > 0 ? String(weight) : ""}
          chargeableWeightManual={chargeableManual}
          onChangeChargeableWeight={(val, manual) => {
            setChargeableManual(manual);
            setWeight(Number(val) || 0);
            setBuyRate(null);
          }}
          cargoNotes={cargoNotes}
          onChangeCargoNotes={setCargoNotes}
        />
      </div>

      <div className="mb-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <SupplierRateSuggestions
            data={emailRates.data}
            loading={emailRates.isFetching}
            canApply={(rate) =>
              !(
                (rate.unit === "kg" && weight <= 0) ||
                (rate.unit === "lb" && weight <= 0) ||
                ((rate.unit === "cbm" || rate.unit === "m3") && volume <= 0) ||
                ["container", "20gp", "40gp", "40hc"].includes(rate.unit)
              )
            }
            onApply={(rate) => {
              const qtyFactor =
                rate.unit === "kg"
                  ? weight
                  : rate.unit === "lb"
                    ? weight * LB_PER_KG
                    : rate.unit === "cbm" || rate.unit === "m3"
                      ? volume
                      : 1;
              const buy = Number((Number(rate.amount) * qtyFactor).toFixed(2));
              applyMarkupToRate(buy);
              setCurrency(rate.currency);
              setExchangeRate(rate.currency === "USD" ? 1 : 0);
              setSourceRates([rate.id]);
              setSupplierExpiry(rate.valid_until);
              if (rate.valid_until) setValidity(localDateInput(rate.valid_until));
            }}
          />
          <RateCardSuggestions
            data={rates.data}
            loading={rates.isFetching}
            canApply={(rate) => {
              const ru = String(rate.rate_unit || "").toLowerCase();
              if (ru === "per_kg" || ru === "per_lb") return weight > 0;
              if (ru === "per_m3" || ru === "per_cbm") return volume > 0;
              if (ru === "per_shipment" || ru === "per_container") return true;
              return !(
                (Number(rate.per_kg_rate_paise) > 0 && weight <= 0) ||
                (Number(rate.per_cbm_rate_paise) > 0 && volume <= 0)
              );
            }}
            onApply={(rate) => {
              const buy = calculateRateBuyAmount(rate, weight, volume);
              applyMarkupToRate(buy);
              setCurrency(rate.currency_code || "USD");
              setExchangeRate((rate.currency_code || "USD") === "USD" ? 1 : 0);
              setSourceRates([]);
              const expiry = rate.valid_until ? rate.valid_until + "T23:59:59" : null;
              setSupplierExpiry(expiry);
              if (expiry) setValidity(localDateInput(expiry));
            }}
          >
            <Pager
              page={ratePage}
              total={rates.data?.total || 0}
              limit={10}
              onChange={setRatePage}
            />
          </RateCardSuggestions>
        </div>
        <p className="mt-2 text-xs text-[#777884]">
          Enter chargeable weight or volume before applying unit rates. Your configured profit markup and documentation fee are calculated below.
        </p>
      </div>

      <div className="mb-5">
        <button
          className={secondaryClass}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await freight.patch(`/rfqs/${rfq.id}`, {
                status: "no_rate",
                quote_lines: lines,
                email_draft: reply,
                supplier_rate_ids: sourceRates,
              });
              const value = await freight.get<{ draft: string; subject?: string }>(
                `/rfqs/${rfq.id}/procurement-draft`,
              );
              setProcurement(value.draft);
              if (value.subject) setProcurementSubject(value.subject);
              await client.invalidateQueries({ queryKey: ["freight"] });
            } catch (error) {
              setError(error);
            } finally {
              setBusy(false);
            }
          }}
        >
          Flag for procurement · prepare enquiry
        </button>
        {procurement && (
          <div className="mt-3 space-y-2.5">
            <Field label="Procurement email draft">
              <textarea
                rows={9}
                className={inputClass}
                value={procurement}
                onChange={(e) => setProcurement(e.target.value)}
              />
            </Field>
            <Field label="Carrier / agent email(s) for Outlook draft (comma-separated)">
              <input
                type="text"
                className={inputClass}
                placeholder="pricing@carrier.com, rates@coloader.com"
                value={procurementTo}
                onChange={(e) => setProcurementTo(e.target.value)}
              />
            </Field>
            <div className="flex flex-wrap items-center gap-2">
              <button
                className={secondaryClass}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(procurement);
                    toast.success("Copied");
                  } catch (error) {
                    setError(error);
                  }
                }}
              >
                Copy procurement draft
              </button>
              <OutlookDraftButton
                rfqId={rfq.id}
                to={procurementTo.split(",").map((s) => s.trim()).filter(Boolean)}
                subject={procurementSubject || `Rate Enquiry · ${rfq.reference} (${rfq.origin} → ${rfq.destination})`}
                body={procurement}
                variant="secondary"
                label="Create supplier draft in Outlook"
              />
            </div>
            <p className="text-xs text-[#777884]">
              Creates a ready-to-send draft in your connected Outlook mailbox (or copy manually). Include the enquiry reference so carrier replies match automatically.
            </p>
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Profit / Margin">
              <input
                type="number"
                min="0"
                max={fixed || pricingMethod === "markup" ? undefined : 99.99}
                step="any"
                className={inputClass}
                value={margin}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setMargin(next);
                  if (buyRate !== null) {
                    setPrice(calculateSellFromBuy(buyRate, next, effectiveMethod));
                  }
                }}
              />
            </Field>
            <Field label="Calculation">
              <select
                className={inputClass}
                value={fixed ? "fixed" : pricingMethod}
                onChange={(e) => {
                  const val = e.target.value;
                  const isFixed = val === "fixed";
                  const nextMethod: "margin" | "markup" | "fixed" = isFixed
                    ? "fixed"
                    : val === "markup"
                      ? "markup"
                      : "margin";
                  setFixed(isFixed);
                  setPricingMethod(nextMethod);
                  if (buyRate !== null) {
                    setPrice(calculateSellFromBuy(buyRate, margin, nextMethod));
                  }
                }}
              >
                <option value="margin">Margin %</option>
                <option value="markup">Markup %</option>
                <option value="fixed">Fixed amount</option>
              </select>
            </Field>
            <Field label={`Doc fee (${docCurrency})`}>
              <input
                type="number"
                min="0"
                step="any"
                className={inputClass}
                value={docFee}
                onChange={(e) => setDocFee(Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="Tax %">
              <input
                type="number"
                min="0"
                max="100"
                step="any"
                className={inputClass}
                value={taxPercent}
                onChange={(e) => setTaxPercent(Number(e.target.value) || 0)}
              />
            </Field>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <Field label="Chargeable weight (kg)">
              <input
                className={inputClass}
                type="number"
                min="0"
                step="any"
                value={weight}
                onChange={(e) => {
                  setWeight(Number(e.target.value));
                  setChargeableManual(true);
                  setBuyRate(null);
                }}
              />
            </Field>
            <Field label="Volume (cbm)">
              <input
                className={inputClass}
                type="number"
                min="0"
                step="any"
                value={volume}
                onChange={(e) => {
                  setVolume(Number(e.target.value));
                  setBuyRate(null);
                }}
              />
            </Field>
          </div>

          {(buyRate !== null || price > 0 || docFee > 0) && (
            <div className="mb-4 rounded-xl border border-[#e5e3ee] bg-[#fcfbff] p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="flex items-center gap-1.5 text-[#393945]">
                  <Calculator className="h-3.5 w-3.5 text-[#7068cf]" />
                  Rate &amp; Markup Summary
                </strong>
                <button
                  type="button"
                  className={secondaryClass + " !px-2.5 !py-1 text-[11px]"}
                  onClick={buildFreightAndDocLines}
                >
                  Apply freight + doc fee to quote lines
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-y-1 text-[#606174]">
                {buyRate !== null && (
                  <>
                    <span>Buy freight cost:</span>
                    <span className="text-right font-mono">{moneyLabel(buyRate, currency)}</span>
                  </>
                )}
                <span>Sell freight ({effectiveMethod === "fixed" ? `+${margin}` : `${margin}% ${effectiveMethod}`}):</span>
                <span className="text-right font-mono font-semibold text-[#1f2029]">
                  {moneyLabel(price, currency)}
                </span>
                <span>Documentation fee:</span>
                <span className="text-right font-mono">{moneyLabel(docFee, docCurrency)}</span>
                <span className="border-t border-[#e5e3ee] pt-1 font-semibold text-[#1f2029]">
                  Estimated quote total (excl. tax):
                </span>
                <span className="border-t border-[#e5e3ee] pt-1 text-right font-mono font-bold text-[#7068cf]">
                  {moneyLabel(price + docFee, currency)}
                </span>
              </div>
            </div>
          )}

          {rates.data?.total === 0 && emailRates.data?.total === 0 && (
            <div className="rounded-xl bg-amber-50 p-4 text-xs text-amber-800">
              No matching rate contract.
              <button
                disabled={busy}
                className={`${secondaryClass} mt-3`}
                onClick={() => save("no_rate")}
              >
                Flag for procurement
              </button>
            </div>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {quotedMargin !== null &&
              quotedMargin <
                Number(commercial.data?.minimum_margin_percent ?? 10) && (
                <div
                  role="alert"
                  className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900 md:col-span-2"
                >
                  Margin {quotedMargin.toFixed(1)}% is below the{" "}
                  {commercial.data?.minimum_margin_percent ?? 10}% minimum.
                </div>
              )}
            <ChargeSelect value={type} onChange={setType} />
            <input
              aria-label="Sell price"
              className={inputClass}
              type="number"
              min="0"
              step=".01"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
            />
            <Field label="Currency">
              <input
                className={inputClass}
                maxLength={3}
                value={currency}
                onChange={(e) => {
                  setCurrency(e.target.value.toUpperCase());
                  setExchangeRate(
                    e.target.value.toUpperCase() === "USD" ? 1 : 0,
                  );
                }}
              />
            </Field>
            <Field label="USD per currency unit">
              <div className="flex gap-1.5">
                <input
                  className={inputClass}
                  type="number"
                  min="0.000001"
                  step="any"
                  value={exchangeRate}
                  disabled={currency === "USD"}
                  onChange={(e) => setExchangeRate(Number(e.target.value))}
                />
                {currency !== "USD" && currency.length === 3 && (
                  <button
                    type="button"
                    className={`${secondaryClass} shrink-0 !px-2.5 text-[11px]`}
                    onClick={async () => {
                      try {
                        const fx = await freight.get<{ usd_per_unit: Record<string, number> }>("/fx-rates");
                        const rateVal = fx.usd_per_unit?.[currency.toUpperCase()];
                        if (rateVal) {
                          setExchangeRate(rateVal);
                          toast.success(`Applied live ${currency}/USD rate (${rateVal})`);
                        } else {
                          toast.error(`No reference FX rate found for ${currency}`);
                        }
                      } catch (cause) {
                        toast.error(errorMessage(cause));
                      }
                    }}
                  >
                    Live FX
                  </button>
                )}
              </div>
            </Field>
            <button
              disabled={!type || exchangeRate <= 0 || currency.length !== 3}
              className={secondaryClass}
              onClick={() =>
                setLines([
                  ...lines,
                  {
                    charge_type_id: type,
                    side: "sell",
                    quantity: 1,
                    unit: "shipment",
                    unit_price: price,
                    currency,
                    exchange_rate: exchangeRate,
                  },
                ])
              }
            >
              Add sell line
            </button>
          </div>
          {lines.map((line, i) => {
            const cName = chargeSchedule.data?.items?.find((c: ChargeType) => c.id === line.charge_type_id)?.name;
            return (
              <div key={i} className="mt-3 flex justify-between text-xs">
                <span>
                  {cName ? `${cName} · ` : ""}
                  {line.quantity} × {moneyLabel(line.unit_price, line.currency)}
                </span>
                <button onClick={() => setLines(lines.filter((_, n) => n !== i))}>
                  Remove
                </button>
              </div>
            );
          })}
          <div className="mt-4">
            <Field label="Quote valid until">
              <input
                className={inputClass}
                type="datetime-local"
                value={validity}
                onChange={(e) => setValidity(e.target.value)}
              />
            </Field>
          </div>
        </div>
        <div>
          <ErrorBanner error={detail.error} />
          <Field label="Email draft">
            <textarea
              rows={10}
              className={inputClass}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
            />
          </Field>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className={secondaryClass}
              disabled={!lines.length || detail.isLoading}
              title={!lines.length ? "Add a quote charge line first" : undefined}
              onClick={() =>
                setReply(
                  quotationDraft(
                    (detail.data || rfq) as Parameters<typeof quotationDraft>[0],
                    lines as Parameters<typeof quotationDraft>[1],
                    validity,
                    senderName,
                  ),
                )
              }
            >
              Generate draft
            </button>
            <button
              className={secondaryClass}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(reply);
                  toast.success("Copied");
                } catch (e) {
                  toast.error(errorMessage(e));
                }
              }}
            >
              Copy
            </button>
            <button
              type="button"
              className={`${secondaryClass} !border-[#7068cf] !text-[#7068cf] hover:!bg-[#f4f2ff]`}
              onClick={() =>
                onOpenQuoteDoc(
                  {
                    ...(detail.data || rfq),
                    validity: validity ? new Date(validity).toISOString() : rfq.validity,
                    form: {
                      ...(detail.data?.form || rfq.form || {}),
                      cargo_items: cargoItems,
                      total_chargeable_weight: weight,
                      total_volume: volume,
                      documentation_fee: docFee,
                      tax_percent: taxPercent,
                      quote_currency: currency,
                      quotation_document: buildQuotationDocumentSnapshot(),
                      quote_lines: lines,
                    },
                  },
                  "pdf",
                )
              }
            >
              <Eye className="h-3.5 w-3.5" />
              Preview Quotation PDF
            </button>
            <button
              type="button"
              className={secondaryClass}
              onClick={() =>
                onOpenQuoteDoc(
                  {
                    ...(detail.data || rfq),
                    validity: validity ? new Date(validity).toISOString() : rfq.validity,
                    form: {
                      ...(detail.data?.form || rfq.form || {}),
                      cargo_items: cargoItems,
                      total_chargeable_weight: weight,
                      total_volume: volume,
                      documentation_fee: docFee,
                      tax_percent: taxPercent,
                      quote_currency: currency,
                      quotation_document: buildQuotationDocumentSnapshot(),
                      quote_lines: lines,
                    },
                  },
                  "document",
                )
              }
            >
              <FileText className="h-3.5 w-3.5" />
              Transport Price Quote Document
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-[#e8e5f4] bg-[#faf9fe] p-3">
            <OutlookDraftButton
              rfqId={rfq.id}
              body={reply}
              attachRfqQuotePdf={attachQuotePdf}
              label="Create Outlook draft (same thread)"
            />
            <label className="inline-flex items-center gap-1.5 text-xs text-[#4e4f62]">
              <input
                type="checkbox"
                checked={attachQuotePdf}
                onChange={(e) => setAttachQuotePdf(e.target.checked)}
              />
              Attach Quotation PDF
            </label>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#777884]">
            Creates a native reply draft inside the customer&apos;s exact Outlook thread (preserving subject &amp; quoted history), or copy manually.
          </p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          className={buttonClass}
          disabled={busy}
          onClick={() => save("quoted")}
        >
          Save quote
        </button>
        <p className="self-center text-xs text-[#777884]">
          Customer acceptance is detected from the email conversation and appears in Jobs to create.
        </p>
        <select
          aria-label="Loss reason"
          className={`${inputClass} max-w-48`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        >
          {["no rate", "price", "timing", "lost to competitor"].map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <button
          className={secondaryClass}
          disabled={busy}
          onClick={() => save("lost")}
        >
          Mark lost
        </button>
      </div>
    </Panel>
  );
}
