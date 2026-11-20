"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Save, RotateCcw, FileText } from "lucide-react";
import {
  freight,
  blankCargo,
  blankDimensionItem,
  calcDimensionItem,
  formatDimensions,
  parseDimensionsString,
  mawbWarning,
  localDateInput,
  type Job,
  type Entity,
  type EntityKind,
  type Cargo,
  type DimensionItem,
} from "@/lib/freight";
import { useAuthStore } from "@/lib/auth-store";
import { LocationAutocomplete } from "./location-autocomplete";
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
  const params = useSearchParams();
  const editId = params.get("edit");
  const savedId = params.get("draft");
  const requestedRfqId = params.get("rfq");
  const requestedConversationId = params.get("conversation");
  const client = useQueryClient();
  const isBrandNewJob = !editId && !savedId && !requestedConversationId && !requestedRfqId;
  const draft = useDraft(
    "new-job:" + (editId || savedId || requestedConversationId || requestedRfqId || ""),
    {
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
        bl_type: "original",
        total_chargeable_weight: "",
        chargeable_weight_manual: "false",
        air_divisor: "standard",
      } as Record<string, string>,
      parties: {} as Record<string, Entity | null>,
      cargo: [blankCargo()],
      containers: [] as { number: string; seal: string }[],
      charges: [] as {
        charge_type_id: string;
        name?: string;
        amount: number;
        payment: string;
        due: string;
      }[],
      key: "",
      savedId: "",
      savedVersion: 0,
      loadedFrom: "",
      jobVersion: 0,
    },
    { autoRestore: !isBrandNewJob },
  );
  const rfqId = requestedRfqId || draft.value.fields.rfq_id || null;
  const conversationId = requestedConversationId || draft.value.fields.source_conversation_id || null;
  const { fields: f, parties, cargo, containers, charges } = draft.value;
  const { ready: draftReady, setValue: setDraftValue } = draft;
  const formReady = draftReady && (!(editId || savedId) || draft.value.loadedFrom === (editId || savedId));
  const draftKey = draft.value.key;
  const [saving, setSaving] = useState(false),
    [error, setError] = useState<unknown>(null),
    [savedMessage, setSavedMessage] = useState("");
  const existing = useQuery<Job & { parties: Record<string, Entity | null> }>({
    queryKey: ["freight", user?.tenant_id, "job", editId],
    queryFn: () => freight.get("/jobs/" + editId),
    enabled: !!editId && !!user,
  });
  const saved = useQuery<{ form: typeof draft.value; version: number; shipment_id: string | null }>({
    queryKey: ["freight", user?.tenant_id, "job-draft", savedId],
    queryFn: () => freight.get("/job-drafts/" + savedId),
    enabled: !!savedId && !!user && !editId,
  });
  useEffect(() => {
    if (!draftReady || draft.value.loadedFrom === (editId || savedId)) return;
    if (editId && existing.data?.form) {
      const form = existing.data.form;
      const fields = Object.fromEntries(Object.entries(form).filter(([key, value]) =>
        !["cargo", "containers", "waybill_charges", "idempotency_key", "draft_id"].includes(key)
        && !key.endsWith("_id") && value !== null,
      ).map(([key, value]) => [key, String(value)]));
      for (const key of ["rfq_id", "source_conversation_id"])
        if (form[key]) fields[key] = form[key];
      for (const key of ["etd", "eta", "cfs_cutoff", "vgm_deadline", "free_time_expires_at"])
        fields[key] = localDateInput(form[key]);
      const mappedCargo = (form.cargo || []).map((line: any) => {
        let dimension_items: DimensionItem[] = [];
        if (Array.isArray(line.dimension_items) && line.dimension_items.length > 0) {
          dimension_items = line.dimension_items.map((dim: any) => {
            const d: DimensionItem = {
              pieces: Math.max(1, Number(dim.pieces) || 1),
              length: Math.max(0, Number(dim.length) || 0),
              width: Math.max(0, Number(dim.width) || 0),
              height: Math.max(0, Number(dim.height) || 0),
              unit: dim.unit === "m" || dim.unit === "in" ? dim.unit : "cm",
              gross_weight: Math.max(0, Number(dim.gross_weight) || 0),
              volume: Math.max(0, Number(dim.volume) || 0),
              volumetric_weight: Math.max(0, Number(dim.volumetric_weight) || 0),
            };
            const calc = calcDimensionItem(
              d,
              form.mode || "air",
              form.air_divisor === "express" ? "express" : "standard",
            );
            d.volume = d.volume || calc.volume;
            d.volumetric_weight = d.volumetric_weight || calc.volumetric_weight;
            return d;
          });
        } else {
          dimension_items = parseDimensionsString(
            line.dimensions || "",
            Number(line.pieces) || 1,
            Number(line.gross_weight) || 0,
            form.mode || "air",
          );
        }
        const totPieces = dimension_items.reduce((s, d) => s + (d.pieces || 0), 0) || Number(line.pieces) || 1;
        const totGross = dimension_items.reduce((s, d) => s + (d.gross_weight || 0), 0) || Number(line.gross_weight) || 0;
        const totVol = dimension_items.reduce((s, d) => s + (d.volume || 0), 0) || Number(line.volume) || 0;
        const totVolWeight = dimension_items.reduce((s, d) => s + (d.volumetric_weight || 0), 0) || Number(line.volumetric_weight) || 0;
        return {
          ...line,
          ...Object.fromEntries(
            ["pieces", "gross_weight", "net_weight", "chargeable_weight", "rate", "volume"].map(
              (key) => [key, Number(line[key] || 0)],
            ),
          ),
          pieces: totPieces,
          gross_weight: totGross,
          volume: totVol,
          volumetric_weight: totVolWeight,
          dimensions: line.dimensions || formatDimensions(dimension_items),
          dimension_items,
        };
      });
      setDraftValue((value) => ({ ...value, fields, parties: existing.data.parties,
        cargo: mappedCargo, containers: form.containers || [],
        charges: (form.waybill_charges || []).map((charge: { amount: number }) => ({ ...charge, amount: Number(charge.amount) })),
        key: form.idempotency_key, savedId: form.draft_id || "", loadedFrom: editId, jobVersion: existing.data.version,
      }));
    } else if (savedId && saved.data) {
      if (saved.data.shipment_id) {
        router.replace("/shipments/" + saved.data.shipment_id);
        return;
      }
      setDraftValue((value) => ({ ...value, ...saved.data.form, savedId,
        savedVersion: saved.data.version, loadedFrom: savedId,
      }));
    }
  }, [draftReady, editId, savedId, existing.data, saved.data, draft.value.loadedFrom, setDraftValue, router]);
  const rfq = useQuery({
    queryKey: ["freight", user?.tenant_id, "rfq", rfqId],
    queryFn: () => freight.get<Record<string, any>>("/rfqs/" + rfqId),
    enabled: !!rfqId && !!user && !editId,
  });
  const source = useQuery<{
    subject: string;
    body: string;
    workflow: string;
    customer: Entity | null;
    triage_reason: string;
    cargo?: string;
    bill_review_required?: boolean;
  }>({
    queryKey: ["freight", user?.tenant_id, "mail-job-context", conversationId],
    queryFn: ({ signal }) =>
      freight.get(
        "/email-requests/" + conversationId + "/context",
        undefined,
        signal,
      ),
    enabled: !!conversationId && !!user && !editId,
  });
  useEffect(() => {
    if (
      formReady &&
      source.data &&
      conversationId &&
      !f.source_conversation_id
    )
      setDraftValue((value) => ({
        ...value,
        fields: { ...value.fields, source_conversation_id: conversationId },
        parties: {
          ...value.parties,
          customer_id: value.parties.customer_id || source.data.customer,
        },
      }));
  }, [
    formReady,
    source.data,
    conversationId,
    f.source_conversation_id,
    setDraftValue,
  ]);
  useEffect(() => {
    if (!editId && formReady && rfqId && rfq.data && !f.rfq_id)
      setDraftValue((v) => {
        const rfqCargoItems = Array.isArray(rfq.data.form?.cargo_items) && rfq.data.form.cargo_items.length > 0
          ? rfq.data.form.cargo_items.map((line: any) => ({
              ...blankCargo(),
              ...line,
              pieces: Number(line.pieces) || 1,
              gross_weight: Number(line.gross_weight) || 0,
              net_weight: Number(line.net_weight) || 0,
              chargeable_weight: Number(line.chargeable_weight) || 0,
              volume: Number(line.volume) || 0,
              volumetric_weight: Number(line.volumetric_weight) || 0,
              dimension_items: Array.isArray(line.dimension_items) && line.dimension_items.length > 0
                ? line.dimension_items
                : [blankDimensionItem()],
            }))
          : v.cargo.map((line, index) => index === 0 && !line.description && rfq.data.form?.cargo
              ? { ...line, description: rfq.data.form.cargo } : line);
        return {
          ...v,
          fields: {
            ...v.fields,
            rfq_id: rfqId!,
            mode: rfq.data.mode,
            service_type: services[rfq.data.mode],
            origin: rfq.data.origin,
            destination: rfq.data.destination,
            etd: v.fields.etd || localDateInput(rfq.data.etd),
            air_divisor: rfq.data.form?.air_divisor === "express" ? "express" : v.fields.air_divisor || "standard",
            total_chargeable_weight: rfq.data.form?.total_chargeable_weight
              ? String(rfq.data.form.total_chargeable_weight)
              : v.fields.total_chargeable_weight,
            chargeable_weight_manual: rfq.data.form?.chargeable_weight_manual ? "true" : "false",
          },
          parties: {
            ...v.parties,
            customer_id: rfq.data.customer,
          },
          cargo: rfqCargoItems,
        };
      });
  }, [editId, formReady, setDraftValue, rfq.data, rfqId, f.rfq_id]);
  const settings = useQuery({
    queryKey: ["freight", user?.tenant_id, "settings"],
    queryFn: () => freight.get<Record<string, any>>("/settings"),
  });
  useEffect(() => {
    if (formReady && settings.data)
      setDraftValue((v) => ({
        ...v,
        fields: {
          ...v.fields,
          handling: v.fields.handling ?? settings.data.handling ?? "",
          execution_place: v.fields.execution_place ?? settings.data.city ?? "",
          signature: v.fields.signature ?? user?.full_name ?? settings.data.signature ?? "",
        },
      }));
  }, [formReady, setDraftValue, settings.data, user?.full_name]);
  useEffect(() => {
    if (formReady && !draftKey && user)
      setDraftValue((v) => ({
        ...v,
        key: crypto.randomUUID(),
        parties: {
          ...v.parties,
          assigned_user_id: v.parties.assigned_user_id ?? {
            id: user.id,
            name: user.full_name,
          },
        },
      }));
  }, [formReady, setDraftValue, draftKey, user]);
  const recalculateCommodityTotals = (
    c: Cargo,
    dimensionItems: DimensionItem[],
    mode: string,
    divisorType: "standard" | "express" = "standard",
  ): Cargo => {
    const updatedDims = dimensionItems.map((dim) => {
      const calc = calcDimensionItem(dim, mode, divisorType);
      const volWeight =
        dim.volumetric_weight !== undefined &&
        dim.volumetric_weight !== null &&
        !isNaN(dim.volumetric_weight) &&
        dim.volumetric_weight > 0
          ? dim.volumetric_weight
          : calc.volumetric_weight;
      return {
        ...dim,
        volume: calc.volume,
        volumetric_weight: volWeight,
      };
    });

    const totPieces = updatedDims.reduce(
      (s, d) => s + (Number(d.pieces) || 0),
      0,
    );
    const totGross = Number(
      updatedDims
        .reduce((s, d) => s + (Number(d.gross_weight) || 0), 0)
        .toFixed(2),
    );
    const totVol = Number(
      updatedDims
        .reduce((s, d) => s + (Number(d.volume) || 0), 0)
        .toFixed(4),
    );
    const totVolWeight = Number(
      updatedDims
        .reduce((s, d) => s + (Number(d.volumetric_weight) || 0), 0)
        .toFixed(2),
    );
    const autoCW = Math.max(totGross, totVolWeight);

    return {
      ...c,
      dimension_items: updatedDims,
      pieces: totPieces > 0 ? totPieces : c.pieces || 1,
      gross_weight: totGross,
      volume: totVol,
      volumetric_weight: totVolWeight,
      dimensions: formatDimensions(updatedDims),
      chargeable_weight: autoCW,
    };
  };

  const syncConsignmentTotals = (
    v: typeof draft.value,
    newCargoList: Cargo[],
  ): typeof draft.value => {
    const totGross = newCargoList.reduce(
      (s, c) => s + (Number(c.gross_weight) || 0),
      0,
    );
    const totVolWeight = newCargoList.reduce(
      (s, c) => s + (Number(c.volumetric_weight) || 0),
      0,
    );
    const autoCW = Math.max(totGross, totVolWeight);

    const isManual = v.fields.chargeable_weight_manual === "true";
    const totalCW =
      isManual && v.fields.total_chargeable_weight !== ""
        ? Number(v.fields.total_chargeable_weight)
        : autoCW;

    const syncedCargo = newCargoList.map((c) => {
      if (newCargoList.length === 1) {
        return { ...c, chargeable_weight: totalCW };
      }
      if (autoCW > 0) {
        const ratio =
          Math.max(Number(c.gross_weight) || 0, Number(c.volumetric_weight) || 0) /
          autoCW;
        return { ...c, chargeable_weight: Number((ratio * totalCW).toFixed(2)) };
      }
      return {
        ...c,
        chargeable_weight: Number((totalCW / newCargoList.length).toFixed(2)),
      };
    });

    return {
      ...v,
      fields: {
        ...v.fields,
        total_chargeable_weight: isManual
          ? v.fields.total_chargeable_weight
          : autoCW > 0
            ? autoCW.toFixed(2)
            : "",
      },
      cargo: syncedCargo,
    };
  };

  const update = (key: string, value: string) => {
    if (key === "mode") {
      draft.setValue((v) => {
        const recomputedCargo = v.cargo.map((c) => {
          const dims =
            c.dimension_items && c.dimension_items.length > 0
              ? c.dimension_items
              : [blankDimensionItem()];
          return recalculateCommodityTotals(
            c,
            dims,
            value,
            (v.fields.air_divisor as "standard" | "express") || "standard",
          );
        });
        const updated = {
          ...v,
          fields: {
            ...v.fields,
            mode: value,
            service_type: services[value] || v.fields.service_type,
          },
          cargo: recomputedCargo,
        };
        return syncConsignmentTotals(updated, recomputedCargo);
      });
      return;
    }
    if (key === "air_divisor") {
      draft.setValue((v) => {
        const updated = {
          ...v,
          fields: { ...v.fields, air_divisor: value },
        };
        const recomputedCargo = v.cargo.map((c) => {
          const dims =
            c.dimension_items && c.dimension_items.length > 0
              ? c.dimension_items
              : [blankDimensionItem()];
          return recalculateCommodityTotals(
            c,
            dims,
            v.fields.mode,
            value as "standard" | "express",
          );
        });
        return syncConsignmentTotals(updated, recomputedCargo);
      });
      return;
    }
    draft.setValue((v) => ({ ...v, fields: { ...v.fields, [key]: value } }));
  };

  const addDimension = (commodityIndex: number) => {
    draft.setValue((v) => {
      const target = v.cargo[commodityIndex];
      const currentDims =
        target.dimension_items && target.dimension_items.length > 0
          ? target.dimension_items
          : [blankDimensionItem()];
      const nextDims = [...currentDims, blankDimensionItem()];
      const updatedCargo = recalculateCommodityTotals(
        target,
        nextDims,
        v.fields.mode,
        (v.fields.air_divisor as "standard" | "express") || "standard",
      );
      const newCargoList = v.cargo.map((c, i) =>
        i === commodityIndex ? updatedCargo : c,
      );
      return syncConsignmentTotals(v, newCargoList);
    });
  };

  const removeDimension = (
    commodityIndex: number,
    dimensionIndex: number,
  ) => {
    draft.setValue((v) => {
      const target = v.cargo[commodityIndex];
      if (!target.dimension_items || target.dimension_items.length <= 1)
        return v;
      const nextDims = target.dimension_items.filter(
        (_, idx) => idx !== dimensionIndex,
      );
      const updatedCargo = recalculateCommodityTotals(
        target,
        nextDims,
        v.fields.mode,
        (v.fields.air_divisor as "standard" | "express") || "standard",
      );
      const newCargoList = v.cargo.map((c, i) =>
        i === commodityIndex ? updatedCargo : c,
      );
      return syncConsignmentTotals(v, newCargoList);
    });
  };

  const changeDimension = (
    commodityIndex: number,
    dimensionIndex: number,
    key: keyof DimensionItem,
    value: any,
  ) => {
    draft.setValue((v) => {
      const target = v.cargo[commodityIndex];
      const currentDims =
        target.dimension_items && target.dimension_items.length > 0
          ? [...target.dimension_items]
          : [blankDimensionItem()];

      const current = currentDims[dimensionIndex] || blankDimensionItem();
      const updatedDim: DimensionItem = {
        ...current,
        [key]: [
          "pieces",
          "length",
          "width",
          "height",
          "gross_weight",
          "volumetric_weight",
        ].includes(key)
          ? Math.max(0, Number(value) || 0)
          : value,
      };
      if (key === "pieces") {
        updatedDim.pieces = Math.max(1, Number(value) || 1);
      }
      if (["length", "width", "height", "unit", "pieces"].includes(key)) {
        const calc = calcDimensionItem(
          updatedDim,
          v.fields.mode,
          (v.fields.air_divisor as "standard" | "express") || "standard",
        );
        updatedDim.volume = calc.volume;
        updatedDim.volumetric_weight = calc.volumetric_weight;
      }
      currentDims[dimensionIndex] = updatedDim;

      const updatedCargo = recalculateCommodityTotals(
        target,
        currentDims,
        v.fields.mode,
        (v.fields.air_divisor as "standard" | "express") || "standard",
      );
      const newCargoList = v.cargo.map((c, i) =>
        i === commodityIndex ? updatedCargo : c,
      );
      return syncConsignmentTotals(v, newCargoList);
    });
  };

  const handleChargeableWeightInputChange = (val: string) => {
    draft.setValue((v) => {
      const numVal = Number(val);
      const newCargo = v.cargo.map((c) => {
        if (v.cargo.length === 1) {
          return { ...c, chargeable_weight: numVal || 0 };
        }
        const totGross = v.cargo.reduce(
          (s, item) => s + (Number(item.gross_weight) || 0),
          0,
        );
        const totVolWeight = v.cargo.reduce(
          (s, item) => s + (Number(item.volumetric_weight) || 0),
          0,
        );
        const autoCW = Math.max(totGross, totVolWeight);
        if (autoCW > 0) {
          const ratio =
            Math.max(
              Number(c.gross_weight) || 0,
              Number(c.volumetric_weight) || 0,
            ) / autoCW;
          return {
            ...c,
            chargeable_weight: Number((ratio * (numVal || 0)).toFixed(2)),
          };
        }
        return {
          ...c,
          chargeable_weight: Number(
            ((numVal || 0) / v.cargo.length).toFixed(2),
          ),
        };
      });

      return {
        ...v,
        fields: {
          ...v.fields,
          total_chargeable_weight: val,
          chargeable_weight_manual: "true",
        },
        cargo: newCargo,
      };
    });
  };

  const resetToAutoChargeable = () => {
    draft.setValue((v) => {
      const totGross = v.cargo.reduce(
        (s, c) => s + (Number(c.gross_weight) || 0),
        0,
      );
      const totVolWeight = v.cargo.reduce(
        (s, c) => s + (Number(c.volumetric_weight) || 0),
        0,
      );
      const autoCW = Math.max(totGross, totVolWeight);

      const newCargo = v.cargo.map((c) => {
        if (v.cargo.length === 1) {
          return { ...c, chargeable_weight: autoCW };
        }
        if (autoCW > 0) {
          const ratio =
            Math.max(
              Number(c.gross_weight) || 0,
              Number(c.volumetric_weight) || 0,
            ) / autoCW;
          return {
            ...c,
            chargeable_weight: Number((ratio * autoCW).toFixed(2)),
          };
        }
        return { ...c, chargeable_weight: 0 };
      });

      return {
        ...v,
        fields: {
          ...v.fields,
          total_chargeable_weight: autoCW > 0 ? autoCW.toFixed(2) : "",
          chargeable_weight_manual: "false",
        },
        cargo: newCargo,
      };
    });
  };
  const field = (
    key: string,
    label: string,
    type = "text",
    required = false,
  ) => (
    <Field key={key} label={label + (required ? " *" : "")}>
      {key.includes("address") ? (
        <textarea
          rows={3}
          className={`${inputClass} resize-y min-h-[72px]`}
          value={f[key] || ""}
          required={required}
          onChange={(e) => update(key, e.target.value)}
        />
      ) : (
        <input
          type={type}
          className={inputClass}
          value={f[key] || ""}
          required={required}
          min={type === "number" ? "0" : undefined}
          step={type === "number" ? ".01" : undefined}
          onChange={(e) => update(key, e.target.value)}
          readOnly={
            !!editId &&
            !!f.consolidation_reference &&
            [
              "origin",
              "destination",
              "master_number",
              "flight_number",
              "vessel",
              "voyage",
              "etd",
              "eta",
            ].includes(key)
          }
        />
      )}
    </Field>
  );
  const select = (key: string, label: string, options: string[]) => (
    <Field label={label}>
      <select
        className={inputClass}
        value={f[key] || options[0]}
        onChange={(e) => update(key, e.target.value)}
        disabled={!!editId && ["shipment_model", "service_type"].includes(key) && !!f.consolidation_reference}
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
  const totalGrossWeight = cargo.reduce(
    (s, c) => s + (Number(c.gross_weight) || 0),
    0,
  );
  const totalVolumetricWeight = cargo.reduce(
    (s, c) => s + (Number(c.volumetric_weight) || 0),
    0,
  );
  const totalVolume = cargo.reduce(
    (s, c) => s + (Number(c.volume) || 0),
    0,
  );
  const autoChargeableWeight = Math.max(totalGrossWeight, totalVolumetricWeight);
  const isChargeableOverridden = f.chargeable_weight_manual === "true";
  const displayedChargeableWeight = isChargeableOverridden
    ? f.total_chargeable_weight
    : autoChargeableWeight > 0
      ? autoChargeableWeight.toFixed(2)
      : "";

  const autoWeightCharge = cargo.reduce(
    (s, c) => s + (Number(c.chargeable_weight) || 0) * (Number(c.rate) || 0),
    0,
  );
  const isWeightChargeOverridden = f.weight_charge_manual === "true";
  const displayedWeightCharge = isWeightChargeOverridden && f.weight_charge !== undefined && f.weight_charge !== ""
    ? Number(f.weight_charge) || 0
    : autoWeightCharge;

  const total = (payment: string) =>
    charges
      .filter((c) => c.payment === payment)
      .reduce((s, c) => s + (Number(c.amount) || 0), 0) +
    (f.weight_payment === payment
      ? displayedWeightCharge + Number(f.valuation_charge || 0)
      : 0) +
    (f.other_payment === payment ? Number(f.tax || 0) : 0);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      saving ||
      (!editId && conversationId && (!source.data || source.data.workflow !== "ready"))
    )
      return;
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
      const finalCargo = cargo.map((c) => ({
        ...c,
        pieces: Number(c.pieces) || 1,
        gross_weight: Number(c.gross_weight) || 0,
        net_weight: Number(c.net_weight) || 0,
        chargeable_weight: Number(c.chargeable_weight) || 0,
        rate: Number(c.rate) || 0,
        volume: Number(c.volume) || 0,
        volumetric_weight: Number(c.volumetric_weight) || 0,
        dimensions: c.dimensions || formatDimensions(c.dimension_items),
        dimension_items: (c.dimension_items || []).map((d) => ({
          pieces: Number(d.pieces) || 1,
          length: Number(d.length) || 0,
          width: Number(d.width) || 0,
          height: Number(d.height) || 0,
          unit: d.unit === "m" || d.unit === "in" ? d.unit : "cm",
          gross_weight: Number(d.gross_weight) || 0,
          volume: Number(d.volume) || 0,
          volumetric_weight: Number(d.volumetric_weight) || 0,
        })),
      }));

      const finalCharges = charges
        .filter((c) => (c.charge_type_id && c.charge_type_id !== "__custom__") || (c.name && c.name.trim() !== "") || Number(c.amount) > 0)
        .map((c) => ({
          charge_type_id: c.charge_type_id && c.charge_type_id !== "__custom__" ? c.charge_type_id : null,
          name: c.name || "",
          amount: Number(c.amount) || 0,
          payment: c.payment || "PPD",
          due: c.due || "agent",
        }));

      const allowedScalarKeys = [
        "mode",
        "service_type",
        "shipment_model",
        "consolidation_reference",
        "incoterm",
        "origin",
        "destination",
        "master_number",
        "flight_number",
        "vessel",
        "voyage",
        "place_of_receipt",
        "place_of_delivery",
        "routing",
        "truck_plate",
        "driver_name",
        "collection_address",
        "delivery_address",
        "currency",
        "weight_payment",
        "other_payment",
        "declared_carriage",
        "declared_customs",
        "insurance",
        "handling",
        "execution_place",
        "signature",
        "chargeable_weight_manual",
      ] as const;

      const body: Record<string, unknown> = {
        ...Object.fromEntries(
          allowedScalarKeys
            .filter((k) => f[k] !== undefined)
            .map((k) => [k, f[k]]),
        ),
        bl_type: f.bl_type || "original",
        execution_date: f.execution_date || new Date().toISOString().slice(0, 10),
        air_divisor: f.air_divisor === "express" ? "express" : "standard",
        total_chargeable_weight: Number(displayedChargeableWeight || autoChargeableWeight || 0),
        weight_charge: Number(displayedWeightCharge || 0),
        weight_charge_manual: f.weight_charge_manual || "false",
        cargo: finalCargo,
        containers,
        waybill_charges: finalCharges,
        idempotency_key: draft.value.key,
        ...(f.rfq_id ? { rfq_id: f.rfq_id } : {}),
        ...(conversationId ? { source_conversation_id: conversationId } : {}),
      };
      for (const [key, p] of Object.entries(parties)) body[key] = p?.id || null;
      for (const key of [
        "etd",
        "eta",
        "cfs_cutoff",
        "vgm_deadline",
        "free_time_expires_at",
      ])
        body[key] = editId && f[key] === localDateInput(existing.data?.form?.[key])
          ? existing.data?.form?.[key] || null
          : f[key] ? new Date(f[key]).toISOString() : null;
      for (const key of ["tax", "valuation_charge"])
        body[key] = Number(f[key] || 0);
      if (draft.value.savedId) body.draft_id = draft.value.savedId;
      if (editId) body.version = draft.value.jobVersion;
      const result = editId
        ? await freight.put<{ id: string }>("/jobs/" + editId + "/form", body)
        : await freight.post<{ id: string }>("/jobs", body);
      draft.clear();
      if (typeof window !== "undefined") {
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.includes("draft") && k.includes("new-job")) {
              localStorage.removeItem(k);
            }
          }
        } catch {
          // ignore
        }
      }
      await client.invalidateQueries({ queryKey: ["freight", user?.tenant_id] });
      router.push(`/shipments/${result.id}`);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };
  const saveDraft = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const id = draft.value.savedId || draft.value.key;
      const { fields, parties, cargo, containers, charges, key } = draft.value;
      const result = await freight.put<{ id: string; version: number }>("/job-drafts/" + id, {
        version: draft.value.savedVersion || 0,
        form: { fields, parties, cargo, containers, charges, key },
      });
      setDraftValue(value => ({ ...value, savedId: result.id, savedVersion: result.version }));
      setSavedMessage("Draft saved. Resume it from Jobs later. Save again after making further changes.");
      await client.invalidateQueries({ queryKey: ["freight", user?.tenant_id, "job-drafts"] });
    } catch (err) { setError(err); }
    finally { setSaving(false); }
  };
  const warning = f.mode === "air" ? mawbWarning(f.master_number || "") : null;

  const clearAndStartFresh = () => {
    draft.clear();
    draft.setValue({
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
        bl_type: "original",
        total_chargeable_weight: "",
        chargeable_weight_manual: "false",
        air_divisor: "standard",
        handling: "",
        execution_place: settings.data?.city || "",
        signature: user?.full_name || settings.data?.signature || "",
      },
      parties: user ? { assigned_user_id: { id: user.id, name: user.full_name } } : {},
      cargo: [blankCargo()],
      containers: [],
      charges: [],
      key: crypto.randomUUID(),
      savedId: "",
      savedVersion: 0,
      loadedFrom: "",
      jobVersion: 0,
    });
    setError(null);
    setSavedMessage("");
  };

  const hasDetails = !editId && Boolean(
    f.origin ||
    f.destination ||
    f.carrier_code ||
    f.flight_number ||
    f.master_number ||
    f.house_number ||
    f.handling ||
    f.routing ||
    parties.customer_id ||
    parties.shipper_contact_id ||
    parties.consignee_contact_id ||
    parties.notify_contact_id ||
    parties.carrier_id ||
    parties.co_loader_id ||
    parties.origin_agent_id ||
    parties.destination_agent_id ||
    parties.customs_broker_id ||
    cargo.some((c) => Boolean(c.description || (c.gross_weight && c.gross_weight > 0) || (c.pieces && c.pieces > 0))) ||
    charges.length > 0
  );

  if (!draft.ready || ((editId || savedId) && draft.value.loadedFrom !== (editId || savedId)))
    return (
      <div className="rounded-xl bg-white p-10">
        <ErrorBanner error={existing.error || saved.error} />
        {existing.error || saved.error ? "Job form unavailable. Return to Jobs and try again." : "Loading job form…"}
      </div>
    );
  return (
    <form onSubmit={save} className="mx-auto max-w-[1400px] space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {editId ? "Edit" : "New"} {f.mode} job
          </h1>
          <p className="mt-1 text-xs text-[#858693]">
            {f.mode === "air"
              ? "House Air Waybill"
              : f.mode === "ocean"
                ? "House Bill of Lading"
                : "Transport instruction"}{" "}
            · {editId ? existing.data?.ref_number : "Draft"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
        {!editId && hasDetails && (
          <button
            type="button"
            className={secondaryClass}
            onClick={clearAndStartFresh}
            title="Clear all fields and start a fresh job"
          >
            <RotateCcw size={14} />Clear form
          </button>
        )}
        {!editId && <button type="button" className={secondaryClass}
          disabled={saving || !draft.value.key} onClick={saveDraft}>
          <Save size={14} />Save draft
        </button>}
        <button type="submit"
          className={buttonClass}
          disabled={
            saving ||
            (!editId && !!conversationId &&
              (!source.data || source.data.workflow !== "ready"))
          }
        >
          <Save size={14} />
          {saving ? "Saving…" : editId ? "Save changes" : "Create job & document"}
        </button>
        </div>
      </div>
      {isBrandNewJob && draft.hasSavedDraft && !draft.isRestored && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900 shadow-sm">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-blue-600" />
            <span>Found an unsaved draft from your previous session. Form is starting with a clean blank airway bill.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700 transition"
              onClick={draft.restoreDraft}
            >
              Restore previous draft
            </button>
            <button
              type="button"
              className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 font-medium text-blue-800 hover:bg-blue-100 transition"
              onClick={draft.discardDraft}
            >
              Discard draft
            </button>
          </div>
        </div>
      )}
      {isBrandNewJob && draft.isRestored && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 shadow-sm">
          <div className="flex items-center gap-2">
            <RotateCcw size={16} className="text-amber-600" />
            <span>Restored unsaved draft from your previous session into this form.</span>
          </div>
          <button
            type="button"
            className="flex items-center gap-1.5 font-semibold text-amber-900 underline hover:text-amber-950"
            onClick={clearAndStartFresh}
          >
            <RotateCcw size={13} />
            Discard draft & start blank
          </button>
        </div>
      )}
      {savedMessage && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">{savedMessage}</p>}
      {editId && <p className="text-xs text-[#777884]">Save updates the shipment and draft transport documents. Issued documents keep their issued content.</p>}
      {!editId && conversationId && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
          <strong>
            {source.data?.subject || "Loading customer confirmation…"}
          </strong>
          <p className="mt-1 text-xs">
            Review the customer confirmation, parties, route, cargo and agreed
            charges before creating this job.
          </p>
          {source.data && (
            <p className="mt-3 max-h-36 overflow-y-auto whitespace-pre-wrap break-words text-xs">
              {source.data.body}
            </p>
          )}
          {source.data?.bill_review_required && <p role="alert" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            AWB/BL correspondence exists in this thread. Check the original documents and existing bills before creating another job or issuing a bill.
          </p>}
          {source.data?.cargo && <div className="mt-3">
            <p className="text-xs">Cargo notes include readable customer packing-list attachments. Review the complete source in the email conversation.</p>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs">{source.data.cargo}</pre>
            <button type="button" className={secondaryClass + " mt-2"} disabled={!!cargo[0]?.description}
              onClick={() => setDraftValue(value => ({ ...value, cargo: value.cargo.map((line, index) => index === 0 && !line.description ? { ...line, description: source.data!.cargo!.slice(0, 2000) } : line) }))}>
              Use notes in empty cargo description
            </button>
            <p className="mt-1 text-xs">Copies up to 2,000 characters. Enter package counts, weights and dimensions in their fields after verification.</p>
          </div>}
          {source.data && source.data.workflow !== "ready" && (
            <p role="alert" className="mt-2 font-medium">
              This conversation is no longer awaiting job creation. Return to
              the RFQ pipeline to check its latest status.
            </p>
          )}
          <ErrorBanner error={source.error} />
        </div>
      )}
      {draft.storageError && (
        <p role="alert" className="text-xs text-amber-700">
          {draft.storageError}
        </p>
      )}
      <ErrorBanner error={error} />
      {(editId || savedId) && <button type="button" className={secondaryClass} disabled={saving}
        onClick={async () => {
          const result = editId ? await existing.refetch() : await saved.refetch();
          if (!result.error) {
            setDraftValue(value => ({ ...value, loadedFrom: "" }));
            setError(null);
          }
        }}>Reload saved {editId ? "job" : "draft"}</button>}
      <ErrorBanner error={rfq.error} />
      <div className="flex flex-wrap gap-2">
        {Object.keys(services).map((mode) => (
          <button
            key={mode}
            type="button"
            disabled={!!editId}
            className={`${secondaryClass} capitalize ${f.mode === mode ? "!border-[#7068cf] !bg-[#f4f2ff] !text-[#7068cf]" : ""}`}
            onClick={() => update("mode", mode)}
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
          {f.mode === "ocean" && (
            <div className="md:col-span-2 rounded-lg border border-[#eeecf5] bg-[#faf9fd] p-3">
              <label className="block text-xs font-semibold text-[#606174] mb-2">
                Bill of Lading Type
              </label>
              <div className="flex items-center gap-6 text-sm">
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    checked={f.bl_type === "sea_waybill"}
                    onChange={() => update("bl_type", "sea_waybill")}
                  />
                  <span className="font-medium text-[#2d2e3e]">Sea Waybill</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    checked={f.bl_type !== "sea_waybill"}
                    onChange={() => update("bl_type", "original")}
                  />
                  <span className="font-medium text-[#2d2e3e]">Original</span>
                </label>
              </div>
              <p className="mt-1.5 text-[11px] text-[#858693]">
                {f.bl_type === "sea_waybill"
                  ? "Sea Waybill (non-negotiable; cargo released to consignee without surrender of original bills)."
                  : "Original Bill of Lading (negotiable; standard set of 3 originals issued)."}
              </p>
            </div>
          )}
          {field(
            "master_number",
            f.mode === "air"
              ? "MAWB number"
              : f.mode === "ocean"
                ? "Master B/L number"
                : "CMR / Waybill number",
          )}
          <Field label={f.mode === "air" ? "HAWB number" : "House reference"}>
            <input className={inputClass} readOnly value={editId ? existing.data?.house_number : "Allocated on creation"} />
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
          <Field label="Issuing Agent / Forwarder (IATA code optional)">
            <input
              className={inputClass}
              readOnly
              value={`${settings.data?.name || "Freight Forwarder"}${settings.data?.iata_code ? ` (IATA: ${settings.data.iata_code})` : ""}`}
            />
          </Field>
        </div>
      </Panel>
      <Panel title="Routing & transport">
        <div className="grid gap-4 md:grid-cols-3">
          <LocationAutocomplete
            label={
              f.mode === "air"
                ? "Airport of departure (IATA / Airport)"
                : f.mode === "ocean"
                  ? "Port of loading (UN/LOCODE / Port)"
                  : "Origin"
            }
            mode={f.mode}
            value={f.origin || ""}
            required
            readOnly={
              !!editId &&
              !!f.consolidation_reference &&
              [
                "origin",
                "destination",
                "master_number",
                "flight_number",
                "vessel",
                "voyage",
                "etd",
                "eta",
              ].includes("origin")
            }
            onChange={(val) => update("origin", val)}
          />
          <LocationAutocomplete
            label={
              f.mode === "air"
                ? "Airport of destination (IATA / Airport)"
                : f.mode === "ocean"
                  ? "Port of discharge (UN/LOCODE / Port)"
                  : "Destination"
            }
            mode={f.mode}
            value={f.destination || ""}
            required
            readOnly={
              !!editId &&
              !!f.consolidation_reference &&
              [
                "origin",
                "destination",
                "master_number",
                "flight_number",
                "vessel",
                "voyage",
                "etd",
                "eta",
              ].includes("destination")
            }
            onChange={(val) => update("destination", val)}
          />
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
              draft.setValue((v) => {
                const newCargo = [...v.cargo, blankCargo()];
                return syncConsignmentTotals(v, newCargo);
              })
            }
          >
            <Plus size={13} />
            Commodity
          </button>
        }
      >
        <div className="space-y-6">
          {cargo.map((c, i) => {
            const dimensionItems =
              c.dimension_items && c.dimension_items.length > 0
                ? c.dimension_items
                : [blankDimensionItem()];

            return (
              <div
                key={i}
                className="rounded-xl border border-[#eeecf5] bg-white p-4 shadow-xs space-y-4"
              >
                <div className="flex items-center justify-between border-b border-[#eeecf5] pb-2 text-xs font-semibold text-[#1f2029]">
                  <span className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-50 text-[11px] font-bold text-indigo-700">
                      {i + 1}
                    </span>
                    Commodity {i + 1}
                  </span>
                  <button
                    type="button"
                    disabled={cargo.length === 1}
                    aria-label="Remove commodity"
                    className="text-[#858693] hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                    onClick={() =>
                      draft.setValue((v) => {
                        const newCargo = v.cargo.filter((_, n) => n !== i);
                        return syncConsignmentTotals(v, newCargo);
                      })
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="md:col-span-2">
                    <Field label="Nature & quantity of goods *">
                      <input
                        className={inputClass}
                        required
                        type="text"
                        placeholder="Description of commodity"
                        value={c.description}
                        onChange={(e) =>
                          changeCargo(i, "description", e.target.value)
                        }
                      />
                    </Field>
                  </div>
                  <Field label="Marks & numbers">
                    <input
                      className={inputClass}
                      type="text"
                      placeholder="e.g. 1/10 or N/M"
                      value={c.marks}
                      onChange={(e) =>
                        changeCargo(i, "marks", e.target.value)
                      }
                    />
                  </Field>
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

                  <Field label="Net weight">
                    <input
                      className={inputClass}
                      type="number"
                      min="0"
                      step="any"
                      value={c.net_weight || ""}
                      onChange={(e) =>
                        changeCargo(i, "net_weight", e.target.value)
                      }
                    />
                  </Field>

                  {f.mode === "air" && (
                    <>
                      <Field label="Rate class">
                        <input
                          className={inputClass}
                          type="text"
                          value={c.rate_class}
                          onChange={(e) =>
                            changeCargo(i, "rate_class", e.target.value)
                          }
                        />
                      </Field>
                      <Field label="Commodity item no.">
                        <input
                          className={inputClass}
                          type="text"
                          value={c.commodity_number}
                          onChange={(e) =>
                            changeCargo(i, "commodity_number", e.target.value)
                          }
                        />
                      </Field>
                      <Field label="Rate / charge">
                        <input
                          className={inputClass}
                          type="number"
                          min="0"
                          step="any"
                          value={c.rate}
                          onChange={(e) =>
                            changeCargo(i, "rate", e.target.value)
                          }
                        />
                      </Field>
                    </>
                  )}
                </div>

                {/* Dimensions breakdown for this commodity */}
                <div className="rounded-lg border border-[#eeecf5] bg-[#faf9fd] p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-[#4e4f62]">
                        Package Dimensions & Weights
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#858693]">
                        <span>
                          Package dimensions.{" "}
                          {f.mode === "air"
                            ? f.air_divisor === "express"
                              ? "Express Courier divisor: /5,000 cm (or /139 in)"
                              : "Standard Air Freight divisor: /6,000 cm (or /166 in — 1 m³ = 167 kg)"
                            : f.mode === "ocean"
                              ? "Ocean Freight: 1 m³ = 1,000 kg"
                              : "Standard formula"}
                        </span>
                        {f.mode === "air" && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] uppercase font-bold text-[#777884]">Divisor:</span>
                            <select
                              className={`${inputClass} !h-6 !py-0 !px-1.5 text-[11px] font-medium`}
                              value={f.air_divisor || "standard"}
                              onChange={(e) => update("air_divisor", e.target.value)}
                            >
                              <option value="standard">Standard Air (6,000 / 166)</option>
                              <option value="express">Express Courier (5,000 / 139)</option>
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#eeecf5] text-[#777884]">
                          <th className="pb-1.5 font-medium">Pieces</th>
                          <th className="pb-1.5 font-medium">Length</th>
                          <th className="pb-1.5 font-medium">Width</th>
                          <th className="pb-1.5 font-medium">Height</th>
                          <th className="pb-1.5 font-medium">Unit</th>
                          <th className="pb-1.5 font-medium">
                            Gross Wt ({c.weight_unit || "kg"})
                          </th>
                          <th className="pb-1.5 font-medium">Volume (m³)</th>
                          <th className="pb-1.5 font-medium">
                            Vol. Wt ({c.weight_unit || "kg"})
                          </th>
                          <th className="pb-1.5 font-medium w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f0eef9]">
                        {dimensionItems.map((dim, j) => (
                          <tr key={j} className="hover:bg-[#f6f5fc]">
                            <td className="py-1.5 pr-2">
                              <input
                                type="number"
                                min="1"
                                step="1"
                                className={`${inputClass} !h-7 !py-0 !px-2 text-xs w-18 min-w-[70px]`}
                                value={dim.pieces || 1}
                                onChange={(e) =>
                                  changeDimension(i, j, "pieces", e.target.value)
                                }
                              />
                            </td>
                            <td className="py-1.5 pr-2">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                placeholder="0"
                                className={`${inputClass} !h-7 !py-0 !px-2 text-xs w-20 min-w-[75px]`}
                                value={dim.length || ""}
                                onChange={(e) =>
                                  changeDimension(i, j, "length", e.target.value)
                                }
                              />
                            </td>
                            <td className="py-1.5 pr-2">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                placeholder="0"
                                className={`${inputClass} !h-7 !py-0 !px-2 text-xs w-20 min-w-[75px]`}
                                value={dim.width || ""}
                                onChange={(e) =>
                                  changeDimension(i, j, "width", e.target.value)
                                }
                              />
                            </td>
                            <td className="py-1.5 pr-2">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                placeholder="0"
                                className={`${inputClass} !h-7 !py-0 !px-2 text-xs w-20 min-w-[75px]`}
                                value={dim.height || ""}
                                onChange={(e) =>
                                  changeDimension(i, j, "height", e.target.value)
                                }
                              />
                            </td>
                            <td className="py-1.5 pr-2">
                              <select
                                className={`${inputClass} !h-7 !py-0 !px-2 text-xs w-18 min-w-[65px]`}
                                value={dim.unit || "cm"}
                                onChange={(e) =>
                                  changeDimension(i, j, "unit", e.target.value)
                                }
                              >
                                <option value="cm">cm</option>
                                <option value="in">in</option>
                                <option value="m">m</option>
                              </select>
                            </td>
                            <td className="py-1.5 pr-2">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                placeholder="0"
                                className={`${inputClass} !h-7 !py-0 !px-2 text-xs w-24 min-w-[85px]`}
                                value={dim.gross_weight || ""}
                                onChange={(e) =>
                                  changeDimension(
                                    i,
                                    j,
                                    "gross_weight",
                                    e.target.value,
                                  )
                                }
                              />
                            </td>
                            <td className="py-1.5 pr-2 font-mono text-[11px] text-[#2d2e3e]">
                              {(dim.volume || 0).toFixed(4)}
                            </td>
                            <td className="py-1.5 pr-2">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                placeholder="0.00"
                                className={`${inputClass} !h-7 !py-0 !px-2 text-xs w-24 min-w-[85px] font-mono`}
                                value={dim.volumetric_weight !== undefined && dim.volumetric_weight !== null ? dim.volumetric_weight : ""}
                                onChange={(e) =>
                                  changeDimension(
                                    i,
                                    j,
                                    "volumetric_weight",
                                    e.target.value,
                                  )
                                }
                              />
                            </td>
                            <td className="py-1.5 text-center">
                              <button
                                type="button"
                                disabled={dimensionItems.length === 1}
                                aria-label="Remove dimension"
                                className="text-[#858693] hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                                onClick={() => removeDimension(i, j)}
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#eeecf5] pt-2">
                    <button
                      type="button"
                      className={`${secondaryClass} !py-1 !px-2.5 text-xs`}
                      onClick={() => addDimension(i)}
                    >
                      <Plus size={12} />
                      Add dimension
                    </button>
                    <div className="flex flex-wrap items-center gap-2.5 text-xs text-[#606174]">
                      <span>
                        Pieces: <strong>{c.pieces}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Gross Wt:{" "}
                        <strong>
                          {Number(c.gross_weight || 0).toFixed(2)}{" "}
                          {c.weight_unit}
                        </strong>
                      </span>
                      <span>•</span>
                      <span>
                        Volume:{" "}
                        <strong>{Number(c.volume || 0).toFixed(4)} m³</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Vol. Wt:{" "}
                        <strong>
                          {Number(c.volumetric_weight || 0).toFixed(2)}{" "}
                          {c.weight_unit}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>

                {f.mode === "air" && (
                  <p className="text-right text-xs font-semibold text-[#2d2e3e]">
                    Total weight charge:{" "}
                    {(c.chargeable_weight * c.rate).toFixed(2)} {f.currency}
                  </p>
                )}
              </div>
            );
          })}

          {/* Consignment Weight & Chargeable Weight Summary (All Commodities) */}
          <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-[#faf9fd] to-[#f4f2ff] p-4.5 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 pb-2.5">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-950">
                  Consignment Totals & Chargeable Weight
                </h3>
                <p className="text-[11px] text-[#777884]">
                  Totalled across {cargo.length}{" "}
                  {cargo.length === 1 ? "commodity" : "commodities"} · Formula:{" "}
                  <span className="font-semibold text-indigo-700">
                    {f.mode === "air"
                      ? "Air Freight ((L × W × H cm) / 6000, 1 m³ = 166.67 kg)"
                      : f.mode === "ocean"
                        ? "Ocean Freight ((L × W × H cm) / 1000, 1 m³ = 1,000 kg)"
                        : f.mode === "road"
                          ? "Road Freight ((L × W × H cm) / 3000, 1 m³ = 333.33 kg)"
                          : "Standard ((L × W × H cm) / 1000, 1 m³ = 1,000 kg)"}
                  </span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-lg bg-white p-3 border border-[#eeecf5] shadow-xs">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#777884]">
                  Total Gross Weight
                </div>
                <div className="mt-1 text-lg font-bold text-[#1f2029]">
                  {totalGrossWeight.toFixed(2)}{" "}
                  <span className="text-xs font-normal text-[#858693]">
                    {cargo[0]?.weight_unit || "kg"}
                  </span>
                </div>
                <div className="mt-0.5 text-[10px] text-[#858693]">
                  Sum of all commodity gross weights
                </div>
              </div>

              <div className="rounded-lg bg-white p-3 border border-[#eeecf5] shadow-xs">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#777884]">
                  Total Volumetric Weight
                </div>
                <div className="mt-1 text-lg font-bold text-[#1f2029]">
                  {totalVolumetricWeight.toFixed(2)}{" "}
                  <span className="text-xs font-normal text-[#858693]">
                    {cargo[0]?.weight_unit || "kg"}
                  </span>
                </div>
                <div className="mt-0.5 text-[10px] text-[#858693]">
                  Auto-calculated in m³ and converted
                </div>
              </div>

              <div className="rounded-lg bg-white p-3 border border-[#eeecf5] shadow-xs">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#777884]">
                  Total Volume
                </div>
                <div className="mt-1 text-lg font-bold text-[#1f2029]">
                  {totalVolume.toFixed(4)}{" "}
                  <span className="text-xs font-normal text-[#858693]">m³</span>
                </div>
                <div className="mt-0.5 text-[10px] text-[#858693]">
                  Total cubic measurement (CBM)
                </div>
              </div>

              <div className="rounded-lg bg-white p-3 border-2 border-indigo-600 shadow-xs relative">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="consignment-chargeable-weight"
                    className="text-[11px] font-bold uppercase tracking-wider text-indigo-900"
                  >
                    Chargeable Weight *
                  </label>
                  {isChargeableOverridden && (
                    <button
                      type="button"
                      onClick={resetToAutoChargeable}
                      className="text-[10px] font-medium text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                      title="Reset to max(Gross Weight, Volumetric Weight)"
                    >
                      Reset to Max
                    </button>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <input
                    id="consignment-chargeable-weight"
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    className="w-full text-lg font-bold text-indigo-950 bg-transparent outline-none border-b border-indigo-300 focus:border-indigo-600"
                    value={displayedChargeableWeight}
                    onChange={(e) =>
                      handleChargeableWeightInputChange(e.target.value)
                    }
                  />
                  <span className="text-xs font-semibold text-indigo-900">
                    {cargo[0]?.weight_unit || "kg"}
                  </span>
                </div>
                <div className="mt-0.5 text-[10px] text-[#777884]">
                  {isChargeableOverridden ? (
                    <span className="text-amber-700 font-medium">
                      Manually edited (Auto max: {autoChargeableWeight.toFixed(2)})
                    </span>
                  ) : (
                    <span>
                      Auto: Max({totalGrossWeight.toFixed(2)},{" "}
                      {totalVolumetricWeight.toFixed(2)})
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
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
        {/* Pre-computed weight charge with manual edit/override */}
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Weight Charge ({f.weight_payment || "PPD"})
              </span>
              <p className="text-[11px] text-slate-500">
                Calculated from chargeable weight ({displayedChargeableWeight || autoChargeableWeight || "0"} {cargo[0]?.weight_unit || "kg"} × rate). You can edit this directly if needed.
              </p>
            </div>
            <button
              type="button"
              className="text-xs font-semibold text-[#7068cf] hover:underline"
              onClick={() => {
                const nextManual = f.weight_charge_manual === "true" ? "false" : "true";
                draft.setValue((v) => ({
                  ...v,
                  fields: {
                    ...v.fields,
                    weight_charge_manual: nextManual,
                    weight_charge: v.fields.weight_charge ?? autoWeightCharge.toFixed(2),
                  },
                }));
              }}
            >
              {f.weight_charge_manual === "true" ? "← Reset to auto-computed" : "Manual edit / override"}
            </button>
          </div>
          {f.weight_charge_manual === "true" ? (
            <div className="mt-2 flex items-center gap-2">
              <input
                aria-label="Manual weight charge"
                type="number"
                min="0"
                step=".01"
                className={inputClass + " max-w-xs font-semibold"}
                value={f.weight_charge ?? autoWeightCharge.toFixed(2)}
                onChange={(e) => update("weight_charge", e.target.value)}
              />
              <span className="text-xs font-bold text-slate-700">{f.currency}</span>
              <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Manually edited</span>
            </div>
          ) : (
            <div className="mt-2 text-sm font-bold text-slate-800">
              {autoWeightCharge.toFixed(2)} {f.currency}
            </div>
          )}
        </div>

        {/* Additional and itemized charges */}
        <div className="mt-4 space-y-3">
          <div className="hidden grid-cols-2 gap-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 md:grid md:grid-cols-[2fr_1fr_1fr_1fr_auto]">
            <div>Charge Description</div>
            <div>Amount</div>
            <div>Payment</div>
            <div>Due</div>
            <div></div>
          </div>
          {charges.map((c, i) => (
            <div
              key={i}
              className="grid grid-cols-2 gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto]"
            >
              <ChargeSelect
                mode={f.mode}
                value={c.charge_type_id}
                name={c.name}
                onChange={(id, type, customName) =>
                  draft.setValue((v) => ({
                    ...v,
                    charges: v.charges.map((r, n) =>
                      n === i
                        ? {
                            ...r,
                            charge_type_id: id,
                            name: customName !== undefined ? customName : (type?.name || r.name),
                            amount: type?.default_value !== undefined ? Number(type.default_value) : r.amount,
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
                className="text-slate-400 hover:text-red-600 self-center"
                onClick={() =>
                  draft.setValue((v) => ({
                    ...v,
                    charges: v.charges.filter((_, n) => n !== i),
                  }))
                }
              >
                <Trash2 size={16} />
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
                    name: "",
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
      <div className="flex flex-wrap justify-end gap-2 pb-8">
        {!editId && hasDetails && (
          <button
            type="button"
            className={secondaryClass}
            onClick={clearAndStartFresh}
            title="Clear all fields and start a fresh job"
          >
            <RotateCcw size={14} />Clear form
          </button>
        )}
        {!editId && <button type="button" className={secondaryClass} disabled={saving || !draft.value.key} onClick={saveDraft}>Save draft</button>}
        <button type="submit"
          className={buttonClass}
          disabled={
            saving ||
            (!editId && !!conversationId &&
              (!source.data || source.data.workflow !== "ready"))
          }
        >
          <Save size={14} />
          {saving ? "Saving…" : editId ? "Save changes" : "Create job & document"}
        </button>
      </div>
    </form>
  );
}
