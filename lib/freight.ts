import { api } from "./api-client";
export function localDateInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
export interface Entity {
  id: string;
  name: string;
  secondary?: string;
  email?: string;
  address?: string;
  city?: string;
  country?: string;
  role?: string;
  details?: Record<string, string>;
}
export type EntityKind =
  "contacts" | "third_party_agents" | "customers" | "carriers" | "staff";
export interface ChargeType {
  id: string;
  name: string;
  calculation: string;
  default_value: number;
  currency: string;
  modes: string[];
  is_active: boolean;
}
export interface DimensionItem {
  pieces: number;
  length: number;
  width: number;
  height: number;
  unit: "cm" | "m" | "in";
  gross_weight: number;
  volume: number;
  volumetric_weight: number;
}
export interface Cargo {
  description: string;
  pieces: number;
  gross_weight: number;
  net_weight: number;
  weight_unit: string;
  chargeable_weight: number;
  rate_class: string;
  commodity_number: string;
  rate: number;
  dimensions: string;
  marks: string;
  volume: number;
  volumetric_weight?: number;
  dimension_items?: DimensionItem[];
}
export const blankDimensionItem = (unit: "cm" | "m" | "in" = "cm"): DimensionItem => ({
  pieces: 1,
  length: 0,
  width: 0,
  height: 0,
  unit,
  gross_weight: 0,
  volume: 0,
  volumetric_weight: 0,
});
export function calcDimensionItem(
  item: DimensionItem,
  mode: string = "air",
  divisorType: "standard" | "express" = "standard",
): { volume: number; volumetric_weight: number } {
  const p = Math.max(1, Number(item.pieces) || 1);
  const l = Math.max(0, Number(item.length) || 0);
  const w = Math.max(0, Number(item.width) || 0);
  const h = Math.max(0, Number(item.height) || 0);

  if (l <= 0 || w <= 0 || h <= 0) {
    return { volume: 0, volumetric_weight: 0 };
  }

  let volumeM3 = 0;
  let volWeightKg = 0;

  if (item.unit === "in") {
    // Imperial (Inches and Pounds):
    // Volume (m3) = (L * 0.0254) * (W * 0.0254) * (H * 0.0254) * pieces
    volumeM3 = (l * 0.0254) * (w * 0.0254) * (h * 0.0254) * p;
    // Standard Air Freight: (L * W * H * pieces) / 166
    // Express Couriers (DHL, FedEx, UPS): (L * W * H * pieces) / 139
    const imperialDivisor = divisorType === "express" ? 139 : 166;
    const volWeightLbs = (l * w * h * p) / imperialDivisor;
    // 1 lb = 0.45359237 kg
    volWeightKg = volWeightLbs * 0.45359237;
  } else if (item.unit === "m") {
    // Dimensions in meters: Volume (m3) = L * W * H * pieces
    volumeM3 = l * w * h * p;
    if (mode === "air") {
      // Standard IATA: 6000 divisor (1 m3 = 166.67 kg)
      // Express Courier: 5000 divisor (1 m3 = 200 kg)
      const airDivisor = divisorType === "express" ? 5000 : 6000;
      volWeightKg = volumeM3 * (1000000 / airDivisor);
    } else if (mode === "ocean") {
      volWeightKg = volumeM3 * 1000;
    } else if (mode === "road") {
      volWeightKg = volumeM3 * (1000000 / 3000);
    } else {
      volWeightKg = volumeM3 * 1000;
    }
  } else {
    // Dimensions in centimeters: Volume (m3) = (L * W * H * pieces) / 1,000,000
    volumeM3 = (l * w * h * p) / 1000000;
    if (mode === "air") {
      // Standard Air Freight divisor = 6,000 (1 m3 = 167 kg)
      // Express Couriers (DHL, FedEx, UPS) divisor = 5,000
      const airDivisor = divisorType === "express" ? 5000 : 6000;
      volWeightKg = (l * w * h * p) / airDivisor;
    } else if (mode === "ocean") {
      volWeightKg = (l * w * h * p) / 1000;
    } else if (mode === "road") {
      volWeightKg = (l * w * h * p) / 3000;
    } else {
      volWeightKg = (l * w * h * p) / 1000;
    }
  }

  return {
    volume: Number(volumeM3.toFixed(4)),
    volumetric_weight: Number(volWeightKg.toFixed(2)),
  };
}
export function formatDimensions(items?: DimensionItem[]): string {
  if (!items || items.length === 0) return "";
  return items
    .filter((d) => (d.length || 0) > 0 && (d.width || 0) > 0 && (d.height || 0) > 0)
    .map(
      (d) =>
        `${d.pieces || 1} @ ${d.length}x${d.width}x${d.height} ${d.unit || "cm"}`
    )
    .join("; ");
}
export function parseDimensionsString(
  dimStr: string,
  pieces: number = 1,
  grossWeight: number = 0,
  mode: string = "air",
): DimensionItem[] {
  if (!dimStr || !dimStr.trim()) {
    return [
      {
        pieces: Math.max(1, pieces),
        length: 0,
        width: 0,
        height: 0,
        unit: "cm",
        gross_weight: grossWeight,
        volume: 0,
        volumetric_weight: 0,
      },
    ];
  }
  const parts = dimStr.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
  const items: DimensionItem[] = [];

  for (const part of parts) {
    const match = part.match(
      /(?:(\d+)\s*[@x*]\s*)?(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+(?:\.\d+)?)(?:\s*(cm|m|in))?/i,
    );
    if (match) {
      const p = match[1] ? Number(match[1]) : Math.max(1, pieces);
      const l = Number(match[2]);
      const w = Number(match[3]);
      const h = Number(match[4]);
      const rawUnit = (match[5] || "cm").toLowerCase();
      const unit: "cm" | "m" | "in" = rawUnit === "m" ? "m" : rawUnit === "in" ? "in" : "cm";
      const item: DimensionItem = {
        pieces: p,
        length: l,
        width: w,
        height: h,
        unit,
        gross_weight: parts.length > 1 ? Number((grossWeight / parts.length).toFixed(2)) : grossWeight,
        volume: 0,
        volumetric_weight: 0,
      };
      const calc = calcDimensionItem(item, mode);
      item.volume = calc.volume;
      item.volumetric_weight = calc.volumetric_weight;
      items.push(item);
    }
  }

  if (items.length > 0) return items;

  return [
    {
      pieces: Math.max(1, pieces),
      length: 0,
      width: 0,
      height: 0,
      unit: "cm",
      gross_weight: grossWeight,
      volume: 0,
      volumetric_weight: 0,
    },
  ];
}
export const LB_PER_KG = 2.20462262;
export const KG_PER_LB = 0.45359237;

export const blankCargo = (): Cargo => ({
  description: "",
  pieces: 1,
  gross_weight: 0,
  net_weight: 0,
  weight_unit: "kg",
  chargeable_weight: 0,
  rate_class: "Q",
  commodity_number: "",
  rate: 0,
  dimensions: "",
  marks: "",
  volume: 0,
  volumetric_weight: 0,
  dimension_items: [blankDimensionItem()],
});

export function recalculateCommodityCargo(
  c: Cargo,
  dimensionItems: DimensionItem[],
  mode: string = "air",
  divisorType: "standard" | "express" = "standard",
): Cargo {
  const updatedDims = dimensionItems.map((dim) => {
    const calc = calcDimensionItem(dim, mode, divisorType);
    // When L x W x H dimensions exist (calc.volume > 0), always use the fresh mode/divisor volumetric weight!
    // When only standalone CBM volume exists without L/W/H, recalculate volumetric weight from CBM for the active mode/divisor.
    const existingVol = Math.max(0, Number(dim.volume) || 0);
    let fallbackVolWeight = 0;
    if (calc.volume <= 0 && existingVol > 0) {
      if (mode === "air") {
        const airDiv = divisorType === "express" ? 5000 : 6000;
        fallbackVolWeight = Number((existingVol * (1000000 / airDiv)).toFixed(2));
      } else if (mode === "road") {
        fallbackVolWeight = Number((existingVol * (1000000 / 3000)).toFixed(2));
      } else {
        fallbackVolWeight = Number((existingVol * 1000).toFixed(2));
      }
    } else if (
      calc.volume <= 0 &&
      dim.volumetric_weight !== undefined &&
      dim.volumetric_weight !== null &&
      !Number.isNaN(dim.volumetric_weight) &&
      dim.volumetric_weight > 0
    ) {
      fallbackVolWeight = dim.volumetric_weight;
    }
    return {
      ...dim,
      volume: calc.volume > 0 ? calc.volume : existingVol,
      volumetric_weight: calc.volume > 0 ? calc.volumetric_weight : fallbackVolWeight,
    };
  });

  const totPieces = updatedDims.reduce((s, d) => s + (Number(d.pieces) || 0), 0);
  const totGross = Number(
    updatedDims.reduce((s, d) => s + (Number(d.gross_weight) || 0), 0).toFixed(2),
  );
  const totVol = Number(
    updatedDims.reduce((s, d) => s + (Number(d.volume) || 0), 0).toFixed(4),
  );
  const totVolWeight = Number(
    updatedDims.reduce((s, d) => s + (Number(d.volumetric_weight) || 0), 0).toFixed(2),
  );
  const grossKg = c.weight_unit === "lb" ? totGross * KG_PER_LB : totGross;
  const autoCW = Number(Math.max(grossKg, totVolWeight).toFixed(2));

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
}

export function calculateConsignmentTotals(cargoList: Cargo[]) {
  const totalPieces = cargoList.reduce((s, c) => s + (Number(c.pieces) || 0), 0);
  const totalGrossKg = Number(
    cargoList
      .reduce(
        (s, c) =>
          s + (Number(c.gross_weight) || 0) * (c.weight_unit === "lb" ? KG_PER_LB : 1),
        0,
      )
      .toFixed(2),
  );
  const totalVolumetricKg = Number(
    cargoList.reduce((s, c) => s + (Number(c.volumetric_weight) || 0), 0).toFixed(2),
  );
  const totalVolumeCbm = Number(
    cargoList.reduce((s, c) => s + (Number(c.volume) || 0), 0).toFixed(4),
  );
  const autoChargeableWeightKg = Number(Math.max(totalGrossKg, totalVolumetricKg).toFixed(2));
  const autoChargeableWeightLb = Number((autoChargeableWeightKg * LB_PER_KG).toFixed(2));
  return {
    totalPieces,
    totalGrossKg,
    totalVolumetricKg,
    totalVolumeCbm,
    autoChargeableWeightKg,
    autoChargeableWeightLb,
  };
}

export function formatCargoSummaryText(cargoList: Cargo[]): string {
  const totals = calculateConsignmentTotals(cargoList);
  const lines = cargoList
    .filter((c) => c.description.trim() || c.gross_weight > 0 || c.volume > 0 || c.pieces > 0)
    .map((c, idx) => {
      const dims = c.dimensions || formatDimensions(c.dimension_items);
      return `${idx + 1}. ${c.description.trim() || "General Cargo"} — ${c.pieces || 1} pcs, ${Number(c.gross_weight || 0).toFixed(2)} ${c.weight_unit || "kg"}${dims ? `, dims: ${dims}` : ""}, ${Number(c.volume || 0).toFixed(4)} m³, vol wt: ${Number(c.volumetric_weight || 0).toFixed(2)} kg`;
    });
  if (!lines.length) return "";
  return `${lines.join("\n")}\nTotal: ${totals.totalPieces} pcs · Gross ${totals.totalGrossKg.toFixed(2)} kg · Vol Wt ${totals.totalVolumetricKg.toFixed(2)} kg · Volume ${totals.totalVolumeCbm.toFixed(4)} m³ · Chargeable ${totals.autoChargeableWeightKg.toFixed(2)} kg`;
}

export function formatRateUnitLabel(unit?: string | null): string {
  const u = (unit || "per_shipment").toLowerCase();
  if (u === "per_kg" || u === "kg") return "/ kg";
  if (u === "per_lb" || u === "lb") return "/ lb";
  if (u === "per_m3" || u === "per_cbm" || u === "cbm" || u === "m3") return "/ m³";
  if (u === "per_container" || u === "container") return "/ container";
  return "/ shipment";
}

export function calculateRateBuyAmount(
  rate: Record<string, any>,
  chargeableWeightKg: number,
  volumeCbm: number,
  unitCount = 1,
): number {
  const rateUnit = String(rate.rate_unit || "").toLowerCase();
  const basePaise = Number(rate.base_rate_paise || 0);
  const perKgPaise = Number(rate.per_kg_rate_paise || 0);
  const perCbmPaise = Number(rate.per_cbm_rate_paise || 0);
  const unitPaise = Number(rate.unit_rate_paise || 0);
  const perLbPaise = Number(rate.per_lb_rate_paise || 0);

  if (rateUnit === "per_lb") {
    const lbRate = unitPaise || perLbPaise || Math.round(perKgPaise / LB_PER_KG);
    const wtLb = chargeableWeightKg * LB_PER_KG;
    return Number(((basePaise + wtLb * lbRate) / 100).toFixed(2));
  }
  if (rateUnit === "per_kg") {
    const kgRate = unitPaise || perKgPaise;
    return Number(((basePaise + chargeableWeightKg * kgRate) / 100).toFixed(2));
  }
  if (rateUnit === "per_m3" || rateUnit === "per_cbm") {
    const cbmRate = unitPaise || perCbmPaise;
    return Number(((basePaise + volumeCbm * cbmRate) / 100).toFixed(2));
  }
  if (rateUnit === "per_container" || rateUnit === "per_shipment") {
    const flatPaise = unitPaise || basePaise;
    return Number(((flatPaise * Math.max(1, unitCount)) / 100).toFixed(2));
  }
  return Number(
    ((basePaise + chargeableWeightKg * perKgPaise + volumeCbm * perCbmPaise) / 100).toFixed(2),
  );
}

export function calculateSellFromBuy(
  buyAmount: number,
  profitValue: number,
  pricingMethod: "margin" | "markup" | "fixed" = "margin",
): number {
  if (pricingMethod === "fixed") {
    return Number((buyAmount + profitValue).toFixed(2));
  }
  if (pricingMethod === "markup") {
    return Number((buyAmount * (1 + Math.max(0, profitValue) / 100)).toFixed(2));
  }
  return Number((buyAmount / (1 - Math.min(Math.max(0, profitValue), 99.99) / 100)).toFixed(2));
}
export interface Job {
  id: string;
  ref_number: string;
  customer_name: string;
  assigned_name?: string;
  assigned_user_id?: string;
  transport_mode: string;
  status: string;
  etd: string | null;
  eta: string | null;
  origin: string;
  destination: string;
  house_number?: string;
  service_type?: string;
  shipment_model?: string;
  weight_kg: number;
  package_count: number;
  volume_cbm: number;
  cargo_description: string;
  free_time_expires_at?: string;
  dd_risk: string;
  version: number;
  can_view_finance?: boolean;
  is_draft?: boolean;
  created_by?: { id: string; name: string } | null;
  last_edited_by?: { id: string; name: string } | null;
  form?: Record<string, any>;
  document_data?: Record<string, any>;
  third_parties?: Entity[];
}
export const freight = {
  async get<T>(path: string, params?: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
    return (await api.get(`/freight${path}`, { params, signal })).data;
  },
  async post<T>(path: string, data: unknown): Promise<T> {
    return (await api.post(`/freight${path}`, data)).data;
  },
  async patch<T>(path: string, data: unknown): Promise<T> {
    return (await api.patch(`/freight${path}`, data)).data;
  },
  async put<T>(path: string, data: unknown): Promise<T> {
    return (await api.put(`/freight${path}`, data)).data;
  },
  async remove(path: string) {
    await api.delete(`/freight${path}`);
  },
};
export function mawbWarning(value: string): string | null {
  if (!value) return null;
  const compact = value.replace(/[\s-]/g, "");
  if (!/^[0-9]{11}$/.test(compact))
    return "Possible typo: MAWB must contain 11 digits (3-digit airline prefix and 8-digit serial/check number).";
  if (Number(compact.slice(3, 10)) % 7 !== Number(compact[10]))
    return "Possible typo: MAWB check digit does not match the IATA modulus-7 check.";
  return null;
}
export const dateLabel = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
};
export const moneyLabel = (value: unknown, currency = "USD") => {
  const num = Number(value || 0);
  const safeNum = Number.isFinite(num) ? num : 0;
  const code = String(currency || "USD").trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(code)) {
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(safeNum);
    } catch {
      // Fallback for unrecognized 3-letter codes
    }
  }
  return `${code || "USD"} ${safeNum.toFixed(2)}`;
};
export const errorMessage = (error: unknown) =>
  (error as { message?: string })?.message || "Unable to save. Try again.";
