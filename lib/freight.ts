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
  form?: Record<string, any>;
  document_data?: Record<string, any>;
  third_parties?: Entity[];
}
export const freight = {
  async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    return (await api.get(`/freight${path}`, { params })).data;
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
