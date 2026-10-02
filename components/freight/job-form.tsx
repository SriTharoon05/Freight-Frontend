"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2, Save } from "lucide-react";
import {
  freight,
  blankCargo,
  mawbWarning,
  type Entity,
  type EntityKind,
  type Cargo,
} from "@/lib/freight";
import { useAuthStore } from "@/lib/auth-store";
import {
  EntityAutocomplete,
  ChargeSelect,
  Panel,
  Field,
  ErrorBanner,
  useDraft,
  inputClass,
  buttonClass,
  secondaryClass,
} from "./shared";
const services: Record<string, string> = {
  air: "Air Freight",
  ocean: "FCL",
  road: "Road Freight",
  rail: "Rail Freight",
  multimodal: "Multimodal",
};
export function JobForm() {
  const user = useAuthStore((s) => s.user),
    router = useRouter();
  const rfqId = useSearchParams().get("rfq");
  const draft = useDraft("new-job:" + (rfqId || ""), {
    fields: {
      mode: "air",
      service_type: "Air Freight",
      shipment_model: "Direct",
      incoterm: "FCA",
      currency: "USD",
      weight_payment: "PPD",
      other_payment: "PPD",
      declared_carriage: "NVD",
      declared_customs: "NCV",
      insurance: "XXX",
      execution_date: new Date().toISOString().slice(0, 10),
    } as Record<string, string>,
    parties: {} as Record<string, Entity | null>,
    cargo: [blankCargo()],
    containers: [] as { number: string; seal: string }[],
    charges: [] as {
      charge_type_id: string;
      amount: number;
      payment: string;
      due: string;
    }[],
    key: "",
  });
  const { fields: f, parties, cargo, containers, charges } = draft.value;
  const [saving, setSaving] = useState(false),
    [error, setError] = useState<unknown>(null);
  const rfq = useQuery({
    queryKey: ["freight", user?.tenant_id, "rfq", rfqId],
    queryFn: () => freight.get<Record<string, any>>("/rfqs/" + rfqId),
    enabled: !!rfqId,
  });
  useEffect(() => {
    if (draft.ready && rfq.data && !f.rfq_id)
      draft.setValue((v) => ({
        ...v,
        fields: {
          ...v.fields,
          rfq_id: rfqId!,
          mode: rfq.data.mode,
          service_type: services[rfq.data.mode],
          origin: rfq.data.origin,
          destination: rfq.data.destination,
        },
        parties: {
          ...v.parties,
          customer_id: rfq.data.customer,
          assigned_user_id: rfq.data.staff,
        },
      }));
  }, [draft.ready, rfq.data, rfqId, f.rfq_id]);
  const settings = useQuery({
    queryKey: ["freight", user?.tenant_id, "settings"],
    queryFn: () => freight.get<Record<string, any>>("/settings"),
  });
  useEffect(() => {
    if (draft.ready && settings.data)
      draft.setValue((v) => ({
        ...v,
        fields: {
          ...v.fields,
          handling: v.fields.handling ?? settings.data.handling ?? "",
          execution_place: v.fields.execution_place ?? settings.data.city ?? "",
        },
      }));
  }, [draft.ready, settings.data]);
  useEffect(() => {
    if (draft.ready && !draft.value.key && user)
      draft.setValue((v) => ({
        ...v,
        key: crypto.randomUUID(),
        parties: {
          ...v.parties,
          assigned_user_id: { id: user.id, name: user.full_name },
        },
      }));
  }, [draft.ready, draft.value.key, user]);
  const update = (key: string, value: string) =>
    draft.setValue((v) => ({ ...v, fields: { ...v.fields, [key]: value } }));
  const field = (
    key: string,
    label: string,
    type = "text",
    required = false,
  ) => (
    <Field key={key} label={label + (required ? " *" : "")}>
      <input
        type={type}
        className={inputClass}
        value={f[key] || ""}
        required={required}
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? ".01" : undefined}
        onChange={(e) => update(key, e.target.value)}
      />
    </Field>
  );
  const select = (key: string, label: string, options: string[]) => (
    <Field label={label}>
      <select
        className={inputClass}
        value={f[key] || options[0]}
        onChange={(e) => update(key, e.target.value)}
      >
        {options.map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
    </Field>
  );
  const party = (
    key: string,
    kind: EntityKind,
    label: string,
    required = false,
  ) => (
    <EntityAutocomplete
      kind={kind}
      label={label}
      required={required}
      value={parties[key]}
      onChange={(v) =>
        draft.setValue((old) => ({
          ...old,
          parties: { ...old.parties, [key]: v },
        }))
      }
    />
  );
  const changeCargo = (index: number, key: keyof Cargo, value: string) =>
    draft.setValue((v) => ({
      ...v,
      cargo: v.cargo.map((c, i) =>
        i === index
          ? { ...c, [key]: typeof c[key] === "number" ? Number(value) : value }
          : c,
      ),
    }));
  const weightCharge = cargo.reduce(
    (s, c) => s + c.chargeable_weight * c.rate,
    0,
  );
  const total = (payment: string) =>
    charges
      .filter((c) => c.payment === payment)
      .reduce((s, c) => s + c.amount, 0) +
    (f.weight_payment === payment
      ? weightCharge + Number(f.valuation_charge || 0)
      : 0) +
    (f.other_payment === payment ? Number(f.tax || 0) : 0);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (
      [
        "customer_id",
        "assigned_user_id",
        "shipper_contact_id",
        "consignee_contact_id",
      ].some((k) => !parties[k])
    ) {
      setError(
        new Error("Select a customer, assigned staff, shipper and consignee."),
      );
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        ...f,
        cargo,
        containers,
        waybill_charges: charges,
        idempotency_key: draft.value.key,
      };
      for (const [key, p] of Object.entries(parties)) body[key] = p?.id || null;
      for (const key of [
        "etd",
        "eta",
        "cfs_cutoff",
        "vgm_deadline",
        "free_time_expires_at",
      ])
        body[key] = f[key] ? new Date(f[key]).toISOString() : null;
      for (const key of ["tax", "valuation_charge"])
        body[key] = Number(f[key] || 0);
      const result = await freight.post<{ id: string }>("/jobs", body);
      draft.clear();
      router.push(`/shipments/${result.id}`);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };
  const warning = f.mode === "air" ? mawbWarning(f.master_number || "") : null;
  if (!draft.ready)
    return (
      <div className="animate-pulse rounded-xl bg-white p-10">
        Loading job form…
      </div>
    );
  return (
    <form onSubmit={save} className="mx-auto max-w-[1400px] space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            New {f.mode} job
          </h1>
          <p className="mt-1 text-xs text-[#858693]">
            {f.mode === "air"
              ? "House Air Waybill"
              : f.mode === "ocean"
                ? "House Bill of Lading"
                : "Transport instruction"}{" "}
            · Draft
          </p>
        </div>
        <button className={buttonClass} disabled={saving}>
          <Save size={14} />
          {saving ? "Creating…" : "Create job & document"}
        </button>
      </div>
      {draft.storageError && (
        <p role="alert" className="text-xs text-amber-700">
          {draft.storageError}
        </p>
      )}
      <ErrorBanner error={error} />
      <div className="flex flex-wrap gap-2">
        {Object.keys(services).map((mode) => (
          <button
            key={mode}
            type="button"
            className={`${secondaryClass} capitalize ${f.mode === mode ? "!border-[#7068cf] !bg-[#f4f2ff] !text-[#7068cf]" : ""}`}
            onClick={() =>
              draft.setValue((v) => ({
                ...v,
                fields: { ...v.fields, mode, service_type: services[mode] },
              }))
            }
          >
            {mode}
          </button>
        ))}
      </div>
      <Panel title="Job particulars">
        <div className="grid gap-4 md:grid-cols-3">
          {party("customer_id", "customers", "Customer", true)}
          {party("assigned_user_id", "staff", "Assigned staff", true)}
          {select(
            "service_type",
            "Service type",
            f.mode === "ocean" ? ["FCL", "LCL"] : [services[f.mode]],
          )}
          {select("shipment_model", "Shipment model", [
            "Direct",
            "Co-load",
            "Own Consolidation",
            "Back-to-Back",
            "Buyer's Consolidation",
          ])}
          {select("incoterm", "Incoterm", [
            "EXW",
            "FOB",
            "CFR",
            "CIF",
            "DAP",
            "DDP",
            "FCA",
          ])}
          {party("carrier_id", "carriers", "Carrier")}
          {["Own Consolidation", "Buyer's Consolidation"].includes(
            f.shipment_model,
          ) && field("consolidation_reference", "Consolidation reference")}
        </div>
      </Panel>
      <Panel
        title={
          f.mode === "air"
            ? "Air Waybill"
            : f.mode === "ocean"
              ? "Bill of Lading"
              : "Waybill"
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          {field(
            "master_number",
            f.mode === "air"
              ? "MAWB number"
              : f.mode === "ocean"
                ? "Master B/L number"
                : "CMR / Waybill number",
          )}
          <Field label={f.mode === "air" ? "HAWB number" : "House reference"}>
            <input className={inputClass} readOnly value="Allocated on save" />
          </Field>
          {warning && (
            <p
              role="alert"
              className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 md:col-span-2"
            >
              {warning}
            </p>
          )}
          {party("shipper_contact_id", "contacts", "Shipper", true)}
          {party("consignee_contact_id", "contacts", "Consignee", true)}
          {party("notify_contact_id", "contacts", "Notify party")}
          <Field label="Issuing agent / IATA code">
            <input
              className={inputClass}
              readOnly
              value={`${settings.data?.name || ""} ${settings.data?.iata_code || ""}`}
            />
          </Field>
        </div>
      </Panel>
      <Panel title="Routing & transport">
        <div className="grid gap-4 md:grid-cols-3">
          {field(
            "origin",
            f.mode === "air"
              ? "Airport of departure"
              : f.mode === "ocean"
                ? "Port of loading"
                : "Origin",
            "text",
            true,
          )}
          {field(
            "destination",
            f.mode === "air"
              ? "Airport of destination"
              : f.mode === "ocean"
                ? "Port of discharge"
                : "Destination",
            "text",
            true,
          )}
          {field("routing", "Requested routing")}
          {field("etd", "ETD", "datetime-local", true)}
          {field("eta", "ETA", "datetime-local", true)}
          {field(
            "free_time_expires_at",
            "Free time deadline",
            "datetime-local",
          )}
          {f.mode === "air" && field("flight_number", "Flight number")}
          {f.mode === "ocean" && (
            <>
              {field("vessel", "Vessel")}
              {field("voyage", "Voyage")}
              {field("place_of_receipt", "Place of receipt")}
              {field("place_of_delivery", "Place of delivery")}
              {field("cfs_cutoff", "CFS / CY cut-off", "datetime-local")}
              {field("vgm_deadline", "VGM deadline", "datetime-local")}
            </>
          )}
          {f.mode === "road" && (
            <>
              {field("truck_plate", "Truck plate")}
              {field("driver_name", "Driver")}
              {field("collection_address", "Collection address")}
              {field("delivery_address", "Delivery address")}
            </>
          )}
        </div>
        {f.mode === "ocean" && (
          <div className="mt-5 space-y-3">
            {containers.map((c, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-3">
                {(["number", "seal"] as const).map((key) => (
                  <Field
                    key={key}
                    label={
                      key === "number" ? "Container number" : "Seal number"
                    }
                  >
                    <input
                      className={inputClass}
                      value={c[key]}
                      required={key === "number"}
                      onChange={(e) =>
                        draft.setValue((v) => ({
                          ...v,
                          containers: v.containers.map((r, n) =>
                            n === i ? { ...r, [key]: e.target.value } : r,
                          ),
                        }))
                      }
                    />
                  </Field>
                ))}
                <button
                  type="button"
                  aria-label="Remove container"
                  onClick={() =>
                    draft.setValue((v) => ({
                      ...v,
                      containers: v.containers.filter((_, n) => n !== i),
                    }))
                  }
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className={secondaryClass}
              onClick={() =>
                draft.setValue((v) => ({
                  ...v,
                  containers: [...v.containers, { number: "", seal: "" }],
                }))
              }
            >
              <Plus size={13} />
              Container
            </button>
          </div>
        )}
      </Panel>
      <Panel
        title="Cargo particulars"
        action={
          <button
            type="button"
            className={secondaryClass}
            onClick={() =>
              draft.setValue((v) => ({
                ...v,
                cargo: [...v.cargo, blankCargo()],
              }))
            }
          >
            <Plus size={13} />
            Commodity
          </button>
        }
      >
        <div className="space-y-5">
          {cargo.map((c, i) => (
            <div key={i} className="rounded-xl border border-[#eeecf5] p-4">
              <div className="mb-3 flex justify-between text-xs font-semibold">
                <span>Commodity {i + 1}</span>
                <button
                  type="button"
                  disabled={cargo.length === 1}
                  aria-label="Remove commodity"
                  onClick={() =>
                    draft.setValue((v) => ({
                      ...v,
                      cargo: v.cargo.filter((_, n) => n !== i),
                    }))
                  }
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {(
                  [
                    ["description", "Nature & quantity of goods"],
                    ["pieces", "Pieces"],
                    ["gross_weight", "Gross weight"],
                    ["net_weight", "Net weight"],
                    ["chargeable_weight", "Chargeable weight"],
                    ["rate_class", "Rate class"],
                    ["commodity_number", "Commodity item no."],
                    ["rate", "Rate / charge"],
                    ["dimensions", "Dimensions"],
                    ["volume", "Volume (m³)"],
                    ["marks", "Marks & numbers"],
                  ] as [keyof Cargo, string][]
                )
                  .filter(
                    ([key]) =>
                      f.mode === "air" ||
                      ![
                        "chargeable_weight",
                        "rate_class",
                        "commodity_number",
                        "rate",
                      ].includes(key),
                  )
                  .map(([key, label]) => (
                    <Field key={key} label={label}>
                      <input
                        className={inputClass}
                        required={key === "description"}
                        type={typeof c[key] === "number" ? "number" : "text"}
                        min={key === "pieces" ? 1 : 0}
                        step={key === "pieces" ? "1" : "any"}
                        value={c[key]}
                        onChange={(e) => changeCargo(i, key, e.target.value)}
                      />
                    </Field>
                  ))}
                <Field label="Weight unit">
                  <select
                    className={inputClass}
                    value={c.weight_unit}
                    onChange={(e) =>
                      changeCargo(i, "weight_unit", e.target.value)
                    }
                  >
                    <option>kg</option>
                    <option>lb</option>
                  </select>
                </Field>
              </div>
              {f.mode === "air" && (
                <p className="mt-3 text-right text-xs font-semibold">
                  Total {(c.chargeable_weight * c.rate).toFixed(2)} {f.currency}
                </p>
              )}
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Charges & declarations">
        <div className="grid gap-4 md:grid-cols-3">
          {field("currency", "Currency")}
          {select("weight_payment", "Weight / valuation payment", [
            "PPD",
            "COLL",
          ])}
          {select("other_payment", "Other charges payment", ["PPD", "COLL"])}
          {f.mode === "air" && (
            <>
              {field("declared_carriage", "Declared value for carriage")}
              {field("declared_customs", "Declared value for customs")}
              {field("insurance", "Amount of insurance")}
            </>
          )}
          {field("valuation_charge", "Valuation charge", "number")}
          {field("tax", "Tax", "number")}
        </div>
        <div className="mt-4 space-y-3">
          {charges.map((c, i) => (
            <div
              key={i}
              className="grid grid-cols-2 gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto]"
            >
              <ChargeSelect
                mode={f.mode}
                value={c.charge_type_id}
                onChange={(id, type) =>
                  draft.setValue((v) => ({
                    ...v,
                    charges: v.charges.map((r, n) =>
                      n === i
                        ? {
                            ...r,
                            charge_type_id: id,
                            amount: Number(type?.default_value || 0),
                          }
                        : r,
                    ),
                  }))
                }
              />
              <input
                aria-label="Charge amount"
                className={inputClass}
                type="number"
                min="0"
                step=".01"
                value={c.amount}
                onChange={(e) =>
                  draft.setValue((v) => ({
                    ...v,
                    charges: v.charges.map((r, n) =>
                      n === i ? { ...r, amount: Number(e.target.value) } : r,
                    ),
                  }))
                }
              />
              {(["payment", "due"] as const).map((key) => (
                <select
                  key={key}
                  aria-label={key}
                  className={inputClass}
                  value={c[key]}
                  onChange={(e) =>
                    draft.setValue((v) => ({
                      ...v,
                      charges: v.charges.map((r, n) =>
                        n === i ? { ...r, [key]: e.target.value } : r,
                      ),
                    }))
                  }
                >
                  {(key === "payment"
                    ? ["PPD", "COLL"]
                    : ["agent", "carrier"]
                  ).map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              ))}
              <button
                type="button"
                aria-label="Remove charge"
                onClick={() =>
                  draft.setValue((v) => ({
                    ...v,
                    charges: v.charges.filter((_, n) => n !== i),
                  }))
                }
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className={secondaryClass}
            onClick={() =>
              draft.setValue((v) => ({
                ...v,
                charges: [
                  ...v.charges,
                  {
                    charge_type_id: "",
                    amount: 0,
                    payment: "PPD",
                    due: "agent",
                  },
                ],
              }))
            }
          >
            <Plus size={13} />
            Other charge
          </button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 rounded-xl bg-[#f4f2ff] p-4 text-sm font-semibold">
          <span>
            Total prepaid: {total("PPD").toFixed(2)} {f.currency}
          </span>
          <span>
            Total collect: {total("COLL").toFixed(2)} {f.currency}
          </span>
        </div>
      </Panel>
      <Panel title="Handling & execution">
        <div className="space-y-4">
          <Field label="Handling information">
            <textarea
              className={inputClass}
              rows={3}
              value={f.handling || ""}
              onChange={(e) => update("handling", e.target.value)}
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-3">
            {field("execution_date", "Execution date", "date")}
            {field("execution_place", "Place")}
            {field("signature", "Signature")}
          </div>
          <p className="text-[10px] leading-relaxed text-[#858693]">
            Shipper certifies that the particulars on the face hereof are
            correct and that insofar as any part of the consignment contains
            dangerous goods, such part is properly described by name and is in
            proper condition for carriage by air according to the applicable
            Dangerous Goods Regulations.
          </p>
        </div>
      </Panel>
      <Panel title="Third-party agents">
        <div className="grid gap-4 md:grid-cols-2">
          {party("co_loader_id", "third_party_agents", "Co-loader")}
          {party("origin_agent_id", "third_party_agents", "Origin agent")}
          {party(
            "destination_agent_id",
            "third_party_agents",
            "Destination agent",
          )}
          {party("customs_broker_id", "third_party_agents", "Customs broker")}
        </div>
      </Panel>
      <ErrorBanner error={error} />
      <div className="flex justify-end pb-8">
        <button className={buttonClass} disabled={saving}>
          <Save size={14} />
          {saving ? "Creating…" : "Create job & document"}
        </button>
      </div>
    </form>
  );
}
