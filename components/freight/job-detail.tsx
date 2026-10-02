"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Download, Printer, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import {
  freight,
  type Job,
  type Page,
  type Entity,
  dateLabel,
  moneyLabel,
  errorMessage,
  localDateInput,
} from "@/lib/freight";
import { useAuthStore } from "@/lib/auth-store";
import { AuditPanel } from "./audit-panel";
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
} from "./shared";
const tabs = [
  "Overview",
  "Financials",
  "Audit",
  "Documents",
  "Milestones",
  "Emails",
  "Activity Log",
];
type Row = Record<string, any>;
export function JobDetail({ id }: { id: string }) {
  const user = useAuthStore((s) => s.user),
    client = useQueryClient();
  const requestedTab = useSearchParams().get("tab");
  const [tab, setTab] = useState(
      requestedTab && tabs.includes(requestedTab) ? requestedTab : "Overview",
    ),
    [error, setError] = useState<unknown>(null);
  const result = useQuery<Job>({
    queryKey: ["freight", user?.tenant_id, "job", id],
    queryFn: () => freight.get<Job>(`/jobs/${id}`),
  });
  const data = result.data;
  const refresh = () =>
    client.invalidateQueries({ queryKey: ["freight", user?.tenant_id] });
  const change = async (body: Row) => {
    try {
      await freight.patch(`/jobs/${id}`, { version: data?.version, ...body });
      refresh();
    } catch (e) {
      setError(e);
    }
  };
  if (!data)
    return (
      <>
        <ErrorBanner error={result.error} />
        <div className="p-10 text-sm text-[#858693]">
          {result.isLoading ? "Loading job…" : "Job unavailable"}
        </div>
      </>
    );
  const d = data.document_data || {},
    f = data.form || {};
  return (
    <div className="space-y-5">
      <Link href="/shipments" className="text-xs text-[#858693]">
        ← Jobs
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {data.ref_number}
          </h1>
          <p className="mt-1 text-sm text-[#858693]">
            {data.customer_name} · {data.origin} → {data.destination}
          </p>
        </div>
        <div className="flex gap-5">
          <div>
            <span className="text-[10px] font-bold text-[#858693]">ETD</span>
            <p className="text-xs font-semibold">{dateLabel(data.etd)}</p>
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#858693]">ETA</span>
            <p className="text-xs font-semibold">{dateLabel(data.eta)}</p>
          </div>
          <span className="h-fit rounded-full bg-[#f0effc] px-3 py-1.5 text-xs font-semibold text-[#7068cf]">
            {data.status.replaceAll("_", " ")}
          </span>
        </div>
      </div>
      <ErrorBanner error={error} />
      <nav className="flex overflow-x-auto border-b border-[#e5e3ee]">
        {tabs
          .filter((t) => t !== "Audit" || data.can_view_finance)
          .map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`shrink-0 border-b-2 px-5 py-3 text-xs font-semibold ${tab === t ? "border-[#7068cf] text-[#7068cf]" : "border-transparent text-[#858693]"}`}
            >
              {t}
            </button>
          ))}
      </nav>
      {tab === "Overview" && (
        <>
          {f.consolidation_reference && (
            <Consolidation id={id} reference={f.consolidation_reference} />
          )}
          <Panel title="Shipment">
            <div className="grid gap-4 md:grid-cols-4">
              {[
                ["Mode", data.transport_mode],
                ["Service", data.service_type],
                ["Model", data.shipment_model],
                ["Incoterm", f.incoterm],
                ["House reference", data.house_number],
                ["Master reference", f.master_number],
                [
                  "Flight / Vessel",
                  [f.flight_number, f.vessel, f.voyage]
                    .filter(Boolean)
                    .join(" / "),
                ],
                ["Free time deadline", dateLabel(data.free_time_expires_at)],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-[10px] text-[#858693]">{label}</p>
                  <p className="mt-1 text-xs font-medium">{value || "—"}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="Status">
                <select
                  className={inputClass}
                  value={data.status}
                  disabled={!data.version}
                  onChange={(e) => change({ status: e.target.value })}
                >
                  {[
                    "booking_confirmed",
                    "in_transit",
                    "customs_import_pending",
                    "customs_import_cleared",
                    "delivered",
                    "closed",
                    "on_hold",
                    "cancelled",
                  ].map((s) => (
                    <option key={s} value={s}>
                      {s.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </Field>
              {["admin", "org_admin", "manager", "ops_manager"].includes(
                user?.role || "",
              ) ? (
                <EntityAutocomplete
                  kind="staff"
                  label="Assigned staff"
                  value={
                    data.assigned_user_id
                      ? {
                          id: data.assigned_user_id,
                          name: data.assigned_name || "",
                        }
                      : null
                  }
                  onChange={(v) => {
                    if (v) change({ assigned_user_id: v.id });
                  }}
                />
              ) : (
                <div>
                  <span className="text-[10px] text-[#858693]">
                    Assigned staff
                  </span>
                  <p className="text-xs">{data.assigned_name || "—"}</p>
                </div>
              )}
            </div>
          </Panel>
          <Panel title="Parties">
            <div className="grid gap-4 md:grid-cols-3">
              {["shipper", "consignee", "notify"].map((key) => (
                <div
                  key={key}
                  className="rounded-xl border border-[#eeecf5] p-4"
                >
                  <p className="mb-2 text-[10px] font-bold uppercase text-[#858693]">
                    {key === "notify" ? "Notify party" : key}
                  </p>
                  <p className="text-xs font-semibold">{d[key]?.name || "—"}</p>
                  <p className="mt-2 whitespace-pre-line text-xs text-[#858693]">
                    {[
                      d[key]?.address,
                      d[key]?.city,
                      d[key]?.country,
                      d[key]?.email,
                      d[key]?.phone,
                    ]
                      .filter(Boolean)
                      .join("\n")}
                  </p>
                </div>
              ))}
              {data.third_parties?.map((p: Entity) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-[#eeecf5] p-4 text-xs"
                >
                  <strong>{p.name}</strong>
                  <p>
                    {p.city} {p.country}
                  </p>
                  <p>{p.email}</p>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Cargo">
            <div className="grid grid-cols-3 gap-4 text-sm font-semibold">
              <span>{data.package_count} packages</span>
              <span>{data.weight_kg} kg</span>
              <span>{data.volume_cbm} m³</span>
            </div>
            <p className="mt-4 text-xs text-[#858693]">
              {data.cargo_description}
            </p>
          </Panel>
          <Notes id={id} />
        </>
      )}
      {tab === "Financials" && (
        <>
          <Financials id={id} finance={!!data.can_view_finance} />
        </>
      )}
      {tab === "Documents" && <Documents id={id} />}{" "}
      {tab === "Audit" && data.can_view_finance && <AuditPanel id={id} />}
      {tab === "Milestones" && <Milestones id={id} />}{" "}
      {tab === "Emails" && <Emails id={id} job={data} />}{" "}
      {tab === "Activity Log" && <Activity id={id} />}
    </div>
  );
}
function useList(id: string, type: string, page = 1) {
  const user = useAuthStore((s) => s.user);
  return useQuery<Page<Row> & Row>({
    queryKey: ["freight", user?.tenant_id, id, type, page],
    queryFn: () =>
      freight.get<Page<Row> & Row>(`/jobs/${id}/${type}`, { page, limit: 100 }),
  });
}
function useAction() {
  const client = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  return {
    error,
    busy,
    run: async (action: () => Promise<unknown>) => {
      setBusy(true);
      setError(null);
      try {
        await action();
        await client.invalidateQueries({ queryKey: ["freight"] });
        return true;
      } catch (e) {
        setError(e);
        return false;
      } finally {
        setBusy(false);
      }
    },
  };
}
function Notes({ id }: { id: string }) {
  const [page, setPage] = useState(1),
    list = useList(id, "notes", page),
    action = useAction(),
    draft = useDraft(`note:${id}`, {
      body: "",
      parent_id: null as string | null,
    });
  return (
    <Panel title="Internal notes">
      <ErrorBanner error={list.error || action.error} />
      <div className="space-y-3">
        {list.data?.items.map((n: Row) => (
          <div
            key={n.id}
            className={`rounded-xl bg-[#f7f6fb] p-4 ${n.parent_id ? "ml-6" : ""}`}
          >
            <div className="flex justify-between text-[10px] text-[#858693]">
              <strong>{n.author}</strong>
              <span>{dateLabel(n.created_at)}</span>
            </div>
            <p className="my-2 whitespace-pre-wrap text-xs">{n.body}</p>
            <button
              className="text-[10px] text-[#7068cf]"
              onClick={() => draft.setValue((v) => ({ ...v, parent_id: n.id }))}
            >
              Reply
            </button>
          </div>
        ))}
      </div>
      <Pager
        page={page}
        total={list.data?.total || 0}
        limit={100}
        onChange={setPage}
      />
      {draft.value.parent_id && (
        <button
          className="text-xs text-[#7068cf]"
          onClick={() => draft.setValue((v) => ({ ...v, parent_id: null }))}
        >
          Reply selected · Cancel
        </button>
      )}
      <textarea
        aria-label="Internal note"
        className={`${inputClass} mt-4`}
        rows={3}
        value={draft.value.body}
        onChange={(e) =>
          draft.setValue((v) => ({ ...v, body: e.target.value }))
        }
      />
      <button
        className={`${buttonClass} mt-3`}
        disabled={action.busy || !draft.value.body.trim()}
        onClick={async () => {
          if (
            await action.run(() =>
              freight.post(`/jobs/${id}/notes`, draft.value),
            )
          )
            draft.setValue({ body: "", parent_id: null });
        }}
      >
        Add note
      </button>
    </Panel>
  );
}
function Consolidation({ id, reference }: { id: string; reference: string }) {
  const [page, setPage] = useState(1);
  const action = useAction();
  const result = useQuery<Page<Job>>({
    queryKey: ["freight", "consolidation", id, page],
    queryFn: () =>
      freight.get<Page<Job>>(`/jobs/${id}/consolidation`, { page }),
  });
  return (
    <Panel title={`Consolidation · ${reference}`}>
      <ErrorBanner error={result.error || action.error} />
      {result.data?.items.length ? (
        <form
          key={result.data.items[0].etd}
          className="mb-4 grid gap-3 md:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            const values = new FormData(e.currentTarget);
            action.run(() =>
              freight.put(`/jobs/${id}/consolidation-schedule`, {
                etd: new Date(String(values.get("etd"))).toISOString(),
                eta: new Date(String(values.get("eta"))).toISOString(),
              }),
            );
          }}
        >
          <Field label="Shared ETD">
            <input
              required
              name="etd"
              type="datetime-local"
              className={inputClass}
              defaultValue={localDateInput(result.data.items[0].etd)}
            />
          </Field>
          <Field label="Shared ETA">
            <input
              required
              name="eta"
              type="datetime-local"
              className={inputClass}
              defaultValue={localDateInput(result.data.items[0].eta)}
            />
          </Field>
          <button disabled={action.busy} className={buttonClass}>
            Update all member schedules
          </button>
        </form>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {result.data?.items.map((j: Job) => (
          <Link
            key={j.id}
            href={`/shipments/${j.id}`}
            className="rounded-xl border p-3 text-xs"
          >
            <strong>
              {j.ref_number} · {j.house_number}
            </strong>
            <p className="mt-1">{j.customer_name}</p>
            <p className="mt-2 text-[#858693]">
              ETD {dateLabel(j.etd)} · ETA {dateLabel(j.eta)}
            </p>
          </Link>
        ))}
      </div>
      <Pager
        page={page}
        total={result.data?.total || 0}
        limit={20}
        onChange={setPage}
      />
    </Panel>
  );
}
function Financials({ id, finance }: { id: string; finance: boolean }) {
  const list = useList(id, "charges"),
    action = useAction();
  const [form, setForm] = useState({
      charge_type_id: "",
      side: "sell",
      quantity: 1,
      unit: "shipment",
      unit_price: 0,
      currency: "USD",
      exchange_rate: 1,
    }),
    [vendor, setVendor] = useState<Entity | null>(null);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        {[
          ["Sell", list.data?.sell_usd],
          ...(finance
            ? [
                ["Buy", list.data?.buy_usd],
                ["Profit / Loss", list.data?.profit_usd],
              ]
            : []),
        ].map(([name, value]) => (
          <Panel key={name} title={name}>
            <strong className="text-xl">{moneyLabel(value)}</strong>
          </Panel>
        ))}
      </div>
      <Panel title="Job charges">
        {list.data?.margin_alert && (
          <div
            role="alert"
            className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"
          >
            Margin {Number(list.data.margin_percent).toFixed(1)}% is below the{" "}
            {list.data.minimum_margin_percent}% minimum.
          </div>
        )}
        <ErrorBanner error={list.error || action.error} />
        <div className="overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b text-[10px] text-[#858693]">
              <tr>
                {[
                  "Side",
                  "Charge",
                  "Quantity",
                  "Unit price",
                  "Original total",
                  "USD equivalent",
                  "",
                ].map((h) => (
                  <th className="p-3" key={h}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.data?.items.map((c: Row) => (
                <tr key={c.id} className="border-b border-[#f2f0f7]">
                  <td className="p-3 capitalize">{c.side}</td>
                  <td>{c.description}</td>
                  <td>
                    {c.quantity} {c.unit}
                  </td>
                  <td>{moneyLabel(c.unit_price, c.currency)}</td>
                  <td>{moneyLabel(c.amount, c.currency)}</td>
                  <td>{moneyLabel(c.usd_amount)}</td>
                  <td>
                    <button
                      aria-label="Remove charge"
                      disabled={action.busy}
                      onClick={() =>
                        action.run(() =>
                          freight.remove(`/jobs/${id}/charges/${c.id}`),
                        )
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form
          className="mt-5 grid gap-3 md:grid-cols-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await action.run(() =>
                freight.post(`/jobs/${id}/charges`, {
                  ...form,
                  vendor_id: vendor?.id || null,
                }),
              )
            )
              setForm((v) => ({ ...v, charge_type_id: "", unit_price: 0 }));
          }}
        >
          <Field label="Charge">
            <ChargeSelect
              value={form.charge_type_id}
              onChange={(id, c) =>
                setForm((v) => ({
                  ...v,
                  charge_type_id: id,
                  unit_price: Number(c?.default_value || 0),
                  currency: c?.currency || "USD",
                }))
              }
            />
          </Field>
          <Field label="Side">
            <select
              className={inputClass}
              value={form.side}
              onChange={(e) => setForm({ ...form, side: e.target.value })}
            >
              <option value="sell">Sell</option>
              {finance && <option value="buy">Buy</option>}
            </select>
          </Field>
          {(
            [
              "quantity",
              "unit",
              "unit_price",
              "currency",
              "exchange_rate",
            ] as const
          ).map((key) => (
            <Field key={key} label={key.replaceAll("_", " ")}>
              <input
                className={inputClass}
                type={typeof form[key] === "number" ? "number" : "text"}
                min="0"
                step="any"
                required
                value={form[key]}
                onChange={(e) =>
                  setForm({
                    ...form,
                    [key]:
                      typeof form[key] === "number"
                        ? Number(e.target.value)
                        : e.target.value,
                  })
                }
              />
            </Field>
          ))}
          <EntityAutocomplete
            kind="third_party_agents"
            label="Vendor"
            value={vendor}
            onChange={setVendor}
          />
          <button className={buttonClass} disabled={action.busy}>
            <Plus size={13} />
            Add charge
          </button>
        </form>
      </Panel>
    </div>
  );
}
function Documents({ id }: { id: string }) {
  const list = useList(id, "documents"),
    action = useAction(),
    frame = useRef<HTMLIFrameElement>(null);
  const [type, setType] = useState("invoice"),
    [selected, setSelected] = useState<Row | null>(null),
    [html, setHtml] = useState(""),
    [copy, setCopy] = useState(1),
    [edits, setEdits] = useState<Row>({});
  const preview = async (doc: Row, designation = copy) => {
    await action.run(async () => {
      if (!doc.content || Object.keys(doc.content).length === 0) {
        const response = await api.get(`/documents/${doc.id}/download`);
        const url = new URL(response.data.signed_url);
        if (!["https:", "http:"].includes(url.protocol))
          throw new Error("Invalid document URL");
        window.open(url.href, "_blank", "noopener,noreferrer");
        return;
      }
      const response = await api.get(
        `/freight/jobs/${id}/documents/${doc.id}/preview`,
        { params: { copy: designation }, responseType: "text" },
      );
      setHtml(response.data);
      setSelected(doc);
      setEdits({});
    });
  };
  const download = async (doc: Row) =>
    action.run(async () => {
      if (!doc.content || Object.keys(doc.content).length === 0) {
        const response = await api.get(`/documents/${doc.id}/download`);
        const url = new URL(response.data.signed_url);
        if (!["https:", "http:"].includes(url.protocol))
          throw new Error("Invalid document URL");
        window.open(url.href, "_blank", "noopener,noreferrer");
        return;
      }
      const response = await api.get(
        `/freight/jobs/${id}/documents/${doc.id}/pdf`,
        { params: { copy }, responseType: "blob" },
      );
      const url = URL.createObjectURL(response.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${doc.document_number}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  return (
    <div className="space-y-5">
      <Panel
        title="Documents"
        action={
          <div className="flex gap-2">
            <select
              aria-label="Document type"
              className={inputClass}
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {[
                "hawb",
                "mawb",
                "hbl",
                "mbl",
                "invoice",
                "debit_note",
                "credit_note",
                "packing_list",
                "arrival_notice",
                "delivery_order",
              ].map((t) => (
                <option key={t} value={t}>
                  {t.replaceAll("_", " ").toUpperCase()}
                </option>
              ))}
            </select>
            <button
              className={buttonClass}
              disabled={action.busy}
              onClick={() =>
                action.run(() =>
                  freight.post(`/jobs/${id}/documents`, { type }),
                )
              }
            >
              <Plus size={14} />
            </button>
          </div>
        }
      >
        <ErrorBanner error={list.error || action.error} />
        <div className="divide-y">
          {list.data?.items.map((doc: Row) => (
            <div
              key={doc.id}
              className="flex flex-wrap items-center justify-between gap-3 py-4"
            >
              <div>
                <strong className="text-xs">
                  {doc.document_number || doc.document_type}
                </strong>
                <p className="mt-1 text-[10px] capitalize text-[#858693]">
                  {doc.document_type.replaceAll("_", " ")} · {doc.status}
                </p>
              </div>
              <div className="flex gap-2">
                <button className={secondaryClass} onClick={() => preview(doc)}>
                  Preview
                </button>
                <button
                  className={secondaryClass}
                  onClick={() => download(doc)}
                >
                  <Download size={13} />
                  PDF
                </button>
                {doc.status === "draft" && (
                  <button
                    className={buttonClass}
                    disabled={action.busy}
                    onClick={() =>
                      action.run(() =>
                        freight.patch(`/jobs/${id}/documents/${doc.id}`, {
                          status: "issued",
                        }),
                      )
                    }
                  >
                    Issue
                  </button>
                )}
                {doc.document_type === "invoice" &&
                  ["issued", "sent"].includes(doc.status) && (
                    <button
                      className={secondaryClass}
                      onClick={() =>
                        action.run(() =>
                          freight.patch(`/jobs/${id}/documents/${doc.id}`, {
                            status: "paid",
                          }),
                        )
                      }
                    >
                      Mark paid
                    </button>
                  )}
              </div>
            </div>
          ))}
        </div>
      </Panel>
      {selected && (
        <Panel
          title={selected.document_number}
          action={
            <div className="flex gap-2">
              <select
                aria-label="Document copy"
                className={inputClass}
                value={copy}
                onChange={(e) => {
                  setCopy(Number(e.target.value));
                  preview(selected, Number(e.target.value));
                }}
              >
                {Array.from(
                  {
                    length: ["hawb", "mawb"].includes(selected.document_type)
                      ? 9
                      : 6,
                  },
                  (_, i) => (
                    <option key={i} value={i + 1}>
                      {["hawb", "mawb"].includes(selected.document_type) &&
                      i < 3
                        ? [
                            "Original 3 · Shipper",
                            "Original 2 · Consignee",
                            "Original 1 · Issuing carrier",
                          ][i]
                        : `${i < 3 ? "Original" : "Copy"} ${i < 3 ? i + 1 : i - 2}`}
                    </option>
                  ),
                )}
              </select>
              <button
                className={secondaryClass}
                onClick={() => {
                  frame.current?.contentWindow?.focus();
                  frame.current?.contentWindow?.print();
                }}
              >
                <Printer size={13} />
                Print
              </button>
            </div>
          }
        >
          {selected.status === "draft" && (
            <details className="mb-4">
              <summary className="cursor-pointer text-xs text-[#7068cf]">
                Edit document fields
              </summary>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {["shipper", "consignee", "notify"].map((key) => (
                  <EntityAutocomplete
                    key={key}
                    kind="contacts"
                    label={key === "notify" ? "Notify party" : key}
                    value={edits[key] ?? selected.content?.[key]}
                    onChange={(value) => setEdits({ ...edits, [key]: value })}
                  />
                ))}
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {Object.entries(selected.content || {})
                  .filter(
                    ([key, value]) =>
                      typeof value === "string" &&
                      ![
                        "job_reference",
                        "house_number",
                        "mode",
                        "service_type",
                        "shipment_model",
                      ].includes(key) &&
                      !key.endsWith("_id"),
                  )
                  .map(([key, value]) => (
                    <Field key={key} label={key.replaceAll("_", " ")}>
                      <input
                        className={inputClass}
                        value={edits[key] ?? String(value)}
                        onChange={(e) =>
                          setEdits({ ...edits, [key]: e.target.value })
                        }
                      />
                    </Field>
                  ))}
              </div>
              <div className="mt-4 space-y-4">
                {(edits.cargo ?? selected.content?.cargo ?? []).map(
                  (line: Row, index: number) => (
                    <div
                      key={index}
                      className="grid gap-3 rounded-xl border border-[#eeecf5] p-3 md:grid-cols-4"
                    >
                      {[
                        "description",
                        "pieces",
                        "gross_weight",
                        "net_weight",
                        "chargeable_weight",
                        "rate",
                        "dimensions",
                        "marks",
                        "volume",
                      ].map((key) => (
                        <Field key={key} label={key.replaceAll("_", " ")}>
                          <input
                            className={inputClass}
                            value={line[key] ?? ""}
                            type={
                              [
                                "pieces",
                                "gross_weight",
                                "net_weight",
                                "chargeable_weight",
                                "rate",
                                "volume",
                              ].includes(key)
                                ? "number"
                                : "text"
                            }
                            min="0"
                            step="any"
                            onChange={(e) =>
                              setEdits({
                                ...edits,
                                cargo: (
                                  edits.cargo ?? selected.content.cargo
                                ).map((c: Row, n: number) =>
                                  n === index
                                    ? { ...c, [key]: e.target.value }
                                    : c,
                                ),
                              })
                            }
                          />
                        </Field>
                      ))}
                    </div>
                  ),
                )}
              </div>
              {(edits.invoice_lines ?? selected.content?.invoice_lines)?.map(
                (line: Row, index: number) => (
                  <div key={index} className="mt-4 grid gap-3 md:grid-cols-4">
                    <ChargeSelect
                      value={line.charge_type_id}
                      onChange={(id, type) =>
                        setEdits({
                          ...edits,
                          invoice_lines: (
                            edits.invoice_lines ??
                            selected.content.invoice_lines
                          ).map((c: Row, n: number) =>
                            n === index
                              ? {
                                  ...c,
                                  charge_type_id: id,
                                  description: type?.name || "",
                                }
                              : c,
                          ),
                        })
                      }
                    />
                    {["quantity", "unit_price", "exchange_rate"].map((key) => (
                      <Field key={key} label={key.replaceAll("_", " ")}>
                        <input
                          className={inputClass}
                          type="number"
                          min="0"
                          step="any"
                          value={line[key]}
                          onChange={(e) =>
                            setEdits({
                              ...edits,
                              invoice_lines: (
                                edits.invoice_lines ??
                                selected.content.invoice_lines
                              ).map((c: Row, n: number) =>
                                n === index
                                  ? { ...c, [key]: e.target.value }
                                  : c,
                              ),
                            })
                          }
                        />
                      </Field>
                    ))}
                  </div>
                ),
              )}
              <button
                className={`${buttonClass} mt-3`}
                disabled={action.busy}
                onClick={async () => {
                  let updated: Row | undefined;
                  if (
                    await action.run(async () => {
                      updated = await freight.patch<Row>(
                        `/jobs/${id}/documents/${selected.id}`,
                        { status: "draft", overrides: edits },
                      );
                    })
                  )
                    preview(updated!);
                }}
              >
                Save draft
              </button>
            </details>
          )}
          <iframe
            title="Document preview"
            ref={frame}
            srcDoc={html}
            sandbox="allow-same-origin allow-modals"
            className="h-[850px] w-full border bg-white"
          />
        </Panel>
      )}
    </div>
  );
}
function Milestones({ id }: { id: string }) {
  const list = useList(id, "milestones"),
    action = useAction(),
    [edit, setEdit] = useState<Row | null>(null);
  const values = list.data?.items || [],
    current = values.reduce(
      (last: number, m: Row, i: number) => (m.occurred_at ? i + 1 : last),
      0,
    );
  return (
    <Panel title="Shipment milestones">
      <ErrorBanner error={list.error || action.error} />
      <div className="mb-5 flex gap-8 text-xs">
        <span>
          ETD <strong>{dateLabel(list.data?.etd)}</strong>
        </span>
        <span>
          ETA <strong>{dateLabel(list.data?.eta)}</strong>
        </span>
      </div>
      <div className="flex overflow-x-auto py-6">
        {values.map((m: Row, i: number) => {
          const overdue =
            !m.occurred_at &&
            m.planned_at &&
            new Date(m.planned_at) < new Date();
          return (
            <button
              key={m.id}
              className="relative w-40 shrink-0 px-3 text-left"
              onClick={() =>
                setEdit({
                  ...m,
                  planned_at: localDateInput(m.planned_at),
                  actual_at: localDateInput(m.occurred_at),
                  notes: m.description || "",
                })
              }
            >
              <div className="absolute left-6 right-0 top-2 h-px bg-[#e5e3ee]" />
              <div
                className={`relative mb-3 h-4 w-4 rounded-full border-2 ${m.occurred_at ? "border-emerald-500 bg-emerald-500" : overdue ? "border-red-500 bg-red-500" : i === current ? "animate-pulse border-amber-400 bg-amber-400" : "border-[#cbc8da] bg-white"}`}
              />
              <strong className="block text-[11px]">{m.event_type}</strong>
              <span className="mt-2 block text-[10px] text-[#858693]">
                {dateLabel(m.occurred_at || m.planned_at)}
              </span>
            </button>
          );
        })}
      </div>
      {edit && (
        <form
          className="mt-4 grid gap-4 rounded-xl bg-[#f7f6fb] p-4 md:grid-cols-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await action.run(() =>
                freight.patch(`/jobs/${id}/milestones/${edit.id}`, {
                  planned_at: edit.planned_at
                    ? new Date(edit.planned_at).toISOString()
                    : null,
                  actual_at: edit.actual_at
                    ? new Date(edit.actual_at).toISOString()
                    : null,
                  notes: edit.notes,
                }),
              )
            )
              setEdit(null);
          }}
        >
          <h3 className="text-xs font-semibold md:col-span-3">
            {edit.event_type}
          </h3>
          {["planned_at", "actual_at"].map((key) => (
            <Field key={key} label={key.replace("_", " ")}>
              <input
                className={inputClass}
                type="datetime-local"
                value={edit[key]}
                onChange={(e) => setEdit({ ...edit, [key]: e.target.value })}
              />
            </Field>
          ))}
          <Field label="Notes">
            <input
              className={inputClass}
              value={edit.notes}
              onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
            />
          </Field>
          <button className={buttonClass} disabled={action.busy}>
            Save milestone
          </button>
        </form>
      )}
    </Panel>
  );
}
function Emails({ id, job }: { id: string; job: Job }) {
  const [page, setPage] = useState(1),
    list = useList(id, "emails", page),
    milestones = useList(id, "milestones"),
    action = useAction(),
    draft = useDraft(`reply:${id}`, "");
  return (
    <Panel title="Email conversation">
      <ErrorBanner error={list.error || action.error} />
      <div className="space-y-4">
        {list.data?.items.map((e: Row) => (
          <article
            key={e.id}
            className="rounded-xl border border-[#eeecf5] p-4"
          >
            {e.escalation && (
              <p className="mb-3 rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-700">
                Customer escalation
              </p>
            )}
            {e.review_required && (
              <p className="mb-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                Email analysis requires review ·{" "}
                {e.analysis_method === "rules_fallback"
                  ? "AI service unavailable"
                  : "Low confidence"}
              </p>
            )}
            <div className="flex justify-between text-[10px] text-[#858693]">
              <span>
                {e.direction} · {e.from}
              </span>
              <span>{dateLabel(e.received_at)}</span>
            </div>
            <h3 className="my-2 text-xs font-semibold">{e.subject}</h3>
            <p className="whitespace-pre-wrap text-xs leading-relaxed">
              {e.body}
            </p>
            {e.suggestions?.map((label: string) => {
              const m = milestones.data?.items.find(
                (m: Row) => m.event_type === label,
              );
              return m && !m.occurred_at ? (
                <button
                  key={label}
                  className={`${secondaryClass} mt-3`}
                  disabled={action.busy}
                  onClick={() =>
                    action.run(() =>
                      freight.patch(`/jobs/${id}/milestones/${m.id}`, {
                        planned_at: m.planned_at,
                        actual_at: e.received_at,
                        notes: `Confirmed from email: ${e.subject}`,
                      }),
                    )
                  }
                >
                  Confirm {label}
                </button>
              ) : null;
            })}
          </article>
        ))}
      </div>
      {list.data?.total === 0 && (
        <p className="py-5 text-xs text-[#858693]">
          No email linked to {job.ref_number}.
        </p>
      )}
      <Pager
        page={page}
        total={list.data?.total || 0}
        limit={100}
        onChange={setPage}
      />
      <Field label="Draft reply">
        <textarea
          className={inputClass}
          rows={8}
          value={draft.value}
          onChange={(e) => draft.setValue(e.target.value)}
        />
      </Field>
      <div className="mt-3 flex gap-2">
        <button
          className={secondaryClass}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(draft.value);
              toast.success("Copied");
            } catch (e) {
              toast.error(errorMessage(e));
            }
          }}
        >
          <Copy size={13} />
          Copy
        </button>
        <span title="Email write endpoint is not connected">
          <button disabled className={buttonClass}>
            Send
          </button>
        </span>
      </div>
    </Panel>
  );
}
function Activity({ id }: { id: string }) {
  const [page, setPage] = useState(1),
    list = useList(id, "activity", page);
  return (
    <Panel title="Activity log">
      <ErrorBanner error={list.error} />
      <div className="divide-y">
        {list.data?.items.map((a: Row) => (
          <div key={a.id} className="py-4">
            <div className="flex justify-between text-xs">
              <strong>{a.action.replaceAll("_", " ")}</strong>
              <span className="text-[10px] text-[#858693]">
                {a.author} · {dateLabel(a.changed_at)}
              </span>
            </div>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              {[
                ["Before", a.old_values],
                ["After", a.new_values],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-[#f7f6fb] p-3">
                  <p className="text-[10px] text-[#858693]">{label}</p>
                  <pre className="mt-1 overflow-auto whitespace-pre-wrap text-[11px]">
                    {value ? JSON.stringify(value, null, 2) : "—"}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <Pager
        page={page}
        total={list.data?.total || 0}
        limit={100}
        onChange={setPage}
      />
    </Panel>
  );
}
