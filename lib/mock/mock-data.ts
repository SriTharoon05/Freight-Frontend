/**
 * Centralised mock dataset for FreightOS frontend.
 * Every object is typed against lib/types.ts and internally consistent.
 *
 * Scenario coverage:
 *  - Happy path, empty states (wh-2 inventory []), pagination
 *  - Every status/severity/action_type enum represented
 *  - Edge values: expired license, over-limit credit, volatile lane, pending approvals
 *  - On-time / completion rates use 0–100 scale (matches UI formatting)
 */

import type {
  AuthResponse, User, DashboardStats, Exception, Shipment, ShipmentDetail,
  Document, Milestone, CommunicationLog, AgentAssignment, AutomationAudit,
  Quote, ApprovalQueueItem, AvailableAgent, Assignment, WarehouseBay,
  WarehouseInventory, Customer, CustomerDetail, RateCard, AutomationControl,
  AutomationControlHistory, Carrier, LaneStats, CarrierPerformance,
  VendorSuggestion, QuoteRequest, LaneCheckResult, Escalation,
  AssignmentManagerRow, AssignmentManagerStats,
  EmailAnalysisResponse, CrmCustomer, CrmCarrier, CrmAgent,
} from '../types';

// ─── time helpers (relative so data never looks stale) ───
const now = Date.now();
const hrs = (n: number) => new Date(now + n * 3600_000).toISOString();
const days = (n: number) => new Date(now + n * 86_400_000).toISOString();
const mins = (n: number) => new Date(now + n * 60_000).toISOString();

// ─── AUTH ───
export const mockUser: User = {
  id: 'usr-admin',
  email: 'admin@gmail.com',
  full_name: 'Dev Admin',
  role: 'org_admin',
  tenant_id: 'tenant-1',
  can_approve: true,
};

export const mockAuthResponse: AuthResponse = {
  refresh_token: 'mock-refresh-token',
  access_token: 'mock-access-token-freightos',
  user: mockUser,
};

export const mockUsers: User[] = [
  mockUser,
  { id: 'usr-2', email: 'priya@freightops.in', full_name: 'Priya Nair', role: 'ops_manager', tenant_id: 'tenant-1', can_approve: true },
  { id: 'usr-3', email: 'arjun@freightops.in', full_name: 'Arjun Rao', role: 'ops_agent', tenant_id: 'tenant-1', can_approve: false },
  { id: 'usr-4', email: 'viewer@freightops.in', full_name: 'Read Only', role: 'readonly', tenant_id: 'tenant-1', can_approve: false },
];

// ─── DASHBOARD ───
export const mockDashboardStats: DashboardStats = {
  active_count: 128,
  exceptions_open: 7,
  dd_risk_paise: 4_85_000_00,
  pickups_due_today: 14,
};

// ─── CARRIERS ───
export const carriers: Carrier[] = [
  { id: 'car-1', name: 'Maersk Line', mode: 'ocean', active: true },
  { id: 'car-2', name: 'Emirates SkyCargo', mode: 'air', active: true },
  { id: 'car-3', name: 'BlueDart Surface', mode: 'road', active: true },
  { id: 'car-4', name: 'CONCOR Rail', mode: 'rail', active: true },
  { id: 'car-5', name: 'Hapag-Lloyd', mode: 'ocean', active: false },
];

// ─── CUSTOMERS (also act as shippers) ───
export const customers: Customer[] = [
  { id: 'cust-1', name: 'Tata Steel Ltd', email: 'logistics@tatasteel.com', phone: '+91 98400 11111', gstin: '27AAACT2727Q1ZW', credit_limit_paise: 50_00_000_00, outstanding_paise: 12_40_000_00, address: 'Bombay House, Fort', city: 'Mumbai', created_at: days(-400) },
  { id: 'cust-2', name: 'Zoho Corporation', email: 'ship@zoho.com', phone: '+91 44 6900 0000', gstin: '33AAACZ1234R1Z5', credit_limit_paise: 20_00_000_00, outstanding_paise: 21_50_000_00, address: 'Estancia IT Park', city: 'Chennai', created_at: days(-320) },
  { id: 'cust-3', name: 'Amul Dairy', email: 'exports@amul.coop', phone: '+91 2692 258506', gstin: '24AAACG1234M1Z1', credit_limit_paise: 15_00_000_00, outstanding_paise: 3_20_000_00, address: 'Amul Dairy Rd', city: 'Anand', created_at: days(-210) },
  { id: 'cust-4', name: 'Ashok Leyland', email: 'freight@ashokleyland.com', phone: '+91 44 2220 6000', gstin: '33AAACA1234K1Z9', credit_limit_paise: 40_00_000_00, outstanding_paise: 0, address: 'Guindy Industrial Estate', city: 'Chennai', created_at: days(-500) },
  { id: 'cust-5', name: 'Britannia Industries', email: 'supplychain@britannia.co.in', phone: '+91 80 3940 0000', gstin: '29AAACB1234L1Z2', credit_limit_paise: 10_00_000_00, outstanding_paise: 8_90_000_00, address: 'Britannia Gardens', city: 'Bengaluru', created_at: days(-150) },
];

export const customerDetails: Record<string, CustomerDetail> = {
  'cust-1': { ...customers[0], total_shipments: 86, active_shipments: 9 },
  'cust-2': { ...customers[1], total_shipments: 54, active_shipments: 6 },
  'cust-3': { ...customers[2], total_shipments: 30, active_shipments: 2 },
  'cust-4': { ...customers[3], total_shipments: 120, active_shipments: 11 },
  'cust-5': { ...customers[4], total_shipments: 18, active_shipments: 1 },
};

// ─── SHIPMENTS ───
export const shipments: Shipment[] = [
  { id: 'shp-1', ref_number: 'SHP-24001', bl_number: 'MAEU123456789', container_number: 'MSKU7654321', status: 'in_transit', transport_mode: 'ocean', shipper_id: 'cust-1', shipper_name: 'Tata Steel Ltd', carrier_id: 'car-1', carrier_name: 'Maersk Line', origin: 'Nhava Sheva, IN', destination: 'Rotterdam, NL', etd: days(-6), eta: days(12), created_at: days(-8), updated_at: hrs(-3) },
  { id: 'shp-2', ref_number: 'SHP-24002', bl_number: 'EK98765', status: 'customs_hold', transport_mode: 'air', shipper_id: 'cust-2', shipper_name: 'Zoho Corporation', carrier_id: 'car-2', carrier_name: 'Emirates SkyCargo', origin: 'Chennai, IN', destination: 'Dubai, AE', etd: days(-1), eta: days(1), has_pending_approvals: true, free_time_expires_at: hrs(20), created_at: days(-3), updated_at: hrs(-1) },
  { id: 'shp-3', ref_number: 'SHP-24003', container_number: 'BLDR1122334', status: 'delivered', transport_mode: 'road', shipper_id: 'cust-3', shipper_name: 'Amul Dairy', carrier_id: 'car-3', carrier_name: 'BlueDart Surface', origin: 'Anand, IN', destination: 'Mumbai, IN', etd: days(-4), eta: days(-2), created_at: days(-5), updated_at: days(-2) },
  { id: 'shp-4', ref_number: 'SHP-24004', bl_number: 'MAEU555000111', container_number: 'MSKU0001112', status: 'exception', transport_mode: 'ocean', shipper_id: 'cust-1', shipper_name: 'Tata Steel Ltd', carrier_id: 'car-1', carrier_name: 'Maersk Line', origin: 'Mundra, IN', destination: 'Hamburg, DE', etd: days(-14), eta: days(3), has_pending_approvals: true, free_time_expires_at: hrs(-6), created_at: days(-15), updated_at: hrs(-5) },
  { id: 'shp-5', ref_number: 'SHP-24005', status: 'booked', transport_mode: 'air', shipper_id: 'cust-2', shipper_name: 'Zoho Corporation', carrier_id: 'car-2', carrier_name: 'Emirates SkyCargo', origin: 'Bengaluru, IN', destination: 'Singapore, SG', etd: days(2), eta: days(3), created_at: days(-1), updated_at: hrs(-8) },
  { id: 'shp-6', ref_number: 'SHP-24006', container_number: 'CONR9988776', status: 'assigned', transport_mode: 'rail', shipper_id: 'cust-4', shipper_name: 'Ashok Leyland', carrier_id: 'car-4', carrier_name: 'CONCOR Rail', origin: 'Chennai, IN', destination: 'New Delhi, IN', etd: days(1), eta: days(4), created_at: days(-2), updated_at: hrs(-12) },
  { id: 'shp-7', ref_number: 'SHP-24007', status: 'documentation_pending', transport_mode: 'ocean', shipper_id: 'cust-5', shipper_name: 'Britannia Industries', carrier_id: 'car-1', carrier_name: 'Maersk Line', origin: 'Kolkata, IN', destination: 'Colombo, LK', etd: days(5), eta: days(8), created_at: days(-1), updated_at: hrs(-2) },
  { id: 'shp-8', ref_number: 'SHP-24008', status: 'out_for_delivery', transport_mode: 'road', shipper_id: 'cust-3', shipper_name: 'Amul Dairy', carrier_id: 'car-3', carrier_name: 'BlueDart Surface', origin: 'Anand, IN', destination: 'Ahmedabad, IN', etd: hrs(-5), eta: hrs(2), created_at: days(-1), updated_at: mins(-30) },
];

export const shipmentDetails: Record<string, ShipmentDetail> = Object.fromEntries(
  shipments.map((s) => [s.id, {
    ...s,
    cargo_description: s.transport_mode === 'ocean'
      ? 'Cold-rolled steel coils, 20 x bundles, non-hazardous, palletised and shrink-wrapped for export'
      : 'Assorted electronic control units and spare components, fragile, temperature-sensitive',
    weight_kg: 18400,
    packages: 42,
    volume_cbm: 58.5,
    incoterm: 'FOB',
    booking_number: `BKG-${s.ref_number.slice(-4)}`,
    icegate_status: s.status === 'customs_hold' ? 'Under examination' : 'Cleared',
    shipper_address: '2nd Floor, Industrial Estate, Guindy',
    consignee: 'Global Imports GmbH',
    consignee_address: 'Hafenstrasse 12, Hamburg',
    value_paise: 32_50_000_00,
  }]),
) as Record<string, ShipmentDetail>;

// ─── EXCEPTIONS (all severities + all statuses) ───
export const exceptions: Exception[] = [
  { id: 'exc-1', shipment_id: 'shp-4', shipment_ref: 'SHP-24004', title: 'Free time expired — D&D charges accruing', description: 'Container still at port beyond free time. Demurrage now accruing daily.', severity: 'critical', status: 'open', dd_exposure_paise: 1_85_000_00, recommended_action: 'Expedite customs clearance and arrange immediate pickup.', created_at: hrs(-5), updated_at: hrs(-1) },
  { id: 'exc-2', shipment_id: 'shp-1', shipment_ref: 'SHP-24001', title: 'Vessel delayed by 48 hours', severity: 'high', status: 'open', dd_exposure_paise: 42_000_00, recommended_action: 'Notify consignee of revised ETA.', created_at: hrs(-9) },
  { id: 'exc-3', shipment_id: 'shp-2', shipment_ref: 'SHP-24002', title: 'Missing commercial invoice for customs', severity: 'medium', status: 'acknowledged', recommended_action: 'Request invoice from shipper.', created_at: days(-1), updated_at: hrs(-4) },
  { id: 'exc-4', shipment_id: 'shp-3', shipment_ref: 'SHP-24003', title: 'Minor temperature deviation logged', severity: 'low', status: 'resolved', resolution_notes: 'Within tolerance after review. No action required.', created_at: days(-3), updated_at: days(-2) },
  { id: 'exc-5', shipment_id: 'shp-5', shipment_ref: 'SHP-24005', title: 'Carrier unresponsive to quote request', severity: 'high', status: 'escalated', dd_exposure_paise: 15_000_00, recommended_action: 'Escalated to ops manager for alternate carrier.', created_at: days(-1), updated_at: hrs(-6) },
  { id: 'exc-6', shipment_id: 'shp-7', shipment_ref: 'SHP-24007', title: 'Shipping bill not filed', severity: 'medium', status: 'open', created_at: hrs(-2) },
  { id: 'exc-7', shipment_id: 'shp-8', shipment_ref: 'SHP-24008', title: 'Delivery address unverified', severity: 'low', status: 'open', created_at: mins(-40) },
];

// ─── DOCUMENTS ───
export const documents: Document[] = [
  { id: 'doc-1', shipment_id: 'shp-1', shipment_ref: 'SHP-24001', document_type: 'commercial_invoice', status: 'verified', file_url: 'https://example.com/mock/ci-1.pdf', generated_at: days(-7), verified_at: days(-6), created_at: days(-7) },
  { id: 'doc-2', shipment_id: 'shp-1', shipment_ref: 'SHP-24001', document_type: 'house_bill_of_lading', status: 'generated', file_url: 'https://example.com/mock/hbl-1.pdf', generated_at: days(-6), created_at: days(-6) },
  { id: 'doc-3', shipment_id: 'shp-2', shipment_ref: 'SHP-24002', document_type: 'packing_list', status: 'pending', prerequisite: 'commercial_invoice', created_at: days(-2) },
  { id: 'doc-4', shipment_id: 'shp-4', shipment_ref: 'SHP-24004', document_type: 'shipping_bill', status: 'failed', created_at: days(-3) },
  { id: 'doc-5', shipment_id: 'shp-3', shipment_ref: 'SHP-24003', document_type: 'proof_of_delivery', status: 'verified', file_url: 'https://example.com/mock/pod-3.pdf', generated_at: days(-2), verified_at: days(-2), created_at: days(-2) },
  { id: 'doc-6', shipment_id: 'shp-8', shipment_ref: 'SHP-24008', document_type: 'pickup_receipt', status: 'generated', file_url: 'https://example.com/mock/pickup-8.pdf', generated_at: hrs(-5), created_at: hrs(-5) },
  { id: 'doc-7', shipment_id: 'shp-7', shipment_ref: 'SHP-24007', document_type: 'commercial_invoice', status: 'verified', file_url: 'https://example.com/mock/ci-7.pdf', generated_at: hrs(-6), verified_at: hrs(-3), created_at: hrs(-6) },
  { id: 'doc-8', shipment_id: 'shp-6', shipment_ref: 'SHP-24006', document_type: 'warehouse_receipt', status: 'generated', file_url: 'https://example.com/mock/wh-6.pdf', generated_at: hrs(-14), created_at: hrs(-14) },
];

// ─── MILESTONES (per shipment) ───
export const milestonesByShipment: Record<string, Milestone[]> = {
  'shp-1': [
    { id: 'ms-1', shipment_id: 'shp-1', status: 'booked', label: 'Booking confirmed', completed: true, completed_at: days(-8), location: 'Nhava Sheva' },
    { id: 'ms-2', shipment_id: 'shp-1', status: 'loaded', label: 'Loaded on vessel', completed: true, completed_at: days(-6), location: 'Nhava Sheva' },
    { id: 'ms-3', shipment_id: 'shp-1', status: 'departed', label: 'Vessel departed', completed: true, completed_at: days(-6), location: 'Nhava Sheva' },
    { id: 'ms-4', shipment_id: 'shp-1', status: 'in_transit', label: 'In transit', completed: true, completed_at: days(-5), location: 'Arabian Sea' },
    { id: 'ms-5', shipment_id: 'shp-1', status: 'arrived', label: 'Arrival at destination', completed: false, location: 'Rotterdam' },
    { id: 'ms-6', shipment_id: 'shp-1', status: 'delivered', label: 'Delivered', completed: false, location: 'Rotterdam' },
  ],
  'shp-4': [
    { id: 'ms4-1', shipment_id: 'shp-4', status: 'booked', label: 'Booking confirmed', completed: true, completed_at: days(-15), location: 'Mundra' },
    { id: 'ms4-2', shipment_id: 'shp-4', status: 'at_port', label: 'Arrived at port', completed: true, completed_at: days(-2), location: 'Hamburg' },
    { id: 'ms4-3', shipment_id: 'shp-4', status: 'customs_hold', label: 'Held at customs', completed: true, completed_at: hrs(-6), location: 'Hamburg' },
    { id: 'ms4-4', shipment_id: 'shp-4', status: 'customs_cleared', label: 'Customs cleared', completed: false, location: 'Hamburg' },
  ],
  'shp-8': [
    { id: 'ms8-1', shipment_id: 'shp-8', status: 'booked', label: 'Booking confirmed', completed: true, completed_at: days(-1), location: 'Anand' },
    { id: 'ms8-2', shipment_id: 'shp-8', status: 'picked_up', label: 'Picked up', completed: true, completed_at: hrs(-5), location: 'Anand' },
    { id: 'ms8-3', shipment_id: 'shp-8', status: 'out_for_delivery', label: 'Out for delivery', completed: true, completed_at: mins(-30), location: 'Ahmedabad' },
    { id: 'ms8-4', shipment_id: 'shp-8', status: 'delivered', label: 'Delivered', completed: false, location: 'Ahmedabad' },
  ],
};

// ─── COMMUNICATIONS (per shipment) ───
export const communicationsByShipment: Record<string, CommunicationLog[]> = {
  'shp-1': [
    { id: 'cm-1', shipment_id: 'shp-1', channel: 'email', direction: 'outbound', subject: 'Booking confirmation SHP-24001', body: 'Your booking has been confirmed.', recipient: 'logistics@tatasteel.com', sender: 'ops@freightops.in', sent_at: days(-8) },
    { id: 'cm-2', shipment_id: 'shp-1', channel: 'whatsapp', direction: 'inbound', body: 'Thanks, please share the BL once loaded.', sender: '+91 98400 11111', sent_at: days(-7) },
    { id: 'cm-3', shipment_id: 'shp-1', channel: 'email', direction: 'outbound', subject: 'Vessel departed', body: 'Vessel has departed Nhava Sheva.', recipient: 'logistics@tatasteel.com', sender: 'ops@freightops.in', sent_at: days(-6) },
  ],
  'shp-4': [
    { id: 'cm4-1', shipment_id: 'shp-4', channel: 'email', direction: 'inbound', subject: 'URGENT: container stuck', body: 'Please expedite, we are incurring charges.', sender: 'logistics@tatasteel.com', recipient: 'ops@freightops.in', sent_at: hrs(-6) },
    { id: 'cm4-2', shipment_id: 'shp-4', channel: 'email', direction: 'outbound', subject: 'RE: URGENT: container stuck', body: 'Escalating with customs, update in 2h.', recipient: 'logistics@tatasteel.com', sender: 'ops@freightops.in', sent_at: hrs(-5) },
  ],
  'shp-8': [
    { id: 'cm8-1', shipment_id: 'shp-8', channel: 'sms', direction: 'outbound', body: 'Your delivery is out for delivery and will arrive today.', recipient: '+91 2692 258506', sender: 'FRTOPS', sent_at: mins(-25) },
  ],
};

// ─── AGENT ASSIGNMENTS (per shipment) ───
export const assignmentsByShipment: Record<string, AgentAssignment[]> = {
  'shp-8': [
    { id: 'as-1', shipment_id: 'shp-8', shipment_ref: 'SHP-24008', agent_id: 'agt-1', agent_name: 'Ravi Kumar', agent_phone: '+91 90000 11111', vehicle_number: 'TN-01-AB-1234', status: 'in_progress', lat: 22.3, lng: 72.6, assigned_at: hrs(-5) },
  ],
  'shp-3': [
    { id: 'as-2', shipment_id: 'shp-3', shipment_ref: 'SHP-24003', agent_id: 'agt-2', agent_name: 'Sunita Devi', agent_phone: '+91 90000 22222', vehicle_number: 'GJ-05-CD-5678', status: 'completed', lat: 19.0, lng: 72.8, assigned_at: days(-3), completed_at: days(-2) },
  ],
};

// ─── AUTOMATION AUDIT (per shipment + global) ───
export const automationAudit: AutomationAudit[] = [
  { id: 'au-1', shipment_id: 'shp-1', action: 'auto_generate_hbl', mode: 'auto', executed_by: 'system', outcome: 'success', created_at: days(-6) },
  { id: 'au-2', shipment_id: 'shp-2', action: 'send_quote_request', mode: 'human_approve', executed_by: 'usr-2', outcome: 'pending', created_at: hrs(-4) },
  { id: 'au-3', shipment_id: 'shp-4', action: 'file_shipping_bill', mode: 'auto', executed_by: 'system', outcome: 'failed', created_at: days(-3) },
  { id: 'au-4', shipment_id: 'shp-5', action: 'carrier_selection', mode: 'human_only', executed_by: 'usr-3', outcome: 'rejected', created_at: days(-1) },
  { id: 'au-5', shipment_id: 'shp-8', action: 'auto_assign_agent', mode: 'auto', executed_by: 'system', outcome: 'success', created_at: hrs(-5) },
];

// ─── QUOTES (per shipment) ───
export const quotesByShipment: Record<string, Quote[]> = {
  'shp-1': [
    { id: 'q-1', shipment_id: 'shp-1', carrier_name: 'Maersk Line', amount_paise: 4_20_000_00, currency: 'INR', valid_until: days(5), status: 'accepted', created_at: days(-9) },
    { id: 'q-2', shipment_id: 'shp-1', carrier_name: 'Hapag-Lloyd', amount_paise: 4_65_000_00, currency: 'INR', valid_until: days(3), status: 'rejected', created_at: days(-9) },
  ],
  'shp-2': [
    { id: 'q-3', shipment_id: 'shp-2', carrier_name: 'Emirates SkyCargo', amount_paise: 2_10_000_00, currency: 'INR', valid_until: days(2), status: 'sent', created_at: hrs(-8) },
  ],
  'shp-5': [
    { id: 'q-4', shipment_id: 'shp-5', carrier_name: 'Emirates SkyCargo', amount_paise: 1_80_000_00, currency: 'INR', valid_until: days(4), status: 'draft', created_at: hrs(-6) },
  ],
};

// ─── APPROVAL QUEUE ───
// The Approvals page loads ONLY status:'pending' then filters client-side by
// action_type (Quote/Assignment/Document/Milestone/Exception/Invoice). So we
// supply multiple PENDING items for EVERY action type, each with prepared_data
// that formatPreparedData() reads, plus varied expiry (some urgent < 15 min)
// and a few non-pending items for the other status views.
export const approvalQueue: ApprovalQueueItem[] = [
  // QUOTE
  { id: 'apq-q1', action_type: 'quote', shipment_id: 'shp-2', shipment_ref: 'SHP-24002', summary: 'Send carrier quote of ₹2,10,000 to Emirates SkyCargo', ai_recommendation: 'Recommended — 8% below the 90-day lane average.', status: 'pending', expires_at: hrs(4), created_at: hrs(-2), prepared_data: { amount_paise: 2_10_000_00, recipient_email: 'quotes@emirates.com', carrier_name: 'Emirates SkyCargo' } },
  { id: 'apq-q2', action_type: 'quote', shipment_id: 'shp-1', shipment_ref: 'SHP-24001', summary: 'Send ocean freight quote of ₹4,20,000 to Tata Steel', ai_recommendation: 'In line with contracted rate card.', status: 'pending', expires_at: mins(12), created_at: hrs(-5), prepared_data: { amount_paise: 4_20_000_00, recipient_email: 'logistics@tatasteel.com', carrier_name: 'Maersk Line' } },
  // ASSIGNMENT
  { id: 'apq-a1', action_type: 'assignment', shipment_id: 'shp-8', shipment_ref: 'SHP-24008', summary: 'Assign pickup agent Mohan Das for Anand pickup', ai_recommendation: 'Closest available agent with highest score.', status: 'pending', expires_at: hrs(2), created_at: hrs(-1), prepared_data: { agent_name: 'Mohan Das', distance_km: 4.2, score: 92, agent_id: 'agt-3' } },
  { id: 'apq-a2', action_type: 'assignment', shipment_id: 'shp-6', shipment_ref: 'SHP-24006', summary: 'Assign rail slot handler for CONCOR booking', ai_recommendation: 'Karthik S is available and rail-certified.', status: 'pending', expires_at: hrs(6), created_at: hrs(-3), prepared_data: { agent_name: 'Karthik S', distance_km: 7.8, score: 85, agent_id: 'agt-4' } },
  // DOCUMENT
  { id: 'apq-d1', action_type: 'document', shipment_id: 'shp-7', shipment_ref: 'SHP-24007', summary: 'Auto-generate shipping bill for Britannia export', ai_recommendation: 'All prerequisites met.', status: 'pending', expires_at: hrs(8), created_at: hrs(-4), prepared_data: { document_type: 'shipping_bill', shipment_ref: 'SHP-24007' } },
  { id: 'apq-d2', action_type: 'document', shipment_id: 'shp-2', shipment_ref: 'SHP-24002', summary: 'Generate house bill of lading', ai_recommendation: 'Draft prepared from booking data.', status: 'pending', expires_at: mins(9), created_at: hrs(-6), prepared_data: { document_type: 'house_bill_of_lading', shipment_ref: 'SHP-24002' } },
  // MILESTONE
  { id: 'apq-m1', action_type: 'milestone', shipment_id: 'shp-1', shipment_ref: 'SHP-24001', summary: 'Confirm "Arrived at Rotterdam" milestone', ai_recommendation: 'Carrier tracking event received.', status: 'pending', expires_at: hrs(3), created_at: mins(-45), prepared_data: { milestone: 'arrived', location: 'Rotterdam' } },
  { id: 'apq-m2', action_type: 'milestone', shipment_id: 'shp-8', shipment_ref: 'SHP-24008', summary: 'Mark "Out for delivery" as complete', ai_recommendation: 'Agent GPS confirms departure.', status: 'pending', expires_at: hrs(5), created_at: mins(-20), prepared_data: { milestone: 'out_for_delivery', location: 'Ahmedabad' } },
  // EXCEPTION
  { id: 'apq-e1', action_type: 'exception', shipment_id: 'shp-4', shipment_ref: 'SHP-24004', summary: 'Approve demurrage escalation for stuck container', ai_recommendation: 'Free time expired 6h ago.', status: 'pending', expires_at: mins(5), created_at: hrs(-6), prepared_data: { severity: 'critical', dd_exposure_paise: 1_85_000_00 } },
  { id: 'apq-e2', action_type: 'exception', shipment_id: 'shp-5', shipment_ref: 'SHP-24005', summary: 'Approve alternate-carrier fallback (vendor no-response)', ai_recommendation: 'Primary carrier unresponsive for 6h.', status: 'pending', expires_at: hrs(1), created_at: hrs(-2), prepared_data: { severity: 'high' } },
  // INVOICE
  { id: 'apq-i1', action_type: 'invoice', shipment_id: 'shp-3', shipment_ref: 'SHP-24003', summary: 'Raise final invoice of ₹1,20,000 for delivered shipment', ai_recommendation: 'Delivery confirmed with POD.', status: 'pending', expires_at: hrs(12), created_at: hrs(-8), prepared_data: { amount_paise: 1_20_000_00, recipient_email: 'exports@amul.coop' } },
  { id: 'apq-i2', action_type: 'invoice', shipment_id: 'shp-1', shipment_ref: 'SHP-24001', summary: 'Approve interim invoice for ocean freight', ai_recommendation: 'Partial billing per contract milestone.', status: 'pending', expires_at: hrs(20), created_at: hrs(-10), prepared_data: { amount_paise: 2_00_000_00, recipient_email: 'logistics@tatasteel.com' } },
  // carrier_selection (shows under "All")
  { id: 'apq-c1', action_type: 'carrier_selection', shipment_id: 'shp-4', shipment_ref: 'SHP-24004', summary: 'Select alternate carrier after 48h delay', ai_recommendation: 'Switch to Hapag-Lloyd for faster transit.', status: 'pending', expires_at: hrs(1), created_at: hrs(-6), prepared_data: { carrier_name: 'Hapag-Lloyd' } },
  // non-pending (for approved / rejected / expired / auto_approved views)
  { id: 'apq-h1', action_type: 'document', shipment_id: 'shp-7', shipment_ref: 'SHP-24007', summary: 'Auto-generate packing list', status: 'approved', created_at: days(-1), updated_at: hrs(-10) },
  { id: 'apq-h2', action_type: 'invoice', shipment_id: 'shp-3', shipment_ref: 'SHP-24003', summary: 'Interim invoice auto-approved on timeout', status: 'auto_approved', created_at: days(-2), updated_at: days(-2) },
  { id: 'apq-h3', action_type: 'assignment', shipment_id: 'shp-6', shipment_ref: 'SHP-24006', summary: 'Assign rail slot for CONCOR booking', status: 'rejected', note: 'Slot unavailable', created_at: days(-1), updated_at: hrs(-20) },
  { id: 'apq-h4', action_type: 'rate_card', summary: 'Publish updated ocean rate card Q3', status: 'expired', created_at: days(-3) },
];

// Matches app/approvals/page.tsx: pending_count, urgent_count, by_type
export const approvalSummary = {
  pending_count: approvalQueue.filter((a) => a.status === 'pending').length,
  urgent_count: approvalQueue.filter((a) => a.status === 'pending' && a.expires_at && new Date(a.expires_at).getTime() - Date.now() < 15 * 60_000).length,
  by_type: approvalQueue.filter((a) => a.status === 'pending').reduce((acc, a) => {
    acc[a.action_type] = (acc[a.action_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>),
};

// ─── ASSIGNMENTS + AVAILABLE AGENTS ───
export const assignments: Assignment[] = [
  { id: 'asg-1', shipment_id: 'shp-8', shipment_ref: 'SHP-24008', agent_id: 'agt-1', agent_name: 'Ravi Kumar', agent_phone: '+91 90000 11111', vehicle_number: 'TN-01-AB-1234', status: 'in_progress', lat: 22.3, lng: 72.6, assigned_at: hrs(-5) },
  { id: 'asg-2', shipment_id: 'shp-3', shipment_ref: 'SHP-24003', agent_id: 'agt-2', agent_name: 'Sunita Devi', agent_phone: '+91 90000 22222', vehicle_number: 'GJ-05-CD-5678', status: 'completed', assigned_at: days(-3), completed_at: days(-2) },
];

export const availableAgents: AvailableAgent[] = [
  { id: 'agt-3', name: 'Mohan Das', phone: '+91 90000 33333', vehicle_number: 'TN-09-EF-9012', status: 'available', lat: 13.08, lng: 80.27, distance_km: 4.2, score: 92 },
  { id: 'agt-4', name: 'Karthik S', phone: '+91 90000 44444', vehicle_number: 'TN-11-GH-3456', status: 'available', lat: 13.01, lng: 80.21, distance_km: 7.8, score: 85 },
  { id: 'agt-1', name: 'Ravi Kumar', phone: '+91 90000 11111', vehicle_number: 'TN-01-AB-1234', status: 'on_job', lat: 22.3, lng: 72.6, current_shipment_ref: 'SHP-24008', score: 88 },
  { id: 'agt-5', name: 'Imran Sheikh', phone: '+91 90000 55555', vehicle_number: 'TN-22-IJ-7890', status: 'offline', lat: 13.05, lng: 80.24, score: 76 },
];

// ─── WAREHOUSE ───
export const warehouseBays: WarehouseBay[] = [
  { id: 'bay-1', warehouse_id: 'wh-1', bay_number: 'A-01', status: 'occupied', shipment_ref: 'SHP-24008', occupied_since: hrs(-6) },
  { id: 'bay-2', warehouse_id: 'wh-1', bay_number: 'A-02', status: 'available' },
  { id: 'bay-3', warehouse_id: 'wh-1', bay_number: 'A-03', status: 'reserved', shipment_ref: 'SHP-24007' },
  { id: 'bay-4', warehouse_id: 'wh-1', bay_number: 'B-01', status: 'maintenance' },
  { id: 'bay-5', warehouse_id: 'wh-2', bay_number: 'C-01', status: 'available' },
];

// wh-1 has inventory, wh-2 is intentionally EMPTY (empty-state scenario)
export const warehouseInventory: WarehouseInventory[] = [
  { id: 'inv-1', warehouse_id: 'wh-1', shipment_id: 'shp-8', shipment_ref: 'SHP-24008', cargo_description: 'Chilled dairy cartons', packages: 120, weight_kg: 2400, received_at: hrs(-6), status: 'stored' },
  { id: 'inv-2', warehouse_id: 'wh-1', shipment_id: 'shp-3', shipment_ref: 'SHP-24003', cargo_description: 'Butter blocks', packages: 60, weight_kg: 1500, received_at: days(-2), status: 'dispatched' },
];

// ─── RATE CARDS ───
export const rateCards: RateCard[] = [
  { id: 'rc-1', carrier_id: 'car-1', carrier_name: 'Maersk Line', origin: 'Nhava Sheva, IN', destination: 'Rotterdam, NL', mode: 'ocean', base_rate_paise: 4_00_000_00, markup_percent: 12, valid_from: days(-30), valid_until: days(60), active: true, lane_volatile: false, created_at: days(-30) },
  { id: 'rc-2', carrier_id: 'car-2', carrier_name: 'Emirates SkyCargo', origin: 'Chennai, IN', destination: 'Dubai, AE', mode: 'air', base_rate_paise: 1_80_000_00, markup_percent: 18, valid_from: days(-15), valid_until: days(15), active: true, lane_volatile: true, created_at: days(-15) },
  { id: 'rc-3', carrier_id: 'car-3', carrier_name: 'BlueDart Surface', origin: 'Anand, IN', destination: 'Mumbai, IN', mode: 'road', base_rate_paise: 45_000_00, markup_percent: 10, valid_from: days(-60), active: true, created_at: days(-60) },
  { id: 'rc-4', carrier_id: 'car-4', carrier_name: 'CONCOR Rail', origin: 'Chennai, IN', destination: 'New Delhi, IN', mode: 'rail', base_rate_paise: 90_000_00, markup_percent: 8, valid_from: days(-90), valid_until: days(-1), active: false, created_at: days(-90) },
];

// ─── AUTOMATION CONTROLS ───
export const automationControls: AutomationControl[] = [
  { id: 'ac-1', action_type: 'quote', label: 'Quote generation', description: 'Auto-generate customer quotes from rate cards.', mode: 'human_approve', approval_timeout_mins: 60, auto_approve_on_timeout: false, escalate_after_mins: 120, escalate_to_user_id: 'usr-2', escalate_to_user_name: 'Priya Nair' },
  { id: 'ac-2', action_type: 'document', label: 'Document generation', description: 'Auto-generate shipping documents.', mode: 'full_auto', approval_timeout_mins: 0, auto_approve_on_timeout: true, escalate_after_mins: 0 },
  { id: 'ac-3', action_type: 'carrier_selection', label: 'Carrier selection', description: 'Select carrier based on lane performance.', mode: 'human_only', approval_timeout_mins: 240, auto_approve_on_timeout: false, escalate_after_mins: 480, escalate_to_user_id: 'usr-2', escalate_to_user_name: 'Priya Nair' },
];

export const automationControlHistory: AutomationControlHistory[] = [
  { id: 'ach-1', control_id: 'ac-1', action_type: 'quote', changed_by: 'Dev Admin', old_mode: 'full_auto', new_mode: 'human_approve', changed_at: days(-5) },
  { id: 'ach-2', control_id: 'ac-3', action_type: 'carrier_selection', changed_by: 'Priya Nair', old_mode: 'human_approve', new_mode: 'human_only', changed_at: days(-2) },
];

// ─── ANALYTICS ───
export const ddSaved = { total_paise: 18_60_000_00, prevented_count: 34 };

// ─── VENDOR INTELLIGENCE (on_time_rate on 0–100 scale) ───
export const laneStats: LaneStats[] = [
  { carrier_id: 'car-1', carrier_name: 'Maersk Line', transport_mode: 'ocean', origin_country: 'IN', dest_country: 'NL', shipments_90d: 42, on_time_rate: 94, avg_transit_days: 22 },
  { carrier_id: 'car-2', carrier_name: 'Emirates SkyCargo', transport_mode: 'air', origin_country: 'IN', dest_country: 'AE', shipments_90d: 88, on_time_rate: 97, avg_transit_days: 1 },
  { carrier_id: 'car-4', carrier_name: 'CONCOR Rail', transport_mode: 'rail', origin_country: 'IN', dest_country: 'IN', shipments_90d: 120, on_time_rate: 89, avg_transit_days: 3 },
  { carrier_id: 'car-3', carrier_name: 'BlueDart Surface', transport_mode: 'road', origin_country: 'IN', dest_country: 'IN', shipments_90d: 65, on_time_rate: 68, avg_transit_days: 2 },
];

export const vendorSuggestions: VendorSuggestion[] = [
  { carrier_id: 'car-1', carrier_name: 'Maersk Line', reason: 'Best on-time rate on this lane (94%).', estimated_cost_paise: 4_20_000_00, estimated_transit_days: 22, score: 94 },
  { carrier_id: 'car-5', carrier_name: 'Hapag-Lloyd', reason: 'Cheaper but slower alternative.', estimated_cost_paise: 3_95_000_00, estimated_transit_days: 26, score: 81 },
];

export const carrierPerformance: CarrierPerformance = {
  carrier_id: 'car-1',
  carrier_name: 'Maersk Line',
  total_shipments: 210,
  on_time_rate: 93,
  avg_transit_days: 23,
  lanes: [
    { origin_country: 'IN', dest_country: 'NL', count: 42, on_time_rate: 94, avg_transit_days: 22 },
    { origin_country: 'IN', dest_country: 'DE', count: 30, on_time_rate: 90, avg_transit_days: 24 },
  ],
};

// ─── VENDOR QUOTES ───
export const quoteRequests: QuoteRequest[] = [
  { id: 'qr-1', shipment_id: 'shp-2', shipment_ref: 'SHP-24002', carrier_id: 'car-2', carrier_name: 'Emirates SkyCargo', carrier_contact_email: 'quotes@emirates.com', status: 'responded', sent_at: hrs(-8), responded_at: hrs(-3), expiry_at: hrs(16), response_options: [
    { option_name: 'Standard', amount_paise: 2_10_000_00, transit_days: 2, notes: 'Next available flight.' },
    { option_name: 'Express', amount_paise: 2_75_000_00, transit_days: 1 },
  ], selected_option_index: 0 },
  { id: 'qr-2', shipment_id: 'shp-5', shipment_ref: 'SHP-24005', carrier_id: 'car-2', carrier_name: 'Emirates SkyCargo', status: 'pending', sent_at: hrs(-4), expiry_at: hrs(20) },
  { id: 'qr-3', shipment_id: 'shp-4', shipment_ref: 'SHP-24004', carrier_id: 'car-5', carrier_name: 'Hapag-Lloyd', status: 'expired', sent_at: days(-3), expiry_at: days(-1) },
  { id: 'qr-4', shipment_id: 'shp-1', shipment_ref: 'SHP-24001', carrier_id: 'car-1', carrier_name: 'Maersk Line', status: 'rejected', sent_at: days(-2), responded_at: days(-1) },
];

export const laneCheck: LaneCheckResult = {
  lane_volatile: true,
  rate_card_available: true,
  message: 'This lane is marked volatile — rates may change before booking. A valid rate card exists.',
};

// ─── ESCALATIONS (all types) ───
export const escalations: Escalation[] = [
  { id: 'esc-1', type: 'vendor_no_response', shipment_id: 'shp-5', shipment_ref: 'SHP-24005', triggered_at: hrs(-6), minutes_open: 360, status: 'open' },
  { id: 'esc-2', type: 'stale_shipment', shipment_id: 'shp-4', shipment_ref: 'SHP-24004', triggered_at: hrs(-12), minutes_open: 720, status: 'open' },
  { id: 'esc-3', type: 'approval_timeout', shipment_id: 'shp-2', shipment_ref: 'SHP-24002', triggered_at: days(-1), minutes_open: 90, status: 'resolved', resolved_at: hrs(-2), note: 'Approved manually by ops manager.' },
];

// ─── ASSIGNMENT MANAGER ───
export const assignmentManagerRows: AssignmentManagerRow[] = [
  { shipment_id: 'shp-8', shipment_ref: 'SHP-24008', route: 'Anand → Ahmedabad', origin: 'Anand, IN', destination: 'Ahmedabad, IN', cargo_description: 'Chilled dairy cartons', status: 'out_for_delivery', agent_id: 'agt-1', agent_name: 'Ravi Kumar', agent_phone: '+91 90000 11111', carrier_id: 'car-3', carrier_name: 'BlueDart Surface', last_update: mins(-30), minutes_since_update: 30, escalation_count: 0, transport_mode: 'road' },
  { shipment_id: 'shp-6', shipment_ref: 'SHP-24006', route: 'Chennai → New Delhi', origin: 'Chennai, IN', destination: 'New Delhi, IN', status: 'assigned', carrier_id: 'car-4', carrier_name: 'CONCOR Rail', last_update: hrs(-12), minutes_since_update: 720, escalation_count: 0, transport_mode: 'rail' },
  { shipment_id: 'shp-4', shipment_ref: 'SHP-24004', route: 'Mundra → Hamburg', origin: 'Mundra, IN', destination: 'Hamburg, DE', status: 'exception', carrier_id: 'car-1', carrier_name: 'Maersk Line', last_update: hrs(-5), minutes_since_update: 300, escalation_count: 2, transport_mode: 'ocean' },
  { shipment_id: 'shp-5', shipment_ref: 'SHP-24005', route: 'Bengaluru → Singapore', origin: 'Bengaluru, IN', destination: 'Singapore, SG', status: 'booked', last_update: hrs(-8), minutes_since_update: 480, escalation_count: 1, transport_mode: 'air' },
];

export const assignmentManagerStats: AssignmentManagerStats = {
  total_active: 128,
  unassigned: 9,
  awaiting_vendor: 5,
  stale_gt_30: 3,
};

// ─── EMAIL ANALYSIS (per shipment) ───
export const emailAnalysisByShipment: Record<string, EmailAnalysisResponse> = {
  'shp-4': {
    emails: [
      { id: 'em-1', direction: 'inbound', from_email: 'logistics@tatasteel.com', to_emails: ['ops@freightops.in'], subject: 'URGENT: SHP-24004 stuck at port', body: 'Our container is still not cleared. We are incurring charges. Please expedite immediately.', received_at: hrs(-6), intent: 'complaint' },
      { id: 'em-2', direction: 'outbound', from_email: 'ops@freightops.in', to_emails: ['logistics@tatasteel.com'], subject: 'RE: URGENT: SHP-24004 stuck at port', body: 'We are escalating with customs and will update you within 2 hours.', received_at: hrs(-5), intent: 'response' },
    ],
    analysis: {
      shipment_id: 'shp-4',
      priority: 'critical',
      sentiment: 'urgent',
      summary: 'Customer is frustrated about a container held at port beyond free time and rising D&D charges.',
      action_required: true,
      action_description: 'Expedite customs clearance and confirm pickup slot with the customer.',
      key_dates: [{ date: days(-1), event: 'Free time expired' }, { date: hrs(6), event: 'Next demurrage tier begins' }],
      risk_flags: ['demurrage_accruing', 'customer_escalation', 'sla_breach'],
      analyzed_at: hrs(-4),
    },
  },
  'shp-1': {
    emails: [
      { id: 'em-3', direction: 'inbound', from_email: 'logistics@tatasteel.com', to_emails: ['ops@freightops.in'], subject: 'BL copy', body: 'Please share the BL once loaded.', received_at: days(-7), intent: 'request' },
    ],
    analysis: null, // not-yet-analysed scenario
  },
  'shp-2': {
    emails: [
      { id: 'em-4', direction: 'inbound', from_email: 'ship@zoho.com', to_emails: ['ops@freightops.in'], subject: 'Customs documents', body: 'Attaching the commercial invoice for customs clearance.', received_at: hrs(-10), intent: 'document_submission' },
    ],
    analysis: {
      shipment_id: 'shp-2',
      priority: 'high',
      sentiment: 'neutral',
      summary: 'Customer submitted customs documents; clearance pending examination.',
      action_required: true,
      action_description: 'Forward invoice to customs broker and track examination status.',
      key_dates: [{ date: hrs(20), event: 'Free time expires' }],
      risk_flags: ['customs_examination'],
      analyzed_at: hrs(-9),
    },
  },
};

// ─── CRM ───
export const crmCustomers: CrmCustomer[] = [
  { ...customers[0], contact_name: 'Rohan Mehta', credit_status: 'ok' },
  { ...customers[1], contact_name: 'Deepa Iyer', credit_status: 'over_limit' }, // outstanding > limit
  { ...customers[2], contact_name: 'Nikhil Shah', credit_status: 'ok' },
  { ...customers[3], contact_name: 'Lakshmi Menon', credit_status: 'ok' },
  { ...customers[4], contact_name: 'Vivek Anand', credit_status: 'overdue' },
];

// avg_on_time on 0–100 scale (UI does .toFixed(0) + '%')
export const crmCarriers: CrmCarrier[] = [
  { id: 'car-1', name: 'Maersk Line', code: 'MAEU', transport_mode: 'ocean', scac: 'MAEU', free_time_origin_days: 7, free_time_dest_days: 5, dd_rate_per_day_cents: 15000, lanes: 'IN-NL, IN-DE', avg_on_time: 93, active: true, created_at: days(-400) },
  { id: 'car-2', name: 'Emirates SkyCargo', code: 'EK', transport_mode: 'air', scac: 'EKGB', free_time_origin_days: 2, free_time_dest_days: 2, dd_rate_per_day_cents: 30000, lanes: 'IN-AE, IN-SG', avg_on_time: 97, active: true, created_at: days(-380) },
  { id: 'car-4', name: 'CONCOR Rail', code: 'CONR', transport_mode: 'rail', free_time_origin_days: 3, free_time_dest_days: 3, avg_on_time: 89, active: true, created_at: days(-350) },
  { id: 'car-5', name: 'Hapag-Lloyd', code: 'HLCU', transport_mode: 'ocean', scac: 'HLCU', avg_on_time: 88, active: false, created_at: days(-300) },
];

// completion_rate on 0–100 scale (UI does `${rate}%`)
export const crmAgents: CrmAgent[] = [
  { id: 'agt-1', full_name: 'Ravi Kumar', phone: '+91 90000 11111', email: 'ravi@fleet.in', vehicle_type: 'container_truck', vehicle_number: 'TN-01-AB-1234', license_number: 'DL-1420110012345', license_expiry: days(300), status: 'available', verification_status: 'verified', rating: 4.7, total_jobs: 210, completion_rate: 98, created_at: days(-200) },
  { id: 'agt-2', full_name: 'Sunita Devi', phone: '+91 90000 22222', vehicle_type: 'mini_truck', vehicle_number: 'GJ-05-CD-5678', license_number: 'GJ-0520110067890', license_expiry: days(120), status: 'available', verification_status: 'verified', rating: 4.5, total_jobs: 140, completion_rate: 96, created_at: days(-180) },
  { id: 'agt-6', full_name: 'Faizal Khan', phone: '+91 90000 66666', email: 'faizal@fleet.in', vehicle_type: 'truck', vehicle_number: 'MH-12-KL-2345', license_number: 'MH-1220110054321', license_expiry: days(-10), status: 'offline', verification_status: 'pending', rating: 0, total_jobs: 0, completion_rate: 0, created_at: days(-3) }, // EXPIRED license + pending verification
  { id: 'agt-7', full_name: 'Deepak Verma', phone: '+91 90000 77777', vehicle_type: 'container_truck', vehicle_number: 'DL-01-MN-6789', license_number: 'DL-0120110098765', license_expiry: days(60), status: 'suspended', verification_status: 'rejected', rejection_reason: 'License document illegible; resubmission required.', rating: 3.2, total_jobs: 12, completion_rate: 75, created_at: days(-90) },
];
