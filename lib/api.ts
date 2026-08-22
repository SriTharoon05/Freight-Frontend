import { api } from './api-client';
import type {
  AuthResponse, User, DashboardStats, Exception, PaginatedExceptions,
  Shipment, PaginatedShipments, ShipmentDetail, Document, Milestone,
  CommunicationLog, AgentAssignment, AutomationAudit, Quote,
  ApprovalQueueItem, AvailableAgent, Assignment, WarehouseBay,
  WarehouseInventory, Customer, CustomerDetail, PaginatedCustomers,
  RateCard, AutomationControl, AutomationControlHistory, Carrier,
  PaginatedLaneStats, VendorSuggestion, CarrierPerformance,
  PaginatedQuoteRequests, QuoteRequest, QuoteResponseOption, LaneCheckResult,
  PaginatedEscalations, Escalation, ApprovalQueueSummary,
  PaginatedAssignmentManager, AssignmentManagerStats,
  EmailAnalysisResponse,
  CrmCustomer, CrmCarrier, CrmAgent, PaginatedCrmAgents,
} from './types';

// AUTH
export const authApi = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/login', { email, password }).then((r) => r.data),
  refresh: () =>
    api.post<{ access_token: string }>('/refresh').then((r) => r.data),
  me: () =>
    api.get<User>('/me').then((r) => r.data),
  logout: () =>
    api.post('/logout').then((r) => r.data),
};

// DASHBOARD
export const dashboardApi = {
  stats: () =>
    api.get<DashboardStats>('/shipments/stats').then((r) => r.data),
  openExceptions: (limit = 10) =>
    api.get<Exception[]>('/exceptions', { params: { status: 'open', limit, sort: 'severity' } }).then((r) => r.data),
  recentShipments: (limit = 20) =>
    api.get<Shipment[]>('/shipments', { params: { limit, status: 'recent' } }).then((r) => r.data),
};

// APPROVALS
export const approvalsApi = {
  list: (status = 'pending', limit = 50) =>
    api.get<ApprovalQueueItem[]>('/automation/queue', { params: { status, limit } }).then((r) => r.data),
  get: (id: string) =>
    api.get<ApprovalQueueItem>(`/automation/queue/${id}`).then((r) => r.data),
  approve: (id: string, note?: string) =>
    api.post(`/automation/queue/${id}/approve`, { note }).then((r) => r.data),
  reject: (id: string, note: string) =>
    api.post(`/automation/queue/${id}/reject`, { note }).then((r) => r.data),
};

// SHIPMENTS
export const shipmentsApi = {
  list: (params: { page?: number; limit?: number; status?: string; search?: string; shipper_id?: string; carrier_id?: string; mode?: string }) =>
    api.get<PaginatedShipments>('/shipments', { params }).then((r) => r.data),
  get: (id: string) =>
    api.get<ShipmentDetail>(`/shipments/${id}`).then((r) => r.data),
  create: (body: Record<string, unknown>) =>
    api.post<Shipment>('/shipments', body).then((r) => r.data),
  updateStatus: (id: string, status: string, reason?: string) =>
    api.patch(`/shipments/${id}/status`, { status, reason }).then((r) => r.data),
  documents: (id: string) =>
    api.get<Document[]>(`/shipments/${id}/documents`).then((r) => r.data),
  milestones: (id: string) =>
    api.get<Milestone[]>(`/shipments/${id}/milestones`).then((r) => r.data),
  communications: (id: string) =>
    api.get<CommunicationLog[]>(`/shipments/${id}/communications`).then((r) => r.data),
  exceptions: (id: string) =>
    api.get<Exception[]>(`/shipments/${id}/exceptions`).then((r) => r.data),
  assignments: (id: string) =>
    api.get<AgentAssignment[]>(`/shipments/${id}/assignments`).then((r) => r.data),
  automationActivity: (id: string) =>
    api.get<AutomationAudit[]>(`/shipments/${id}/automation-activity`).then((r) => r.data),
  quotes: (id: string) =>
    api.get<Quote[]>(`/shipments/${id}/quotes`).then((r) => r.data),
  generateDocument: (id: string, document_type: string) =>
    api.post<Document>(`/shipments/${id}/documents/generate`, { document_type }).then((r) => r.data),
};

// ASSIGNMENTS
export const assignmentsApi = {
  list: (params: { date?: string; status?: string; limit?: number }) =>
    api.get<Assignment[]>('/assignments', { params }).then((r) => r.data),
  agentsAvailable: () =>
    api.get<AvailableAgent[]>('/agents/available').then((r) => r.data),
  reassign: (id: string, agent_id: string, reason: string) =>
    api.post(`/assignments/${id}/reassign`, { agent_id, reason }).then((r) => r.data),
};

// WAREHOUSE
export const warehouseApi = {
  bays: (warehouse_id?: string) =>
    api.get<WarehouseBay[]>('/warehouse/bays', { params: { warehouse_id } }).then((r) => r.data),
  inventory: (warehouse_id?: string, status?: string) =>
    api.get<WarehouseInventory[]>('/warehouse/inventory', { params: { warehouse_id, status } }).then((r) => r.data),
};

// DOCUMENTS
export const documentsApi = {
  list: (params: { type?: string; status?: string; from?: string; to?: string; limit?: number }) =>
    api.get<Document[]>('/documents', { params }).then((r) => r.data),
  download: (id: string) =>
    api.get<{ signed_url: string }>(`/documents/${id}/download`).then((r) => r.data),
};

// CUSTOMERS
export const customersApi = {
  list: (params: { search?: string; page?: number; limit?: number }) =>
    api.get<PaginatedCustomers>('/customers', { params }).then((r) => r.data),
  get: (id: string) =>
    api.get<CustomerDetail>(`/customers/${id}`).then((r) => r.data),
  shipments: (id: string) =>
    api.get<Shipment[]>(`/customers/${id}/shipments`).then((r) => r.data),
};

// RATES
export const ratesApi = {
  list: (params: { mode?: string; active?: boolean }) =>
    api.get<RateCard[]>('/rate-cards', { params }).then((r) => r.data),
  create: (body: Record<string, unknown>) =>
    api.post<RateCard>('/rate-cards', body).then((r) => r.data),
  update: (id: string, body: Record<string, unknown>) =>
    api.patch<RateCard>(`/rate-cards/${id}`, body).then((r) => r.data),
  delete: (id: string) =>
    api.delete(`/rate-cards/${id}`).then((r) => r.data),
};

// AUTOMATION
export const automationApi = {
  controls: () =>
    api.get<AutomationControl[]>('/automation/controls').then((r) => r.data),
  updateControl: (id: string, body: Record<string, unknown>) =>
    api.patch<AutomationControl>(`/automation/controls/${id}`, body).then((r) => r.data),
  history: () =>
    api.get<AutomationControlHistory[]>('/automation/controls/history').then((r) => r.data),
};

// USERS
export const usersApi = {
  list: () =>
    api.get<User[]>('/users').then((r) => r.data),
  invite: (email: string, role: string) =>
    api.post('/users/invite', { email, role }).then((r) => r.data),
  update: (id: string, body: { role?: string; can_approve?: boolean }) =>
    api.patch(`/users/${id}`, body).then((r) => r.data),
  delete: (id: string) =>
    api.delete(`/users/${id}`).then((r) => r.data),
};

// EXCEPTIONS
export const exceptionsApi = {
  list: (params: { status?: string; severity?: string; page?: number }) =>
    api.get<PaginatedExceptions>('/exceptions', { params }).then((r) => r.data),
  acknowledge: (id: string) =>
    api.patch(`/exceptions/${id}/acknowledge`).then((r) => r.data),
  resolve: (id: string, resolution_notes: string) =>
    api.patch(`/exceptions/${id}/resolve`, { resolution_notes }).then((r) => r.data),
  escalate: (id: string, escalate_to: string, note: string) =>
    api.patch(`/exceptions/${id}/escalate`, { escalate_to, note }).then((r) => r.data),
};

// CARRIERS
export const carriersApi = {
  list: () =>
    api.get<Carrier[]>('/carriers').then((r) => r.data),
};

// ANALYTICS
export const analyticsApi = {
  ddSaved: () =>
    api.get<{ total_paise: number; prevented_count: number }>('/analytics/dd-saved').then((r) => r.data),
  audit: (params: { action?: string; from?: string; to?: string }) =>
    api.get<AutomationAudit[]>('/automation/audit', { params }).then((r) => r.data),
};

// VENDOR INTELLIGENCE
export const vendorIntelligenceApi = {
  laneStats: (params: { transport_mode?: string; origin_country?: string; dest_country?: string; page?: number; limit?: number }) =>
    api.get<PaginatedLaneStats>('/vendor-intelligence/lane-stats', { params }).then((r) => r.data),
  suggest: (shipmentId: string) =>
    api.get<VendorSuggestion[]>(`/vendor-intelligence/suggest/${shipmentId}`).then((r) => r.data),
  autoAssign: (shipmentId: string, confirm: boolean) =>
    api.post(`/vendor-intelligence/auto-assign/${shipmentId}`, { confirm }).then((r) => r.data),
  carrierPerformance: (params: { carrier_id: string; transport_mode?: string; from?: string; to?: string }) =>
    api.get<CarrierPerformance>('/vendor-intelligence/carrier-performance', { params }).then((r) => r.data),
};

// VENDOR QUOTES
export const vendorQuotesApi = {
  request: (body: { shipment_id: string; carrier_ids: string[]; expiry_hours: number }) =>
    api.post('/vendor-quotes/request', body).then((r) => r.data),
  list: (params: { shipment_id?: string; status?: string; page?: number; limit?: number }) =>
    api.get<PaginatedQuoteRequests>('/vendor-quotes', { params }).then((r) => r.data),
  get: (id: string) =>
    api.get<QuoteRequest>(`/vendor-quotes/${id}`).then((r) => r.data),
  respond: (id: string, response_options: QuoteResponseOption[]) =>
    api.post(`/vendor-quotes/${id}/respond`, { response_options }).then((r) => r.data),
  selectOption: (id: string, option_index: number) =>
    api.post(`/vendor-quotes/${id}/select-option`, { option_index }).then((r) => r.data),
  laneCheck: (params: { transport_mode: string; origin_country: string; dest_country: string }) =>
    api.get<LaneCheckResult>('/vendor-quotes/lane-check', { params }).then((r) => r.data),
  setVolatility: (rateCardId: string, lane_volatile: boolean) =>
    api.patch(`/rate-cards/${rateCardId}/volatility`, { lane_volatile }).then((r) => r.data),
};

// ESCALATIONS
export const escalationsApi = {
  list: (params: { status?: string; type?: string; page?: number; limit?: number }) =>
    api.get<PaginatedEscalations>('/escalations', { params }).then((r) => r.data),
  get: (id: string) =>
    api.get<Escalation>(`/escalations/${id}`).then((r) => r.data),
  resolve: (id: string, note?: string) =>
    api.patch(`/escalations/${id}/resolve`, { note }).then((r) => r.data),
  byShipment: (shipmentId: string) =>
    api.get<Escalation[]>(`/escalations/shipment/${shipmentId}`).then((r) => r.data),
};

// APPROVAL EXTENSIONS
export const approvalExtensionsApi = {
  modify: (id: string, modifications: Record<string, unknown>, note: string) =>
    api.post(`/automation/queue/${id}/modify`, { modifications, note }).then((r) => r.data),
  summary: () =>
    api.get<ApprovalQueueSummary>('/automation/queue/summary').then((r) => r.data),
};

// ASSIGNMENT MANAGER
export const assignmentManagerApi = {
  list: (params: { date?: string; agent_id?: string; carrier_id?: string; status?: string; page?: number; limit?: number }) =>
    api.get<PaginatedAssignmentManager>('/assignment-manager', { params }).then((r) => r.data),
  updateStatus: (shipmentId: string, status: string, reason: string, note?: string) =>
    api.patch(`/assignment-manager/${shipmentId}/status`, { status, reason, note }).then((r) => r.data),
  changeVendor: (shipmentId: string, carrier_id: string, note?: string) =>
    api.patch(`/assignment-manager/${shipmentId}/vendor`, { carrier_id, note }).then((r) => r.data),
  stats: () =>
    api.get<AssignmentManagerStats>('/assignment-manager/stats').then((r) => r.data),
};

// EMAIL ANALYSIS
export const emailAnalysisApi = {
  get: (shipmentId: string) =>
    api.get<EmailAnalysisResponse>(`/email-analysis/${shipmentId}`).then((r) => r.data),
  analyze: (shipmentId: string) =>
    api.post(`/email-analysis/${shipmentId}/analyze`).then((r) => r.data),
};

// CRM
export const crmApi = {
  // Customers
  createCustomer: (body: Record<string, unknown>) =>
    api.post<CrmCustomer>('/crm/customers', body).then((r) => r.data),
  listCustomers: (params: { search?: string; page?: number; limit?: number; credit_status?: string }) =>
    api.get<PaginatedCustomers>('/crm/customers', { params }).then((r) => r.data),
  getCustomer: (id: string) =>
    api.get<CrmCustomer>(`/crm/customers/${id}`).then((r) => r.data),
  updateCustomer: (id: string, body: Record<string, unknown>) =>
    api.patch<CrmCustomer>(`/crm/customers/${id}`, body).then((r) => r.data),
  updateCreditLimit: (id: string, credit_limit_paise: number, note?: string) =>
    api.patch(`/crm/customers/${id}/credit-limit`, { credit_limit_paise, note }).then((r) => r.data),
  // Carriers
  createCarrier: (body: Record<string, unknown>) =>
    api.post<CrmCarrier>('/crm/carriers', body).then((r) => r.data),
  listCarriers: (params: { transport_mode?: string; active?: boolean; page?: number; limit?: number }) =>
    api.get<{ items: CrmCarrier[]; total: number; page: number; limit: number }>('/crm/carriers', { params }).then((r) => r.data),
  getCarrier: (id: string) =>
    api.get<CrmCarrier>(`/crm/carriers/${id}`).then((r) => r.data),
  updateCarrier: (id: string, body: Record<string, unknown>) =>
    api.patch<CrmCarrier>(`/crm/carriers/${id}`, body).then((r) => r.data),
  // Agents
  onboardAgent: (body: { full_name: string; phone: string; email?: string; vehicle_type: string; vehicle_number: string; license_number: string; license_expiry: string }) =>
    api.post('/crm/agents/onboard', body).then((r) => r.data),
  listAgents: (params: { status?: string; verification_status?: string; page?: number; limit?: number }) =>
    api.get<PaginatedCrmAgents>('/crm/agents', { params }).then((r) => r.data),
  getAgent: (id: string) =>
    api.get<CrmAgent>(`/crm/agents/${id}`).then((r) => r.data),
  verifyAgent: (id: string, verification_status: string, rejection_reason?: string) =>
    api.patch(`/crm/agents/${id}/verify`, { verification_status, rejection_reason }).then((r) => r.data),
  updateAgent: (id: string, body: Record<string, unknown>) =>
    api.patch<CrmAgent>(`/crm/agents/${id}`, body).then((r) => r.data),
  deleteAgent: (id: string) =>
    api.delete(`/crm/agents/${id}`).then((r) => r.data),
};
