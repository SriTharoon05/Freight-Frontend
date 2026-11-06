import { api } from "./api-client";
export function localDateInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
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
  unit: "cm" | "m";
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
export const blankDimensionItem = (unit: "cm" | "m" = "cm"): DimensionItem => ({
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

  if (item.unit === "m") {
    // Dimensions in meters: Volume (m³) = L * W * H * pieces
    volumeM3 = l * w * h * p;
    if (mode === "air") {
      // Air freight: (L*W*H in cm)/6000 => 1 m³ = 166.67 kg
      volWeightKg = volumeM3 * (1000000 / 6000);
    } else if (mode === "ocean") {
      // Ocean freight: 1 m³ = 1,000 kg (1 metric ton)
      volWeightKg = volumeM3 * 1000;
    } else if (mode === "road") {
      // Road freight: (L*W*H in cm)/3000 => 1 m³ = 333.33 kg
      volWeightKg = volumeM3 * (1000000 / 3000);
    } else {
      volWeightKg = volumeM3 * 1000;
    }
  } else {
    // Dimensions in centimeters: Volume (m³) = (L * W * H * pieces) / 1,000,000
    volumeM3 = (l * w * h * p) / 1000000;
    if (mode === "air") {
      // Air freight: (L * W * H * pieces) / 6000
      volWeightKg = (l * w * h * p) / 6000;
    } else if (mode === "ocean") {
      // Ocean freight: (L * W * H * pieces) / 1000 (1 CBM = 1,000 kg)
      volWeightKg = (l * w * h * p) / 1000;
    } else if (mode === "road") {
      // Road freight: (L * W * H * pieces) / 3000
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
      /(?:(\d+)\s*[@x*]\s*)?(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+(?:\.\d+)?)(?:\s*(cm|m))?/i,
    );
    if (match) {
      const p = match[1] ? Number(match[1]) : Math.max(1, pieces);
      const l = Number(match[2]);
      const w = Number(match[3]);
      const h = Number(match[4]);
      const unit = (match[5] || "cm").toLowerCase() === "m" ? "m" : "cm";
      const item: DimensionItem = {
        pieces: p,
        length: l,
        width: w,
        height: h,
        unit: unit as "cm" | "m",
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
export const dateLabel = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";
export const moneyLabel = (value: unknown, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    Number(value || 0),
  );
export const errorMessage = (error: unknown) =>
  (error as { message?: string })?.message || "Unable to save. Try again.";
