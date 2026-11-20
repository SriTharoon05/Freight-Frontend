export type Json = Record<string, any>;
export interface Task extends Json {
  id: string;
  company_name: string;
  company_id: string;
  job_reference: string;
  kind: string;
  status: string;
  version: number;
  brief_version: number;
  acknowledged_brief_version: number;
  briefing: Json;
  instructions: string;
  required_proof: string[];
  tracking_session_id?: string;
  tracking_status: string;
}
export interface QueueItem {
  id: string;
  resource_id: string;
  kind: "action" | "upload" | "gps" | "handover";
  payload: Json;
  error: string | null;
}
export const labels: Record<string, string> = {
  pickup: "Pickup",
  delivery: "Delivery",
  customs_export: "Export clearance",
  customs_import: "Import clearance",
  pending_accept: "Awaiting acceptance",
  pending_confirmation: "Awaiting owner confirmation",
  awaiting_verification: "Awaiting staff verification",
  in_progress: "In progress",
};
export const label = (value: string) =>
  labels[value] || value.replaceAll("_", " ");
export const terminal = (status: string) =>
  ["completed", "cancelled", "rejected"].includes(status);
