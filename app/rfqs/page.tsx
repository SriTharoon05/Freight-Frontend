"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/shell/app-shell";
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
import {
  freight,
  type Page,
  type Entity,
  dateLabel,
  moneyLabel,
  localDateInput,
  errorMessage,
} from "@/lib/freight";
import { useAuthStore } from "@/lib/auth-store";
type Row = Record<string, any>;
const stages = ["new", "quoted", "won", "lost", "no_rate"];
export default function RfqsPage() {
  const user = useAuthStore((s) => s.user),
    client = useQueryClient(),
    [page, setPage] = useState(1),
    [status, setStatus] = useState(""),
    [mode, setMode] = useState(""),
    [kanban, setKanban] = useState(false),
    [adding, setAdding] = useState(false),
    [selected, setSelected] = useState<Row | null>(null),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false);
  const draft = useDraft("new-rfq", {
    customer: null as Entity | null,
    staff: null as Entity | null,
    mode: "ocean",
    origin: "",
    destination: "",
    etd: "",
    equipment: "",
    cargo: "",
    source_email_id: "",
  });
  const list = useQuery<Page<Row>>({
    queryKey: ["freight", user?.tenant_id, "rfqs", page, status, mode],
    queryFn: () => freight.get<Page<Row>>("/rfqs", { page, status, mode }),
  });
  const candidates = useQuery<Page<Row>>({
    queryKey: ["freight", user?.tenant_id, "rfq-email-candidates"],
    queryFn: () => freight.get<Page<Row>>("/rfq-email-candidates"),
    enabled: ["sales", "admin", "org_admin", "manager", "ops_manager"].includes(
      user?.role || "",
    ),
  });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const d = draft.value;
      await freight.post(
        d.source_email_id
          ? `/rfq-email-candidates/${d.source_email_id}`
          : "/rfqs",
        {
          customer_id: d.customer?.id,
          assigned_user_id: d.staff?.id || user?.id,
          mode: d.mode,
          origin: d.origin,
          destination: d.destination,
          etd: d.etd ? new Date(d.etd).toISOString() : null,
          equipment: d.equipment,
          cargo: d.cargo,
        },
      );
      setAdding(false);
      draft.setValue((v) => ({
        ...v,
        source_email_id: "",
        cargo: "",
        origin: "",
        destination: "",
      }));
      client.invalidateQueries({ queryKey: ["freight"] });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const card = (r: Row) => (
    <button
      key={r.id}
      className="block w-full rounded-xl border border-[#eeecf5] bg-white p-4 text-left hover:border-[#7068cf]"
      onClick={() => setSelected(r)}
    >
      <div className="flex justify-between gap-2">
        <strong className="text-xs text-[#7068cf]">{r.reference}</strong>
        <span className="text-[10px] capitalize text-[#858693]">
          {r.status.replace("_", " ")}
        </span>
      </div>
      <p className="mt-2 text-sm font-semibold">{r.customer_name}</p>
      <p className="mt-1 text-xs">
        {r.origin} → {r.destination} · {r.mode}
      </p>
      <p className="mt-3 text-[10px] text-[#858693]">ETD {dateLabel(r.etd)}</p>
      <p
        className={`mt-2 text-[10px] ${r.status === "new" && Date.now() - new Date(r.created_at).getTime() > 86400000 ? "text-red-600" : "text-[#858693]"}`}
      >
        {Math.floor((Date.now() - new Date(r.created_at).getTime()) / 86400000)}{" "}
        days · {r.assigned_name} ·{" "}
        {Math.round(Number(r.form?.confidence || 0) * 100)}% confidence
      </p>
    </button>
  );
  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex justify-between">
          <h1 className="text-2xl font-semibold">RFQ management</h1>
          <button className={buttonClass} onClick={() => setAdding(!adding)}>
            New RFQ
          </button>
        </div>
        <ErrorBanner error={error || list.error} />
        {adding && (
          <Panel title="New request">
            <form onSubmit={save} className="grid gap-4 md:grid-cols-3">
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
              <Field label="Mode">
                <select
                  className={inputClass}
                  value={draft.value.mode}
                  onChange={(e) =>
                    draft.setValue((v) => ({ ...v, mode: e.target.value }))
                  }
                >
                  {["ocean", "air", "road", "rail", "multimodal"].map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </Field>
              {(
                ["origin", "destination", "etd", "equipment", "cargo"] as const
              ).map((key) => (
                <Field
                  key={key}
                  label={
                    key === "origin"
                      ? "Origin country code"
                      : key === "destination"
                        ? "Destination country code"
                        : key.toUpperCase()
                  }
                >
                  <input
                    className={inputClass}
                    required={["origin", "destination"].includes(key)}
                    type={key === "etd" ? "datetime-local" : "text"}
                    value={draft.value[key]}
                    onChange={(e) =>
                      draft.setValue((v) => ({ ...v, [key]: e.target.value }))
                    }
                  />
                </Field>
              ))}
              <button className={buttonClass} disabled={busy}>
                Save RFQ
              </button>
            </form>
          </Panel>
        )}
        {!!candidates.data?.total && (
          <Panel title="Email RFQ candidates">
            <div className="space-y-3">
              {candidates.data.items.map((email: Row) => (
                <div
                  key={email.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-[#eeecf5] p-4"
                >
                  <div>
                    <strong className="text-xs">{email.subject}</strong>
                    <p className="mt-1 text-[10px] text-[#858693]">
                      {email.from_address} · {dateLabel(email.received_at)}
                    </p>
                  </div>
                  <button
                    className={secondaryClass}
                    onClick={async () => {
                      try {
                        const customer = email.customer_id
                          ? await freight.get<Entity>(
                              `/entities/customers/${email.customer_id}`,
                            )
                          : null;
                        draft.setValue((v) => ({
                          ...v,
                          source_email_id: email.id,
                          customer,
                          cargo: email.body.slice(0, 4000),
                        }));
                        setAdding(true);
                      } catch (e) {
                        setError(e);
                      }
                    }}
                  >
                    Create RFQ
                  </button>
                </div>
              ))}
            </div>
          </Panel>
        )}
        <div className="flex gap-3">
          <select
            aria-label="RFQ status"
            className={`${inputClass} max-w-48`}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All stages</option>
            {stages.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            aria-label="Mode"
            className={`${inputClass} max-w-48`}
            value={mode}
            onChange={(e) => {
              setMode(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All modes</option>
            {["ocean", "air", "road", "rail", "multimodal"].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
          <button className={secondaryClass} onClick={() => setKanban(!kanban)}>
            {kanban ? "List view" : "Kanban view"}
          </button>
        </div>
        {kanban ? (
          <div className="flex gap-4 overflow-auto">
            {stages.map((stage) => (
              <div
                key={stage}
                className="w-64 shrink-0 space-y-3 rounded-2xl bg-[#f4f2ff] p-3"
              >
                <h2 className="p-2 text-xs font-semibold capitalize">
                  {stage.replace("_", " ")}
                </h2>
                {list.data?.items
                  .filter((r: Row) => r.status === stage)
                  .map(card)}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {list.data?.items.map(card)}
          </div>
        )}
        <Pager
          page={page}
          total={list.data?.total || 0}
          limit={30}
          onChange={setPage}
        />
        {selected && (
          <QuoteEditor
            key={selected.id}
            rfq={selected}
            close={() => setSelected(null)}
          />
        )}
      </div>
    </AppShell>
  );
}
function QuoteEditor({ rfq, close }: { rfq: Row; close: () => void }) {
  const router = useRouter();
  const client = useQueryClient(),
    [margin, setMargin] = useState(15),
    [fixed, setFixed] = useState(false),
    [type, setType] = useState(""),
    [price, setPrice] = useState(0),
    [currency, setCurrency] = useState("USD"),
    [exchangeRate, setExchangeRate] = useState(1),
    [buyRate, setBuyRate] = useState<number | null>(null),
    [ratePage, setRatePage] = useState(1),
    [weight, setWeight] = useState(0),
    [volume, setVolume] = useState(0),
    [lines, setLines] = useState<Row[]>(rfq.form?.quote_lines || []),
    [validity, setValidity] = useState(localDateInput(rfq.validity)),
    [reply, setReply] = useState(rfq.form?.email_draft || ""),
    [reason, setReason] = useState("price"),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false);
  const rates = useQuery<Page<Row>>({
    queryKey: ["freight", "rfq-rates", rfq.id, ratePage],
    queryFn: () =>
      freight.get<Page<Row>>(`/rfqs/${rfq.id}/rates`, {
        page: ratePage,
        limit: 10,
      }),
  });
  const commercial = useQuery<Row>({
    queryKey: ["freight", "settings"],
    queryFn: () => freight.get<Row>("/settings"),
  });
  const quotedMargin =
    buyRate !== null && price > 0 ? ((price - buyRate) * 100) / price : null;
  const save = async (status: string) => {
    setBusy(true);
    setError(null);
    try {
      await freight.patch(`/rfqs/${rfq.id}`, {
        status,
        quote_lines: lines,
        validity: validity ? new Date(validity).toISOString() : null,
        email_draft: reply,
        loss_reason: status === "lost" ? reason : "",
      });
      client.invalidateQueries({ queryKey: ["freight"] });
      if (status === "won") router.push("/shipments/new?rfq=" + rfq.id);
      close();
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
      <ErrorBanner error={error || rates.error} />
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex gap-3">
            <Field label="Margin">
              <input
                type="number"
                min="0"
                className={inputClass}
                value={margin}
                onChange={(e) => setMargin(Number(e.target.value))}
              />
            </Field>
            <Field label="Calculation">
              <select
                className={inputClass}
                value={fixed ? "fixed" : "percent"}
                onChange={(e) => setFixed(e.target.value === "fixed")}
              >
                <option value="percent">Percentage</option>
                <option value="fixed">Fixed amount</option>
              </select>
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
          {rates.data?.items.map((rate: Row) => (
            <button
              key={rate.id}
              className="mb-2 mr-2 inline-block w-[calc(50%-0.5rem)] align-top rounded-xl border border-[#e5e3ef] p-4 text-left text-xs hover:border-[#7068cf]"
              onClick={() => {
                const buy =
                  (Number(rate.base_rate_paise) +
                    weight * Number(rate.per_kg_rate_paise) +
                    volume * Number(rate.per_cbm_rate_paise)) /
                  100;
                setBuyRate(buy);
                setPrice(fixed ? buy + margin : buy * (1 + margin / 100));
                setCurrency(rate.currency_code);
                setExchangeRate(rate.currency_code === "USD" ? 1 : 0);
              }}
            >
              <strong className="mb-2 block">{rate.carrier_name}</strong>Buy{" "}
              {moneyLabel(
                (Number(rate.base_rate_paise) +
                  weight * Number(rate.per_kg_rate_paise) +
                  volume * Number(rate.per_cbm_rate_paise)) /
                  100,
                rate.currency_code,
              )}{" "}
              · valid to {rate.valid_until || "open"}
              <span className="mt-2 block">
                Per kg:{" "}
                {moneyLabel(
                  Number(rate.per_kg_rate_paise) / 100,
                  rate.currency_code,
                )}{" "}
                · Per cbm:{" "}
                {moneyLabel(
                  Number(rate.per_cbm_rate_paise) / 100,
                  rate.currency_code,
                )}
              </span>
            </button>
          ))}
          {rates.data?.total === 0 && (
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
          <Pager
            page={ratePage}
            total={rates.data?.total || 0}
            limit={10}
            onChange={setRatePage}
          />
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
              <input
                className={inputClass}
                type="number"
                min="0.000001"
                step="any"
                value={exchangeRate}
                disabled={currency === "USD"}
                onChange={(e) => setExchangeRate(Number(e.target.value))}
              />
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
          {lines.map((line, i) => (
            <div key={i} className="mt-3 flex justify-between text-xs">
              <span>
                {line.quantity} × {moneyLabel(line.unit_price, line.currency)}
              </span>
              <button onClick={() => setLines(lines.filter((_, n) => n !== i))}>
                Remove
              </button>
            </div>
          ))}
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
          <Field label="Email draft">
            <textarea
              rows={10}
              className={inputClass}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
            />
          </Field>
          <div className="mt-3 flex gap-2">
            <button
              className={secondaryClass}
              onClick={() =>
                setReply(
                  `Dear ${rfq.customer_name},\n\nPlease find our quotation for ${rfq.origin} to ${rfq.destination} by ${rfq.mode}.\n${lines.map((l) => `${l.quantity} ${l.unit}: ${moneyLabel(Number(l.quantity) * Number(l.unit_price), l.currency)}`).join("\n")}\n\nValid until ${validity || "not specified"}.\n\nKind regards`,
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
            <span title="Email write endpoint is not connected">
              <button disabled className={buttonClass}>
                Send
              </button>
            </span>
          </div>
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
        <button
          className={secondaryClass}
          disabled={busy}
          onClick={() => save("won")}
        >
          Mark won
        </button>
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
