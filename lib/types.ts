export type Role = 'ops_manager' | 'org_admin' | 'ops_agent' | 'readonly';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  tenant_id: string;
  can_approve: boolean;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

export interface DashboardStats {
  active_count: number;
  exceptions_open: number;
  dd_risk_paise: number;
  pickups_due_today: number;
}

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type ExceptionStatus = 'open' | 'acknowledged' | 'resolved' | 'escalated';

export interface Exception {
  id: string;
  shipment_id: string;
  shipment_ref?: string;
  title: string;
  description?: string;
  severity: Severity;
  status: ExceptionStatus;
  dd_exposure_paise?: number;
  recommended_action?: string;
  resolution_notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface PaginatedExceptions {
  items: Exception[];
  total: number;
  page: number;
  limit: number;
}

export type ShipmentStatus =
  | 'draft' | 'booked' | 'assigned' | 'picked_up' | 'in_transit'
  | 'at_port' | 'customs_hold' | 'customs_cleared' | 'loaded' | 'departed'
  | 'arrived' | 'unloaded' | 'warehouse_received' | 'out_for_delivery'
  | 'delivered' | 'exception' | 'cancelled' | 'on_hold'
  | 'documentation_pending' | 'payment_pending' | 'confirmed'
  | 'loading' | 'discharging' | 'inspected' | 'released';

export interface Shipment {
  id: string;
  ref_number: string;
  bl_number?: string;
  container_number?: string;
  status: ShipmentStatus;
  transport_mode: 'ocean' | 'air' | 'road' | 'rail';
  shipper_id: string;
  shipper_name?: string;
  carrier_id?: string;
  carrier_name?: string;
  origin: string;
  destination: string;
  eta?: string;
  etd?: string;
  has_pending_approvals?: boolean;
  free_time_expires_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface PaginatedShipments {
  items: Shipment[];
  total: number;
  page: number;
  limit: number;
}

export interface ShipmentDetail extends Shipment {
  cargo_description?: string;
  weight_kg?: number;
  packages?: number;
  volume_cbm?: number;
  incoterm?: string;
  booking_number?: string;
  icegate_status?: string;
  shipper_address?: string;
  consignee?: string;
  consignee_address?: string;
  value_paise?: number;
}

export type DocumentType =
  | 'pickup_receipt' | 'warehouse_receipt' | 'commercial_invoice'
  | 'packing_list' | 'shipping_bill' | 'house_bill_of_lading' | 'proof_of_delivery';

export type DocumentStatus = 'pending' | 'generated' | 'verified' | 'failed';

export interface Document {
  id: string;
  shipment_id: string;
  shipment_ref?: string;
  document_type: DocumentType;
  status: DocumentStatus;
  file_url?: string;
  generated_at?: string;
  verified_at?: string;
  prerequisite?: DocumentType;
  created_at: string;
}

export interface Milestone {
  id: string;
  shipment_id: string;
  status: ShipmentStatus;
  label: string;
  completed: boolean;
  completed_at?: string;
  location?: string;
  notes?: string;
}

export interface CommunicationLog {
  id: string;
  shipment_id: string;
  channel: 'email' | 'whatsapp' | 'push' | 'sms';
  direction: 'outbound' | 'inbound';
  subject?: string;
  body?: string;
  recipient?: string;
  sender?: string;
  sent_at: string;
}

export interface AgentAssignment {
  id: string;
  shipment_id: string;
  shipment_ref?: string;
  agent_id: string;
  agent_name?: string;
  agent_phone?: string;
  vehicle_number?: string;
  status: 'assigned' | 'in_progress' | 'completed' | 'reassigned';
  lat?: number;
  lng?: number;
  assigned_at: string;
  completed_at?: string;
}

export interface AutomationAudit {
  id: string;
  shipment_id?: string;
  action: string;
  mode: 'auto' | 'human_approve' | 'human_only';
  executed_by: string;
  outcome: 'success' | 'failed' | 'pending' | 'rejected';
  input_snapshot?: Record<string, unknown>;
  output_snapshot?: Record<string, unknown>;
  created_at: string;
}

export interface Quote {
  id: string;
  shipment_id: string;
  carrier_name?: string;
  amount_paise: number;
  currency?: string;
  valid_until?: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  created_at: string;
}

export type ApprovalActionType =
  | 'quote' | 'assignment' | 'document' | 'milestone'
  | 'exception' | 'invoice' | 'rate_card' | 'shipment_update'
  | 'carrier_selection' | 'customs_filing';

export interface ApprovalQueueItem {
  id: string;
  action_type: ApprovalActionType;
  shipment_id?: string;
  shipment_ref?: string;
  summary: string;
  ai_recommendation?: string;
  prepared_data?: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'auto_approved';
  expires_at?: string;
  note?: string;
  created_at: string;
  updated_at?: string;
}

export interface AvailableAgent {
  id: string;
  name: string;
  phone?: string;
  vehicle_number?: string;
  status: 'available' | 'on_job' | 'offline';
  lat: number;
  lng: number;
  current_shipment_ref?: string;
  distance_km?: number;
  score?: number;
}

export interface Assignment {
  id: string;
  shipment_id: string;
  shipment_ref?: string;
  agent_id: string;
  agent_name?: string;
  agent_phone?: string;
  vehicle_number?: string;
  status: 'assigned' | 'in_progress' | 'completed' | 'reassigned';
  lat?: number;
  lng?: number;
  assigned_at: string;
  completed_at?: string;
}

export type BayStatus = 'available' | 'occupied' | 'reserved' | 'maintenance';

export interface WarehouseBay {
  id: string;
  warehouse_id: string;
  bay_number: string;
  status: BayStatus;
  shipment_ref?: string;
  occupied_since?: string;
}

export interface WarehouseInventory {
  id: string;
  warehouse_id: string;
  shipment_id: string;
  shipment_ref?: string;
  cargo_description?: string;
  packages: number;
  weight_kg?: number;
  received_at: string;
  status: string;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  gstin?: string;
  credit_limit_paise?: number;
  outstanding_paise?: number;
  address?: string;
  city?: string;
  created_at: string;
}

export interface CustomerDetail extends Customer {
  total_shipments?: number;
  active_shipments?: number;
}

export interface PaginatedCustomers {
  items: Customer[];
  total: number;
  page: number;
  limit: number;
}

export interface RateCard {
  id: string;
  carrier_id?: string;
  carrier_name?: string;
  origin: string;
  destination: string;
  mode: 'ocean' | 'air' | 'road' | 'rail';
  base_rate_paise: number;
  markup_percent: number;
  valid_from: string;
  valid_until?: string;
  active: boolean;
  lane_volatile?: boolean;
  created_at: string;
}

export type AutomationMode = 'full_auto' | 'human_approve' | 'human_only';

export interface AutomationControl {
  id: string;
  action_type: string;
  label: string;
  description: string;
  mode: AutomationMode;
  approval_timeout_mins: number;
  auto_approve_on_timeout: boolean;
  escalate_after_mins: number;
  escalate_to_user_id?: string;
  escalate_to_user_name?: string;
}

export interface AutomationControlHistory {
  id: string;
  control_id: string;
  action_type: string;
  changed_by: string;
  old_mode: AutomationMode;
  new_mode: AutomationMode;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  changed_at: string;
}

export interface Carrier {
  id: string;
  name: string;
  mode?: string;
  active: boolean;
}

export interface ApiError {
  status: number;
  message: string;
  detail?: unknown;
  fieldErrors?: Record<string, string[]>;
}

// ─── Vendor Intelligence ───

export interface LaneStats {
  carrier_id: string;
  carrier_name: string;
  transport_mode: string;
  origin_country: string;
  dest_country: string;
  shipments_90d: number;
  on_time_rate: number;
  avg_transit_days: number;
}

export interface PaginatedLaneStats {
  items: LaneStats[];
  total: number;
  page: number;
  limit: number;
}

export interface CarrierPerformance {
  carrier_id: string;
  carrier_name: string;
  total_shipments: number;
  on_time_rate: number;
  avg_transit_days: number;
  lanes: CarrierPerformanceLane[];
}

export interface CarrierPerformanceLane {
  origin_country: string;
  dest_country: string;
  count: number;
  on_time_rate: number;
  avg_transit_days: number;
}

export interface VendorSuggestion {
  carrier_id: string;
  carrier_name: string;
  reason: string;
  estimated_cost_paise?: number;
  estimated_transit_days?: number;
  score?: number;
}

// ─── Vendor Quotes ───

export type QuoteRequestStatus = 'pending' | 'responded' | 'expired' | 'rejected';

export interface QuoteResponseOption {
  option_name: string;
  amount_paise: number;
  transit_days: number;
  notes?: string;
}

export interface QuoteRequest {
  id: string;
  shipment_id: string;
  shipment_ref?: string;
  carrier_id: string;
  carrier_name?: string;
  carrier_contact_email?: string;
  status: QuoteRequestStatus;
  sent_at: string;
  responded_at?: string;
  expiry_at?: string;
  response_options?: QuoteResponseOption[];
  selected_option_index?: number;
}

export interface PaginatedQuoteRequests {
  items: QuoteRequest[];
  total: number;
  page: number;
  limit: number;
}

export interface LaneCheckResult {
  lane_volatile: boolean;
  rate_card_available: boolean;
  message: string;
}

// ─── Escalations ───

export type EscalationType = 'vendor_no_response' | 'stale_shipment' | 'approval_timeout';

export interface Escalation {
  id: string;
  type: EscalationType;
  shipment_id: string;
  shipment_ref?: string;
  triggered_at: string;
  minutes_open: number;
  status: 'open' | 'resolved';
  resolved_at?: string;
  note?: string;
}

export interface PaginatedEscalations {
  items: Escalation[];
  total: number;
  page: number;
  limit: number;
}

// ─── Approval Queue Summary ───

// ─── Approval Queue Summary ───
export interface ApprovalQueueSummary {
  pending_count: number;
  urgent_count: number;
  by_type: Record<string, number>;
}

// ─── Assignment Manager ───

export interface AssignmentManagerRow {
  shipment_id: string;
  shipment_ref: string;
  route: string;
  origin: string;
  destination: string;
  cargo_description?: string;
  status: ShipmentStatus;
  agent_id?: string;
  agent_name?: string;
  agent_phone?: string;
  carrier_id?: string;
  carrier_name?: string;
  last_update: string;
  minutes_since_update: number;
  escalation_count: number;
  transport_mode: string;
}

export interface PaginatedAssignmentManager {
  items: AssignmentManagerRow[];
  total: number;
  page: number;
  limit: number;
}

export interface AssignmentManagerStats {
  total_active: number;
  unassigned: number;
  awaiting_vendor: number;
  stale_gt_30: number;
}

// ─── Email Analysis ───

export interface EmailThreadItem {
  id: string;
  direction: 'inbound' | 'outbound';
  from_email: string;
  to_emails: string[];
  subject: string;
  body: string;
  received_at: string;
  intent?: string;
}

export interface EmailKeyDate {
  date: string;
  event: string;
}

export interface EmailAnalysis {
  shipment_id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  sentiment: 'positive' | 'neutral' | 'negative' | 'urgent';
  summary: string;
  action_required: boolean;
  action_description?: string;
  key_dates: EmailKeyDate[];
  risk_flags: string[];
  analyzed_at?: string;
}

export interface EmailAnalysisResponse {
  emails: EmailThreadItem[];
  analysis: EmailAnalysis | null;
}

// ─── CRM ───

export interface CrmCustomer extends Customer {
  contact_name?: string;
  credit_status?: 'ok' | 'overdue' | 'over_limit';
}

export interface CrmCarrier {
  id: string;
  name: string;
  code?: string;
  transport_mode: string;
  scac?: string;
  free_time_origin_days?: number;
  free_time_dest_days?: number;
  dd_rate_per_day_cents?: number;
  lanes?: string;
  avg_on_time?: number;
  active: boolean;
  created_at: string;
}

export interface CrmAgent {
  id: string;
  full_name: string;
  phone: string;
  email?: string;
  vehicle_type?: string;
  vehicle_number?: string;
  license_number?: string;
  license_expiry?: string;
  status: 'available' | 'offline' | 'suspended';
  verification_status: 'pending' | 'in_review' | 'verified' | 'rejected';
  rejection_reason?: string;
  rating?: number;
  total_jobs?: number;
  completion_rate?: number;
  created_at: string;
}

export interface PaginatedCrmAgents {
  items: CrmAgent[];
  total: number;
  page: number;
  limit: number;
}
