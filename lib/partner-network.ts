import { freight } from "./freight";

export type TaskKind =
  | "pickup"
  | "delivery"
  | "customs_export"
  | "customs_import";
export interface Partner {
  id: string;
  name: string;
  capabilities: string[];
  coverage: string[];
  ports: string[];
  verification: string;
  relationship: { id: string; status: string } | null;
}
export interface NetworkCommand {
  id: string;
  kind: string;
  status: string;
  last_error: string | null;
  payload: Record<string, unknown>;
}
export interface NetworkEvidence {
  id: string;
  kind: string;
  filename: string;
  content_type: string;
  status: string;
  captured_at: string;
  stage?: "loading" | "handover";
  received_at?: string;
  recipient?: string;
  location?: { latitude: number; longitude: number; accuracy: number; area?: { name: string } };
}
export interface NetworkTask {
  id: string;
  company_id: string;
  job_id: string;
  job_reference: string;
  partner_id: string;
  kind: TaskKind;
  status: string;
  scheduled_at: string;
  version: number;
  brief_version: number;
  instructions: string;
  required_proof: string[];
  briefing: Record<string, unknown>;
  acknowledged_brief_version: number;
  tracking_status: string;
  driver: { id: string; name: string; phone: string; vehicle: string; expires_at: string } | null;
  completion: {
    recipient?: string;
    clearance_reference?: string;
    evidence_ids?: string[];
  };
  last_location: {
    latitude: number;
    longitude: number;
    accuracy: number;
    captured_at: string;
    received_at: string;
    area?: { name: string; approximate?: boolean };
  } | null;
  location_stale: boolean;
  evidence?: NetworkEvidence[];
  events?: {
    id: string;
    kind: string;
    captured_at: string;
    occurred_at: string;
    created_at: string;
    payload: Record<string, unknown>;
  }[];
}
export interface WarehouseListing {
  id: string;
  name: string;
  owner_id: string;
  city: string;
  address: string;
  country: string;
  facilities: string[];
  pools: {
    id: string;
    name: string;
    unit: string;
    capacity: string | number;
  }[];
}
export interface WarehouseOffer {
  quantity: string | number;
  id: string;
  base_price: string | number;
  handling_charge: string | number;
  tax_amount: string | number;
  currency: string;
  terms: string;
  valid_until: string;
}
export interface SpaceEnquiry {
  id: string;
  job_id: string;
  version: number;
  status: string;
  quantity: string | number;
  unit: string;
  starts_at: string;
  ends_at: string;
  selected_offer_id: string | null;
  requests: {
    id: string;
    owner_id: string;
    warehouse_name: string;
    pool_name: string;
    status: string;
    app_read_at?: string | null;
    push_delivery?: { status: string; last_error: string | null } | null;
    offers: WarehouseOffer[];
    email_delivery: {
      id: string;
      status: string;
      last_error: string | null;
    } | null;
  }[];
  reservations: {
    id: string;
    status: string;
    handovers: {
      action: string;
      captured_at: string;
      recipient: string;
      evidence_ids?: string[];
    }[];
  }[];
}
export interface NetworkList<T> {
  items: T[];
  commands: NetworkCommand[];
  network_available: boolean;
}

export const operationalRoles = [
  "ops",
  "ops_agent",
  "ops_manager",
  "manager",
  "org_admin",
  "admin",
];
export const managerRoles = ["ops_manager", "manager", "org_admin", "admin"];
export const taskLabels: Record<TaskKind, string> = {
  pickup: "Pickup",
  delivery: "Delivery",
  customs_export: "Export clearance",
  customs_import: "Import clearance",
};
export const documentTypes: Record<TaskKind, string[]> = {
  pickup: ["packing_list", "pickup_receipt", "delivery_order"],
  delivery: [
    "packing_list",
    "warehouse_receipt",
    "delivery_order",
    "proof_of_delivery",
  ],
  customs_export: [
    "commercial_invoice",
    "packing_list",
    "shipping_bill",
    "house_bill_of_lading",
    "air_waybill",
    "bill_of_lading",
    "hawb",
    "mawb",
    "hbl",
    "mbl",
  ],
  customs_import: [
    "commercial_invoice",
    "packing_list",
    "shipping_bill",
    "house_bill_of_lading",
    "air_waybill",
    "bill_of_lading",
    "hawb",
    "mawb",
    "hbl",
    "mbl",
    "delivery_order",
  ],
};
export const partnerNetwork = {
  partners: (q = "", capability = "") =>
    freight.get<Partner[]>("/partners", { q, capability }),
  warehouses: (city = "", facility = "") =>
    freight.get<WarehouseListing[]>("/partner-warehouses", { city, facility }),
  tasks: (jobId: string) =>
    freight.get<NetworkList<NetworkTask>>(`/jobs/${jobId}/assignments`),
  task: (jobId: string, taskId: string) =>
    freight.get<NetworkTask>(`/jobs/${jobId}/assignments/${taskId}`),
  space: (jobId: string) =>
    freight.get<NetworkList<SpaceEnquiry>>(`/jobs/${jobId}/space-requests`),
};
