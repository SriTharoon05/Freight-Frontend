export const mailCategories = {
  rfq: "Quote request",
  connection: "Networking & events",
  business_development: "Sales & business development",
  rate_update: "Rate & surcharge circulars",
  lane_update: "Lane & service advisories",
  operations: "Shipment operations",
  documentation: "Shipping documentation",
  finance: "Finance & payments",
  other: "General / needs review",
} as const;

export const mailCategoryDescriptions: Record<
  keyof typeof mailCategories,
  string
> = {
  rfq: "The sender asks our company to price cargo transport, handling, customs or storage. Offered rates and sales pitches belong elsewhere.",
  connection:
    "Agency partnerships, professional connections, network membership and invitations to industry events or webinars.",
  business_development:
    "Service pitches, prospecting, promotion and business expansion proposals without an actual shipment quote request.",
  rate_update:
    "General tariffs, rate cards, FAK/GRI and surcharge circulars. Shipment-specific carrier buying rates belong in Operations.",
  lane_update:
    "Trade-wide routes, capacity, service changes and sailing or flight schedules. A booked shipment being rolled belongs in Operations.",
  operations:
    "Carrier/agent replies and shipment-specific buying quotes, bookings, pickup, tracking, arrival, delivery and shipment exceptions.",
  documentation:
    "Shipping instructions, VGM, BL/AWB, packing lists, certificates and commercial invoices needed for customs.",
  finance:
    "Freight invoice settlement, remittances, collection, payment disputes and credit or debit notes.",
  other:
    "General correspondence or messages whose purpose needs review, including attachment-only or conflicting requests.",
};

export const mailQueues = {
  all: {title: "All correspondence", description: "Every category, with concise summaries and action items. Use category filters to focus your work."},
  rfq: {
    title: "Quote requests",
    description:
      "Customer requests for a cargo-service quote. Each conversation updates as replies arrive. Our supplier enquiries are in the email workspace.",
  },
  potential: {
    title: "Potential jobs",
    description:
      "The requesting customer has replied to our selling quote. The whole thread stays here until acceptance or cancellation.",
  },
  ready: {
    title: "Jobs to create",
    description:
      "Customer confirmation detected. Review the conversation and complete the shipment details to create a job.",
  },
  supplier_rates: {
    title: "Supplier enquiries & replies",
    description:
      "Our buying-rate enquiries and carrier or agent replies, kept together in one conversation. Verify quoted rates and validity in the source email.",
  },
  other: {
    title: "Other emails",
    description:
      "Connections, events, commercial updates and general correspondence, ranked by priority.",
  },
  closed: {
    title: "Cancelled or on hold",
    description:
      "Requests where the customer asked to cancel or hold the shipment.",
  },
  job: {
    title: "Linked to jobs",
    description: "Conversations connected to an existing job.",
  },
} as const;
export type MailQueue = keyof typeof mailQueues;
