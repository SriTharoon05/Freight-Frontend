/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Drop-in axios mock adapter for FreightOS.
 *
 * Install once (see api-client.ts wiring in the instructions) and every
 * request made through the `api` instance is served from lib/mock/mock-data.ts
 * instead of hitting the real backend. No changes needed in any *Api object
 * or component.
 *
 * Toggle with:  NEXT_PUBLIC_USE_MOCK=true
 */

import type { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import * as M from './mock-data';

// ── helpers ──────────────────────────────────────────────
function paginate<T>(items: T[], params: any) {
  const page = Number(params?.page ?? 1);
  const limit = Number(params?.limit ?? 20);
  const start = (page - 1) * limit;
  return { items: items.slice(start, start + limit), total: items.length, page, limit };
}

// dashboard vs list endpoints share URLs; list pages pass `page`, dashboard doesn't
const wantsPaginated = (params: any) => params?.page !== undefined;

const ok = (data: any, config: InternalAxiosRequestConfig): AxiosResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
});

type Ctx = {
  method: string;
  path: string;
  params: any;
  body: any;
  m: RegExpMatchArray | null; // captured path params
  config: InternalAxiosRequestConfig;
};

type Route = { method: string; re: RegExp; handler: (ctx: Ctx) => any };

// ── route table (ORDER MATTERS: specific paths before dynamic ones) ──
const routes: Route[] = [
  // AUTH
  { method: 'post', re: /^\/auth\/login$/, handler: () => M.mockAuthResponse },
  { method: 'post', re: /^\/auth\/refresh$/, handler: () => ({ access_token: M.mockAuthResponse.access_token }) },
  { method: 'post', re: /^\/auth\/logout$/, handler: () => ({ ok: true }) },
  { method: 'get', re: /^\/auth\/me$/, handler: () => M.mockUser },

  // DASHBOARD
  { method: 'get', re: /^\/shipments\/stats$/, handler: () => M.mockDashboardStats },

  // SHIPMENTS  (list is array for dashboard, paginated for list page)
  { method: 'get', re: /^\/shipments$/, handler: ({ params }) => wantsPaginated(params) ? paginate(M.shipments, params) : M.shipments.slice(0, Number(params?.limit ?? 20)) },
  { method: 'post', re: /^\/shipments$/, handler: ({ body }) => ({ id: 'shp-new', ref_number: 'SHP-24999', status: 'draft', created_at: new Date().toISOString(), ...body }) },
  { method: 'get', re: /^\/shipments\/([^/]+)\/documents$/, handler: ({ m }) => M.documents.filter((d) => d.shipment_id === m![1]) },
  { method: 'post', re: /^\/shipments\/([^/]+)\/documents\/generate$/, handler: ({ m, body }) => ({ id: 'doc-new', shipment_id: m![1], document_type: body?.document_type ?? 'commercial_invoice', status: 'generated', generated_at: new Date().toISOString(), created_at: new Date().toISOString() }) },
  { method: 'get', re: /^\/shipments\/([^/]+)\/milestones$/, handler: ({ m }) => M.milestonesByShipment[m![1]] ?? [] },
  { method: 'get', re: /^\/shipments\/([^/]+)\/communications$/, handler: ({ m }) => M.communicationsByShipment[m![1]] ?? [] },
  { method: 'get', re: /^\/shipments\/([^/]+)\/exceptions$/, handler: ({ m }) => M.exceptions.filter((e) => e.shipment_id === m![1]) },
  { method: 'get', re: /^\/shipments\/([^/]+)\/assignments$/, handler: ({ m }) => M.assignmentsByShipment[m![1]] ?? [] },
  { method: 'get', re: /^\/shipments\/([^/]+)\/automation-activity$/, handler: ({ m }) => M.automationAudit.filter((a) => a.shipment_id === m![1]) },
  { method: 'get', re: /^\/shipments\/([^/]+)\/quotes$/, handler: ({ m }) => M.quotesByShipment[m![1]] ?? [] },
  { method: 'patch', re: /^\/shipments\/([^/]+)\/status$/, handler: ({ m, body }) => ({ id: m![1], status: body?.status, updated_at: new Date().toISOString() }) },
  { method: 'get', re: /^\/shipments\/([^/]+)$/, handler: ({ m }) => M.shipmentDetails[m![1]] ?? M.shipmentDetails['shp-1'] },

  // EXCEPTIONS (array for dashboard, paginated for list page)
  { method: 'get', re: /^\/exceptions$/, handler: ({ params }) => wantsPaginated(params) ? paginate(M.exceptions, params) : M.exceptions.filter((e) => !params?.status || e.status === params.status).slice(0, Number(params?.limit ?? 10)) },
  { method: 'patch', re: /^\/exceptions\/([^/]+)\/acknowledge$/, handler: ({ m }) => ({ id: m![1], status: 'acknowledged' }) },
  { method: 'patch', re: /^\/exceptions\/([^/]+)\/resolve$/, handler: ({ m, body }) => ({ id: m![1], status: 'resolved', resolution_notes: body?.resolution_notes }) },
  { method: 'patch', re: /^\/exceptions\/([^/]+)\/escalate$/, handler: ({ m }) => ({ id: m![1], status: 'escalated' }) },

  // APPROVALS / AUTOMATION QUEUE
  { method: 'get', re: /^\/automation\/queue\/summary$/, handler: () => M.approvalSummary },
  { method: 'get', re: /^\/automation\/queue$/, handler: ({ params }) => M.approvalQueue.filter((q) => !params?.status || q.status === params.status) },
  { method: 'get', re: /^\/automation\/queue\/([^/]+)$/, handler: ({ m }) => M.approvalQueue.find((q) => q.id === m![1]) ?? M.approvalQueue[0] },
  { method: 'post', re: /^\/automation\/queue\/([^/]+)\/approve$/, handler: ({ m }) => ({ id: m![1], status: 'approved' }) },
  { method: 'post', re: /^\/automation\/queue\/([^/]+)\/reject$/, handler: ({ m }) => ({ id: m![1], status: 'rejected' }) },
  { method: 'post', re: /^\/automation\/queue\/([^/]+)\/modify$/, handler: ({ m }) => ({ id: m![1], status: 'pending' }) },

  // AUTOMATION CONTROLS
  { method: 'get', re: /^\/automation\/controls\/history$/, handler: () => M.automationControlHistory },
  { method: 'get', re: /^\/automation\/controls$/, handler: () => M.automationControls },
  { method: 'patch', re: /^\/automation\/controls\/([^/]+)$/, handler: ({ m, body }) => ({ ...(M.automationControls.find((c) => c.id === m![1]) ?? M.automationControls[0]), ...body }) },
  { method: 'get', re: /^\/automation\/audit$/, handler: () => M.automationAudit },

  // ASSIGNMENTS
  { method: 'get', re: /^\/assignments$/, handler: () => M.assignments },
  { method: 'post', re: /^\/assignments\/([^/]+)\/reassign$/, handler: ({ m }) => ({ id: m![1], status: 'reassigned' }) },
  { method: 'get', re: /^\/agents\/available$/, handler: () => M.availableAgents },

  // WAREHOUSE
  { method: 'get', re: /^\/warehouse\/bays$/, handler: ({ params }) => params?.warehouse_id ? M.warehouseBays.filter((b) => b.warehouse_id === params.warehouse_id) : M.warehouseBays },
  { method: 'get', re: /^\/warehouse\/inventory$/, handler: ({ params }) => params?.warehouse_id ? M.warehouseInventory.filter((i) => i.warehouse_id === params.warehouse_id) : M.warehouseInventory },

  // DOCUMENTS
  { method: 'get', re: /^\/documents$/, handler: ({ params }) => M.documents.filter((d) => (!params?.type || d.document_type === params.type) && (!params?.status || d.status === params.status)) },
  { method: 'get', re: /^\/documents\/([^/]+)\/download$/, handler: () => ({ signed_url: 'https://example.com/mock/download.pdf' }) },

  // CUSTOMERS
  { method: 'get', re: /^\/customers$/, handler: ({ params }) => paginate(M.customers.filter((c) => !params?.search || c.name.toLowerCase().includes(String(params.search).toLowerCase())), params) },
  { method: 'get', re: /^\/customers\/([^/]+)\/shipments$/, handler: ({ m }) => M.shipments.filter((s) => s.shipper_id === m![1]) },
  { method: 'get', re: /^\/customers\/([^/]+)$/, handler: ({ m }) => M.customerDetails[m![1]] ?? M.customerDetails['cust-1'] },

  // RATE CARDS
  { method: 'get', re: /^\/rate-cards$/, handler: ({ params }) => M.rateCards.filter((r) => (!params?.mode || r.mode === params.mode) && (params?.active === undefined || r.active === params.active)) },
  { method: 'post', re: /^\/rate-cards$/, handler: ({ body }) => ({ id: 'rc-new', active: true, created_at: new Date().toISOString(), ...body }) },
  { method: 'patch', re: /^\/rate-cards\/([^/]+)\/volatility$/, handler: ({ m, body }) => ({ id: m![1], lane_volatile: body?.lane_volatile }) },
  { method: 'patch', re: /^\/rate-cards\/([^/]+)$/, handler: ({ m, body }) => ({ ...(M.rateCards.find((r) => r.id === m![1]) ?? M.rateCards[0]), ...body }) },
  { method: 'delete', re: /^\/rate-cards\/([^/]+)$/, handler: () => ({ ok: true }) },

  // USERS
  { method: 'get', re: /^\/users$/, handler: () => M.mockUsers },
  { method: 'post', re: /^\/users\/invite$/, handler: ({ body }) => ({ ok: true, ...body }) },
  { method: 'patch', re: /^\/users\/([^/]+)$/, handler: ({ m, body }) => ({ id: m![1], ...body }) },
  { method: 'delete', re: /^\/users\/([^/]+)$/, handler: () => ({ ok: true }) },

  // CARRIERS
  { method: 'get', re: /^\/carriers$/, handler: () => M.carriers },

  // ANALYTICS
  { method: 'get', re: /^\/analytics\/dd-saved$/, handler: () => M.ddSaved },

  // VENDOR INTELLIGENCE
  { method: 'get', re: /^\/vendor-intelligence\/lane-stats$/, handler: ({ params }) => paginate(M.laneStats, params) },
  { method: 'get', re: /^\/vendor-intelligence\/suggest\/([^/]+)$/, handler: () => M.vendorSuggestions },
  { method: 'post', re: /^\/vendor-intelligence\/auto-assign\/([^/]+)$/, handler: ({ m }) => ({ shipment_id: m![1], assigned_carrier_id: 'car-1', ok: true }) },
  { method: 'get', re: /^\/vendor-intelligence\/carrier-performance$/, handler: () => M.carrierPerformance },

  // VENDOR QUOTES
  { method: 'post', re: /^\/vendor-quotes\/request$/, handler: ({ body }) => ({ ok: true, ...body }) },
  { method: 'get', re: /^\/vendor-quotes\/lane-check$/, handler: () => M.laneCheck },
  { method: 'get', re: /^\/vendor-quotes$/, handler: ({ params }) => paginate(M.quoteRequests.filter((q) => (!params?.shipment_id || q.shipment_id === params.shipment_id) && (!params?.status || q.status === params.status)), params) },
  { method: 'get', re: /^\/vendor-quotes\/([^/]+)$/, handler: ({ m }) => M.quoteRequests.find((q) => q.id === m![1]) ?? M.quoteRequests[0] },
  { method: 'post', re: /^\/vendor-quotes\/([^/]+)\/respond$/, handler: ({ m }) => ({ id: m![1], status: 'responded' }) },
  { method: 'post', re: /^\/vendor-quotes\/([^/]+)\/select-option$/, handler: ({ m, body }) => ({ id: m![1], selected_option_index: body?.option_index }) },

  // ESCALATIONS
  { method: 'get', re: /^\/escalations\/shipment\/([^/]+)$/, handler: ({ m }) => M.escalations.filter((e) => e.shipment_id === m![1]) },
  { method: 'get', re: /^\/escalations$/, handler: ({ params }) => paginate(M.escalations.filter((e) => (!params?.status || e.status === params.status) && (!params?.type || e.type === params.type)), params) },
  { method: 'get', re: /^\/escalations\/([^/]+)$/, handler: ({ m }) => M.escalations.find((e) => e.id === m![1]) ?? M.escalations[0] },
  { method: 'patch', re: /^\/escalations\/([^/]+)\/resolve$/, handler: ({ m }) => ({ id: m![1], status: 'resolved' }) },

  // ASSIGNMENT MANAGER
  { method: 'get', re: /^\/assignment-manager\/stats$/, handler: () => M.assignmentManagerStats },
  { method: 'get', re: /^\/assignment-manager$/, handler: ({ params }) => paginate(M.assignmentManagerRows.filter((r) => (!params?.status || r.status === params.status) && (!params?.agent_id || r.agent_id === params.agent_id) && (!params?.carrier_id || r.carrier_id === params.carrier_id)), params) },
  { method: 'patch', re: /^\/assignment-manager\/([^/]+)\/status$/, handler: ({ m, body }) => ({ shipment_id: m![1], status: body?.status }) },
  { method: 'patch', re: /^\/assignment-manager\/([^/]+)\/vendor$/, handler: ({ m, body }) => ({ shipment_id: m![1], carrier_id: body?.carrier_id }) },

  // EMAIL ANALYSIS
  { method: 'post', re: /^\/email-analysis\/([^/]+)\/analyze$/, handler: ({ m }) => M.emailAnalysisByShipment[m![1]]?.analysis ?? { ok: true } },
  { method: 'get', re: /^\/email-analysis\/([^/]+)$/, handler: ({ m }) => M.emailAnalysisByShipment[m![1]] ?? { emails: [], analysis: null } },

  // CRM · customers
  { method: 'post', re: /^\/crm\/customers$/, handler: ({ body }) => ({ id: 'cust-new', created_at: new Date().toISOString(), ...body }) },
  { method: 'get', re: /^\/crm\/customers$/, handler: ({ params }) => paginate(M.crmCustomers.filter((c) => (!params?.search || c.name.toLowerCase().includes(String(params.search).toLowerCase())) && (!params?.credit_status || c.credit_status === params.credit_status)), params) },
  { method: 'get', re: /^\/crm\/customers\/([^/]+)$/, handler: ({ m }) => M.crmCustomers.find((c) => c.id === m![1]) ?? M.crmCustomers[0] },
  { method: 'patch', re: /^\/crm\/customers\/([^/]+)\/credit-limit$/, handler: ({ m, body }) => ({ id: m![1], credit_limit_paise: body?.credit_limit_paise }) },
  { method: 'patch', re: /^\/crm\/customers\/([^/]+)$/, handler: ({ m, body }) => ({ ...(M.crmCustomers.find((c) => c.id === m![1]) ?? M.crmCustomers[0]), ...body }) },

  // CRM · carriers
  { method: 'post', re: /^\/crm\/carriers$/, handler: ({ body }) => ({ id: 'car-new', active: true, created_at: new Date().toISOString(), ...body }) },
  { method: 'get', re: /^\/crm\/carriers$/, handler: ({ params }) => { const filtered = M.crmCarriers.filter((c) => (!params?.transport_mode || c.transport_mode === params.transport_mode) && (params?.active === undefined || c.active === params.active)); return paginate(filtered, params); } },
  { method: 'get', re: /^\/crm\/carriers\/([^/]+)$/, handler: ({ m }) => M.crmCarriers.find((c) => c.id === m![1]) ?? M.crmCarriers[0] },
  { method: 'patch', re: /^\/crm\/carriers\/([^/]+)$/, handler: ({ m, body }) => ({ ...(M.crmCarriers.find((c) => c.id === m![1]) ?? M.crmCarriers[0]), ...body }) },

  // CRM · agents
  { method: 'post', re: /^\/crm\/agents\/onboard$/, handler: ({ body }) => ({ id: 'agt-new', status: 'offline', verification_status: 'pending', created_at: new Date().toISOString(), ...body }) },
  { method: 'get', re: /^\/crm\/agents$/, handler: ({ params }) => paginate(M.crmAgents.filter((a) => (!params?.status || a.status === params.status) && (!params?.verification_status || a.verification_status === params.verification_status)), params) },
  { method: 'get', re: /^\/crm\/agents\/([^/]+)$/, handler: ({ m }) => M.crmAgents.find((a) => a.id === m![1]) ?? M.crmAgents[0] },
  { method: 'patch', re: /^\/crm\/agents\/([^/]+)\/verify$/, handler: ({ m, body }) => ({ id: m![1], verification_status: body?.verification_status, rejection_reason: body?.rejection_reason }) },
  { method: 'patch', re: /^\/crm\/agents\/([^/]+)$/, handler: ({ m, body }) => ({ ...(M.crmAgents.find((a) => a.id === m![1]) ?? M.crmAgents[0]), ...body }) },
  { method: 'delete', re: /^\/crm\/agents\/([^/]+)$/, handler: () => ({ ok: true }) },
];

/**
 * Installs the mock adapter onto an axios instance.
 * All requests through that instance are served from mock data.
 */
export function installMockAdapter(api: AxiosInstance) {
  api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    const method = (config.method ?? 'get').toLowerCase();
    // strip baseURL + query string → clean path like "/shipments/shp-1"
    const rawUrl = config.url ?? '';
    const path = rawUrl.replace(/^https?:\/\/[^/]+/, '').replace(/\?.*$/, '').replace(/\/+$/, '') || '/';

    let body: any = config.data;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { /* keep as-is */ } }

    // simulate light network latency (comment out for instant responses)
    await new Promise((r) => setTimeout(r, 150));

    for (const route of routes) {
      if (route.method !== method) continue;
      const m = path.match(route.re);
      if (!m) continue;
      const data = route.handler({ method, path, params: config.params, body, m, config });
      // eslint-disable-next-line no-console
      console.debug(`[mock] ${method.toUpperCase()} ${path} →`, data);
      return ok(data, config);
    }

    // no route matched → return a benign empty 200 so the UI never hard-crashes
    // eslint-disable-next-line no-console
    console.warn(`[mock] Unhandled ${method.toUpperCase()} ${path} — returning empty payload`);
    return ok({ items: [], total: 0, page: 1, limit: 20 }, config);
  };
}
