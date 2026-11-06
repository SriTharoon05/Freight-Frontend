const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");

function compile(file, load) {
  const { outputText } = ts.transpileModule(
    readFileSync(path.join(__dirname, "..", file), "utf8").replace("function QuoteEditor(", "export function QuoteEditor("),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    },
  );
  const exports = {};
  vm.runInNewContext(
    outputText,
    {
      exports,
      require: load,
      Date,
      crypto: { randomUUID: () => "synthetic-job-key" },
    },
    { filename: file },
  );
  return exports;
}

function screen(file, component, props = {}, dataOverrides = {}) {
  const states = [],
    queries = [],
    calls = [],
    effects = [];
  let hook = 0;
  const freight = {
    async get(path, params, signal) {
      calls.push({ path, params, signal });
      return dataOverrides.getResponses?.[path] || {};
    },
    async post(path, body) { calls.push({ method: "post", path, body }); return { id: "job-created" }; },
    async put(path, body) { calls.push({ method: "put", path, body }); return { id: "saved-draft", version: 1 }; },
    async patch(path, body) {
      calls.push({ path, body });
    },
  };
  const passthrough = (props) => props.children;
  const shared = Object.fromEntries(
    [
      "Panel",
      "Field",
      "ErrorBanner",
      "Pager",
      "EntityAutocomplete",
      "ChargeSelect",
    ].map((name) => [name, passthrough]),
  );
  const queryFeedback = () => null;
  let fail = false;
  const draft = {
    ready: true,
    value: {
      customer: null,
      staff: null,
      cargo: "",
      origin: "",
      destination: "",
      mode: "ocean",
      etd: "",
      equipment: "",
      source_email_id: "",
    },
    setValue(next) {
      draft.value = typeof next === "function" ? next(draft.value) : next;
    },
    clear() { calls.push({ clearDraft: true }); },
  };
  if (component === "JobForm")
    draft.value = {
      fields: { mode: "air", bl_type: "original" },
      parties: {},
      cargo: [],
      containers: [],
      charges: [],
      key: "",
      savedId: "",
      savedVersion: 0,
      loadedFrom: "",
      jobVersion: 0,
    };
  const module = compile(file, (name) => {
    if (name === "react")
      return {
        ...React,
        useEffect(effect) {
          effects.push(effect);
        },
        useState(initial) {
          const index = hook++;
          if (!(index in states))
            states[index] = typeof initial === "function" ? initial() : initial;
          return [
            states[index],
            (next) => {
              states[index] =
                typeof next === "function" ? next(states[index]) : next;
            },
          ];
        },
      };
    if (name === "@tanstack/react-query")
      return {
        useQuery: (options) => {
          queries.push(options);
          return {
            data: dataOverrides.queryData?.[options.queryKey[2]] ?? (
              component === "JobForm" && options.queryKey[2] === "rfq"
                ? {
                    mode: "ocean",
                    origin: "IN",
                    destination: "AE",
                    customer: { id: "customer-one", name: "Cargo Customer" },
                    staff: { id: "rfq-owner", name: "RFQ Owner" },
                  }
                : {
                    items: [],
                    total: 0,
                    pending_total: 4,
                    replied_total: 2,
                    mailbox_options: [
                      { id: "mailbox-one", address: "sales@example.test" },
                    ],
                    coverage_complete: true,
                    ...dataOverrides,
                  }),
            error: fail ? { status: 0, message: "Timed out" } : null,
            isFetching: false,
            dataUpdatedAt: 1,
            refetch() { return { data: {}, error: null }; },
          };
        },
        useQueryClient: () => ({ invalidateQueries() {} }),
      };
    if (name === "@/lib/auth-store")
      return {
        useAuthStore: (select) =>
          select({
            user: { id: "user-one", tenant_id: "company-one", role: "admin", full_name: "Sanjit Sharma" },
          }),
      };
    if (name === "@/lib/freight")
      return {
        freight,
        dateLabel: String,
        moneyLabel: (value, currency) => `${currency} ${value}`,
        errorMessage: String,
        blankCargo: () => ({}),
        blankDimensionItem: () => ({ pieces: 1, length: 0, width: 0, height: 0, unit: "cm", gross_weight: 0, volume: 0, volumetric_weight: 0 }),
        calcDimensionItem: () => ({ volume: 0, volumetric_weight: 0 }),
        formatDimensions: () => "",
        parseDimensionsString: () => [{ pieces: 1, length: 0, width: 0, height: 0, unit: "cm", gross_weight: 0, volume: 0, volumetric_weight: 0 }],
        mawbWarning: () => null,
        localDateInput: (value) => value?.slice(0, 16) || "",
      };
    if (name === "@/lib/mail-triage")
      return compile("lib/mail-triage.ts", require);
    if (name === "@/lib/email-draft")
      return { quotationDraft: () => "Mock quotation" };
    if (name === "@/lib/use-debounced-value")
      return { useDebouncedValue: (value) => value };
    if (
      name === "./query-feedback" ||
      name === "@/components/freight/query-feedback"
    )
      return { QueryFeedback: queryFeedback };
    if (name === "./shared" || name === "@/components/freight/shared")
      return { ...shared, useDraft: () => draft };
    if (name === "@/components/ui/sheet" || name === "@/components/ui/dialog")
      return Object.fromEntries(
        [
          "Sheet",
          "SheetContent",
          "SheetHeader",
          "SheetTitle",
          "SheetDescription",
          "Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogDescription",
        ].map((key) => [key, passthrough]),
      );
    if (name === "@/components/shell/app-shell")
      return { AppShell: passthrough };
    if (name === "@/components/freight/email-requests")
      return { EmailRequests: () => null };
    if (name === "./packing-documents")
      return { PackingDocuments: () => null };
    if (name === "@/components/freight/milestone-board")
      return { MilestoneBoard: () => null };
    if (name === "@/components/freight/cargo-details-editor")
      return { CargoDetailsEditor: () => null };
    if (name === "@/components/freight/transport-price-quote")
      return { TransportPriceQuoteModal: () => null };
    if (name === "@/components/freight/supplier-rate-suggestions")
      return { SupplierRateSuggestions: () => null, RateCardSuggestions: () => null };
    if (name === "next/navigation")
      return {
        useRouter: () => ({
          push(path) {
            calls.push({ push: path });
          },
          replace(path) { calls.push({ replace: path }); },
        }),
        useSearchParams: () => ({
          get: (key) => dataOverrides.searchParams ? dataOverrides.searchParams[key] || null : (key === "rfq" ? "rfq-one" : null),
        }),
      };
    if (name === "sonner") return { toast: { success() {} } };
    return require(name);
  });
  return {
    render() {
      hook = 0;
      queries.length = 0;
      effects.length = 0;
      return module[component](props);
    },
    queries,
    calls,
    fail() {
      fail = true;
    },
    queryFeedback,
    draft,
    flushEffects() {
      for (const effect of effects) effect();
    },
  };
}

test("a new job defaults assignment to the logged-in creator even when the RFQ has another owner", () => {
  const ui = screen("components/freight/job-form.tsx", "JobForm");
  ui.render();
  ui.flushEffects();
  assert.equal(ui.draft.value.fields.rfq_id, "rfq-one");
  assert.equal(ui.draft.value.parties.assigned_user_id.id, "user-one");
  assert.equal(ui.draft.value.key, "synthetic-job-key");
});
function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
function text(tree) {
  if (tree == null || typeof tree === "boolean") return "";
  if (typeof tree !== "object") return String(tree);
  return Array.isArray(tree)
    ? tree.map(text).join("")
    : text(tree.props?.children);
}
function control(tree, label) {
  return nodes(tree).find((node) => node.props?.["aria-label"] === label);
}
function button(tree, label) {
  return nodes(tree).find(
    (node) => node.type === "button" && text(node).trim() === label,
  );
}

test("prepared filters are above their results and only fetch when their tab is active", async () => {
  const ui = screen("app/rfqs/page.tsx", "default");
  let tree = ui.render();
  assert.equal(ui.queries[0].enabled, false);
  assert.equal(control(tree, "RFQ stage"), undefined);
  button(tree, "Prepared RFQs").props.onClick();
  tree = ui.render();
  assert.equal(ui.queries[0].enabled, true);
  control(tree, "RFQ stage").props.onChange({ target: { value: "quoted" } });
  control(tree, "Transport mode").props.onChange({ target: { value: "air" } });
  tree = ui.render();
  const signal = new AbortController().signal;
  await ui.queries[0].queryFn({ signal });
  assert.equal(ui.calls[0].params.status, "quoted");
  assert.equal(ui.calls[0].params.mode, "air");
  assert.equal(ui.calls[0].params.page, 1);
  assert.equal(ui.calls[0].signal, signal);
  const ordered = nodes(tree);
  assert.ok(
    ordered.indexOf(control(tree, "RFQ stage")) <
      ordered.findIndex((node) => node.type === ui.queryFeedback),
  );
  button(tree, "Reset filters").props.onClick();
  tree = ui.render();
  assert.equal(control(tree, "RFQ stage").props.value, "");
  assert.equal(control(tree, "Transport mode").props.value, "");
});

test("email status, search and mailbox controls submit the displayed filters", async () => {
  const ui = screen("components/freight/email-requests.tsx", "EmailRequests", {
    onCreate: async () => {},
    onOpen: async () => {},
  });
  let tree = ui.render();
  await ui.queries[0].queryFn({ signal: new AbortController().signal });
  assert.equal(
    ui.calls.pop().params.status,
    "all",
    "Quoted threads stay visible in RFQ until a buyer replies",
  );
  nodes(tree)
    .find((node) => node.type === "button" && text(node).startsWith("Replied"))
    .props.onClick();
  control(tree, "Connected mailbox").props.onChange({
    target: { value: "mailbox-one" },
  });
  nodes(tree)
    .find((node) => node.type === "input" && node.props.type === "search")
    .props.onChange({ target: { value: "Ocean" } });
  tree = ui.render();
  await ui.queries[0].queryFn({ signal: new AbortController().signal });
  assert.equal(ui.calls[0].params.status, "replied");
  assert.equal(ui.calls[0].params.mailbox_id, "mailbox-one");
  assert.equal(ui.calls[0].params.q, "Ocean");
  assert.equal(ui.calls[0].params.page, 1);
  assert.equal(ui.queries[1].enabled, false);
});

test("refresh errors remain scoped to a list with its saved results", () => {
  const ui = screen("components/freight/email-requests.tsx", "EmailRequests");
  ui.fail();
  const tree = ui.render();
  const feedback = nodes(tree).find((node) => node.type === ui.queryFeedback);
  assert.equal(feedback.props.hasData, true);
  assert.equal(feedback.props.error.status, 0);
});

test("other mail submits category, priority and queue independently of reply status", async () => {
  const ui = screen("components/freight/email-requests.tsx", "EmailRequests", {
    workflow: "other",
  });
  let tree = ui.render();
  control(tree, "Email category").props.onChange({
    target: { value: "connection" },
  });
  control(tree, "Email priority").props.onChange({
    target: { value: "critical" },
  });
  tree = ui.render();
  await ui.queries[0].queryFn({ signal: new AbortController().signal });
  assert.equal(ui.calls[0].params.workflow, "other");
  assert.equal(ui.calls[0].params.status, "all");
  assert.equal(ui.calls[0].params.category, "connection");
  assert.equal(ui.calls[0].params.priority, "critical");
  button(tree, "Reset filters").props.onClick();
  tree = ui.render();
  assert.equal(control(tree, "Email category").props.value, "");
  assert.equal(control(tree, "Email priority").props.value, "");
});

test("confirmed conversations open a reviewed job form with the original links", async () => {
  const ui = screen(
    "components/freight/email-requests.tsx",
    "EmailRequests",
    { workflow: "ready" },
    {
      total: 1,
      items: [
        {
          id: "conversation-one",
          source_email_id: "mail-one",
          rfq_id: "rfq-one",
          body: "Please proceed",
          subject: "Shipment approved",
          received_at: "2026-10-03",
          workflow: "ready",
          priority: "critical",
          category: "rfq",
          response_status: "pending",
          triage_reason: "Customer confirmed",
        },
      ],
    },
  );
  let tree = ui.render();
  await button(tree, "Review & create job").props.onClick();
  assert.equal(
    ui.calls[0].push,
    "/shipments/new?conversation=conversation-one&rfq=rfq-one",
  );
  button(tree, "Conversation").props.onClick();
  tree = ui.render();
  control(tree, "Review category").props.onChange({
    target: { value: "rate_update" },
  });
  control(tree, "Review priority").props.onChange({
    target: { value: "medium" },
  });
  tree = ui.render();
  await button(tree, "Save classification").props.onClick();
  assert.equal(ui.calls[1].body.category, "rate_update");
  assert.equal(ui.calls[1].body.priority, "medium");
  assert.equal(ui.calls[1].path, "/email-requests/conversation-one/triage");
});

test("category review explains freight purpose, merges events and exposes uncertain evidence", () => {
  const ui = screen(
    "components/freight/email-requests.tsx",
    "EmailRequests",
    { workflow: "other" },
    {
      total: 1,
      items: [
        {
          id: "ambiguous",
          body: "Please check attached.",
          subject: "Enquiry",
          received_at: "2026-10-03",
          category: "other",
          priority: "low",
          response_status: "pending",
          review_required: true,
          classification_evidence: "Please check attached",
          triage_reason: "Insufficient business-purpose evidence",
        },
      ],
    },
  );
  let tree = ui.render();
  assert.match(text(tree), /Needs review/);
  const options = nodes(control(tree, "Email category")).filter(
    (node) => node.type === "option",
  );
  assert.ok(options.some((node) => node.props.value === "documentation"));
  assert.ok(
    options.some(
      (node) =>
        node.props.value === "connection" &&
        text(node) === "Networking & events",
    ),
  );
  assert.ok(!options.some((node) => node.props.value === "event"));
  button(tree, "Conversation").props.onClick();
  tree = ui.render();
  assert.match(text(tree), /Classification evidence/);
  assert.match(text(tree), /Please check attached/);
  control(tree, "Review category").props.onChange({
    target: { value: "operations" },
  });
  tree = ui.render();
  assert.match(
    text(tree),
    /Carrier\/agent replies and shipment-specific buying quotes/,
  );
});

test("an incomplete job can save a server draft without creating a job or document", async () => {
  const ui = screen("components/freight/job-form.tsx", "JobForm");
  ui.render(); ui.flushEffects();
  const tree = ui.render();
  await button(tree, "Save draft").props.onClick();
  const call = ui.calls.find(call => call.method === "put");
  assert.equal(call.path, "/job-drafts/synthetic-job-key");
  assert.equal(call.body.version, 0);
  assert.equal(call.body.form.key, "synthetic-job-key");
  assert.equal(ui.calls.some(call => call.method === "post"), false);
  assert.equal(ui.draft.value.savedId, "saved-draft");
  assert.match(text(ui.render()), /Draft saved/);
});

test("packing notes require an explicit copy and preserve existing cargo edits and numeric fields", () => {
  const source = { subject: "Accepted cargo", body: "Proceed", workflow: "ready", customer: null,
    bill_review_required: true,
    cargo: "Packing/cargo attachment: packing.csv (verify original)\nGross weight: 742 KGS\n" + "x".repeat(2200) };
  const ui = screen("components/freight/job-form.tsx", "JobForm", {}, {
    searchParams: { conversation: "thread-one" }, queryData: { "mail-job-context": source },
  });
  ui.draft.value.cargo = [{ description: "", pieces: 4, gross_weight: 742, dimensions: "verified dimensions" }];
  ui.render(); ui.flushEffects();
  assert.equal(ui.draft.value.cargo[0].description, "");
  let tree = ui.render();
  assert.match(text(tree), /AWB\/BL correspondence exists/);
  button(tree, "Use notes in empty cargo description").props.onClick();
  assert.equal(ui.draft.value.cargo[0].description, source.cargo.slice(0, 2000));
  assert.equal(ui.draft.value.cargo[0].pieces, 4);
  assert.equal(ui.draft.value.cargo[0].gross_weight, 742);
  ui.draft.value.cargo[0].description = "Staff-reviewed description";
  tree = ui.render();
  assert.equal(button(tree, "Use notes in empty cargo description").props.disabled, true);
  button(tree, "Use notes in empty cargo description").props.onClick();
  assert.equal(ui.draft.value.cargo[0].description, "Staff-reviewed description");
});

test("resuming a saved job draft restores fields, parties and its concurrency version", () => {
  const ui = screen("components/freight/job-form.tsx", "JobForm", {}, {
    searchParams: { draft: "draft-one" }, queryData: { "job-draft": {
      version: 4, shipment_id: null,
      form: { fields: { mode: "air", origin: "BOM", destination: "LHR" },
        parties: { customer_id: { id: "customer-one", name: "Atlas" } },
        cargo: [], containers: [], charges: [], key: "stable-create-key" },
    } },
  });
  ui.render(); ui.flushEffects();
  assert.equal(ui.draft.value.fields.destination, "LHR");
  assert.equal(ui.draft.value.savedVersion, 4);
  assert.equal(ui.draft.value.savedId, "draft-one");
  assert.equal(ui.draft.value.key, "stable-create-key");
  assert.ok(button(ui.render(), "Create job & document"));
});

test("an existing job offers full editing and submits its version to the update route", async () => {
  const ui = screen("components/freight/job-form.tsx", "JobForm", {}, {
    searchParams: { edit: "job-one" }, queryData: { job: {
      id: "job-one", version: 3, house_number: "HAWB001", ref_number: "JOB001",
      parties: Object.fromEntries(["customer_id", "assigned_user_id", "shipper_contact_id", "consignee_contact_id"].map(key => [key, { id: key, name: key }])),
      form: { mode: "air", service_type: "Air Freight", origin: "BOM", destination: "LHR",
        etd: "2026-10-10T10:00:27.123456Z", eta: "2026-10-11T10:00:00Z",
        idempotency_key: "original-key", cargo: [{ description: "Machine parts", gross_weight: "100", rate: "3.5" }], containers: [], waybill_charges: [] },
    } },
  });
  ui.render(); ui.flushEffects();
  const tree = ui.render();
  assert.ok(button(tree, "Save changes"));
  assert.equal(button(tree, "Create job & document"), undefined);
  assert.equal(ui.draft.value.cargo[0].gross_weight, 100);
  await tree.props.onSubmit({ preventDefault() {} });
  const call = ui.calls.find(call => call.method === "put");
  assert.equal(call.path, "/jobs/job-one/form");
  assert.equal(call.body.version, 3);
  assert.equal(call.body.idempotency_key, "original-key");
  assert.equal(call.body.etd, "2026-10-10T10:00:27.123456Z");
});

test("quotation drafts include the recipient contact and the staff member from the app greeting", () => {
  const { quotationDraft } = compile("lib/email-draft.ts", name => name === "./freight"
    ? { moneyLabel: (value, currency) => `${currency} ${value}` } : require(name));
  const draft = quotationDraft({ customer: { contact_name: "Priya Shah" }, customer_name: "Atlas Trading", origin: "BOM", destination: "LHR", mode: "air" },
    [{ quantity: 100, unit: "kg", unit_price: 3.5, currency: "USD" }], "2026-10-12T12:00", "Sanjit Sharma");
  assert.match(draft, /^Dear Priya Shah,/);
  assert.match(draft, /USD 350/);
  assert.match(draft, /Kind regards,\nSanjit Sharma$/);
  assert.doesNotMatch(draft, /Dear Atlas Trading/);
});

test("the dedicated carrier replies queue fetches rates independently from the sales pipeline", async () => {
  const ui = screen("components/freight/email-requests.tsx", "EmailRequests", { workflow: "supplier_rates" });
  const tree = ui.render();
  assert.match(text(tree), /Supplier enquiries & replies/);
  await ui.queries[0].queryFn({ signal: new AbortController().signal });
  assert.equal(ui.calls[0].params.workflow, "supplier_rates");
  assert.equal(ui.calls[0].params.status, "all");
});

test("all correspondence displays bullet briefs and action items, including networking emails", async () => {
  const ui = screen("components/freight/email-requests.tsx", "EmailRequests", { workflow: "all" }, {
    items: [{ id: "connection-one", subject: "Meet again", from_address: "partner@test.example", body: "Email body",
      category: "connection", priority: "low", response_status: "pending", summary_bullets: ["Met at the logistics exhibition."], action_items: ["Please RSVP by Friday."] }], total: 1,
  });
  const tree = ui.render();
  assert.match(text(tree), /Met at the logistics exhibition/);
  assert.match(text(tree), /Action itemsPlease RSVP by Friday/);
  assert.match(text(tree), /1 action items on this page/);
  assert.ok(control(tree, "Email category"));
});

test("dashboard links open actual queues and acknowledgment records a review", async () => {
  const ui = screen("app/dashboard/page.tsx", "default", {}, { queryData: {dashboard: {
    critical_mail_count: 1, critical_mail: [{id: "critical-one", subject: "Customer concern", sender: "buyer@test.example", category: "finance", href: "/emails?workflow=all&conversation=critical-one", summary_bullets: ["We are unhappy with the invoice error."]}],
    saved_drafts: 2, mail_pipeline: {ready: 3, supplier_rates: 1},
  }} });
  const tree = ui.render();
  assert.ok(nodes(tree).find(node => node.props?.title === "Critical correspondence · 1 needs attention"));
  assert.match(text(tree), /We are unhappy with the invoice error/);
  assert.ok(nodes(tree).find(node => node.props?.href === "/rfqs?tab=ready"));
  assert.ok(nodes(tree).find(node => node.props?.href === "/shipments?status=draft"));
  await button(tree, "Acknowledge review").props.onClick();
  assert.equal(ui.calls[0].path, "/mail-attention/critical-one/acknowledge");
});

test("a matched buying quote suggests a selling price with margin and keeps its source", async () => {
  const ui = screen("app/rfqs/page.tsx", "QuoteEditor", {rfq: {id: "rfq-one", reference: "RFQ001", form: {}, validity: "2099-10-12T12:00"}, close() {}}, {queryData: {
    "rfq-supplier-rates": {items: [{id: "source-rate", provider_address: "agent@test.example", amount: 2.4, currency: "USD", unit: "kg", valid_until: "2099-10-12T12:00:00Z", received_at: "2099-10-10T12:00:00Z", origin: "BOM", destination: "LHR", scope: "shipment"}], total: 1},
  }});
  let tree = ui.render();
  const weightField = nodes(tree).find(node => node.props?.label === "Chargeable weight (kg)");
  weightField.props.children.props.onChange({target: {value: "100"}});
  tree = ui.render();
  const source = nodes(tree).find(node => node.props.onApply);
  const rate = source.props.data.items[0];
  assert.equal(source.props.canApply(rate), true);
  source.props.onApply(rate);
  tree = ui.render();
  assert.equal(control(tree, "Sell price").props.value, 282.35);
  assert.equal(button(tree, "Mark won"), undefined);
  assert.ok(button(tree, "Flag for procurement · prepare enquiry"));
});

const testCargoProps = { value: "12 pallets, 1800 kg", onChange(value) { testCargoProps.value = value; } };
test("cargo expands into a large editable dialog and retains edits in the RFQ value", () => {
  const ui = screen("components/freight/cargo-details-editor.tsx", "CargoDetailsEditor", testCargoProps);
  let tree = ui.render();
  button(tree, "Expand editor").props.onClick();
  tree = ui.render();
  const dialog = nodes(tree).find(node => node.props.open === true);
  assert.ok(dialog);
  const editor = control(tree, "Expanded cargo details");
  editor.props.onChange({ target: { value: "14 pallets, 2000 kg" } });
  tree = ui.render();
  assert.equal(control(tree, "Expanded cargo details").props.value, "14 pallets, 2000 kg");
  button(tree, "Done").props.onClick();
  assert.equal(nodes(ui.render()).find(node => node.props.open !== undefined).props.open, false);
});

test("RFQ preparation imports cargo facts separately from the source conversation", async () => {
  const ui = screen("app/rfqs/page.tsx", "default", {}, { getResponses: {
    "/email-requests/customer-thread/context": {
      source_email_id: "latest-mail", subject: "Updated cargo", current_body: "Please quote revised cargo.",
      cargo: "12 pallets, 1800 kg", mode: "air", origin: "BOM", destination: "DXB",
      email_href: "/emails?workflow=all&conversation=customer-thread&message=latest-mail",
      customer: { id: "customer-one", name: "Atlas" },
    },
  } });
  const inbox = nodes(ui.render()).find(node => node.props.onCreate);
  await inbox.props.onCreate({ id: "customer-thread", source_email_id: "old-mail", body: "Entire quoted history" });
  assert.equal(ui.draft.value.cargo, "12 pallets, 1800 kg");
  assert.equal(ui.draft.value.source_body, "Please quote revised cargo.");
  assert.equal(ui.draft.value.source_email_id, "latest-mail");
  ui.render();
  const rates = ui.queries.find(query => query.queryKey[2] === "draft-supplier-rates");
  assert.equal(rates.enabled, true);
  await rates.queryFn({ signal: new AbortController().signal });
  assert.equal(ui.calls.at(-1).params.mode, "air");
  assert.equal(ui.calls.at(-1).params.origin, "BOM");
  assert.equal(ui.calls.at(-1).params.destination, "DXB");
});

test("rate suggestions show validity and a direct source-email verification link", () => {
  const href = "/emails?workflow=all&conversation=supplier-thread&message=quoted-mail";
  const ui = screen("components/freight/supplier-rate-suggestions.tsx", "SupplierRateSuggestions", { data: {
    items: [{ id: "rate-one", provider_address: "rates@carrier.test", amount: 2.8, currency: "USD", unit: "kg",
      origin: "BOM", destination: "DXB", received_at: "2026-10-10", valid_until: "2026-10-17", scope: "shipment", email_href: href }],
    total: 1, policy: "Fictional supplier rate suggestions.",
  } });
  const tree = ui.render();
  assert.match(text(tree), /Valid until 2026-10-17/);
  assert.match(text(tree), /Quoted 2026-10-10/);
  assert.match(text(tree), /Suggested from email/);
  assert.doesNotMatch(text(tree), /Fictional supplier/);
  assert.ok(nodes(tree).some(node => node.props.href === href && node.props.target === "_blank"));
  assert.equal(button(tree, "Use buying rate"), undefined);
});

test("source-email deep links target the quoted message and can reveal the whole thread", async () => {
  const ui = screen("components/freight/email-requests.tsx", "EmailRequests", { workflow: "all" }, {
    searchParams: { conversation: "thread-one", message: "source-one" },
    total: 1, items: [{ id: "thread-one", body: "Latest text", subject: "Quote", category: "operations", priority: "medium" }],
  });
  ui.render(); ui.flushEffects();
  let tree = ui.render();
  await ui.queries[1].queryFn({ signal: new AbortController().signal });
  assert.equal(ui.calls.at(-1).params.message_id, "source-one");
  button(tree, "Show full conversation").props.onClick();
  ui.render();
  await ui.queries[1].queryFn({ signal: new AbortController().signal });
  assert.equal(ui.calls.at(-1).params.message_id, undefined);
});

test("rate cards have a separate unavailable state and preserve their own pricing source", async () => {
  const empty = screen("components/freight/supplier-rate-suggestions.tsx", "RateCardSuggestions", {data: {items: [], total: 0}});
  assert.match(text(empty.render()), /Suggested from rate card.*Not available/);
  const card = {id: "card-one", carrier_name: "Carrier", origin_country_code: "IN", dest_country_code: "AE", transport_mode: "sea", base_rate_paise: 240000, per_kg_rate_paise: 0, per_cbm_rate_paise: 0, currency_code: "USD", valid_until: "2099-10-12"};
  const ui = screen("app/rfqs/page.tsx", "QuoteEditor", {rfq: {id: "rfq-one", reference: "RFQ001", form: {supplier_rate_ids: ["previous-email"]}}, close() {}}, {queryData: {"rfq-rates": {items: [card], total: 1}}});
  let tree = ui.render();
  const section = nodes(tree).find(node => node.props.data?.items[0]?.id === "card-one" && node.props.onApply);
  assert.equal(section.props.canApply(card), true);
  assert.equal(section.props.canApply({...card, per_kg_rate_paise: 100}), false);
  section.props.onApply(card);
  tree = ui.render();
  assert.equal(control(tree, "Sell price").props.value, 2823.53);
  await button(tree, "Save quote").props.onClick();
  assert.equal(ui.calls.at(-1).body.supplier_rate_ids.length, 0);
});

test("draft rate cards use the same route as email suggestions", async () => {
  const ui = screen("app/rfqs/page.tsx", "default", {}, {getResponses: {"/email-requests/customer-thread/context": {
    source_email_id: "latest-mail", mode: "ocean", origin: "IN", destination: "AE", customer: {id: "customer-one", name: "Atlas"}
  }}});
  await nodes(ui.render()).find(node => node.props.onCreate).props.onCreate({id: "customer-thread"});
  ui.render();
  const query = ui.queries.find(query => query.queryKey[2] === "draft-rate-cards");
  assert.equal(query.enabled, true);
  await query.queryFn({signal: new AbortController().signal});
  assert.equal(ui.calls.at(-1).path, "/rate-card-suggestions");
  assert.equal(ui.calls.at(-1).params.origin, "IN");
  assert.equal(ui.calls.at(-1).params.destination, "AE");
});

test("Bill of Lading has mutually exclusive sea waybill and original checkboxes", () => {
  const ui = screen("components/freight/job-form.tsx", "JobForm");
  ui.render();
  ui.flushEffects();

  // Switch to ocean freight
  ui.draft.value.fields.mode = "ocean";
  let tree = ui.render();

  // Find checkboxes
  const checkboxes = nodes(tree).filter(
    (n) => n.type === "input" && n.props.type === "checkbox"
  );
  assert.ok(checkboxes.length >= 2, "Expected at least 2 checkboxes for Sea Waybill and Original");

  // Default is original (so Original is checked, Sea Waybill is unchecked)
  assert.equal(ui.draft.value.fields.bl_type, "original");
  const seaWaybillBox = checkboxes[0];
  const originalBox = checkboxes[1];
  assert.equal(seaWaybillBox.props.checked, false);
  assert.equal(originalBox.props.checked, true);

  // Click Sea Waybill -> Sea Waybill checked, Original unchecked
  seaWaybillBox.props.onChange();
  assert.equal(ui.draft.value.fields.bl_type, "sea_waybill");
  tree = ui.render();
  const updatedCheckboxes = nodes(tree).filter(
    (n) => n.type === "input" && n.props.type === "checkbox"
  );
  assert.equal(updatedCheckboxes[0].props.checked, true);
  assert.equal(updatedCheckboxes[1].props.checked, false);

  // Click Original -> Original checked, Sea Waybill unchecked
  updatedCheckboxes[1].props.onChange();
  assert.equal(ui.draft.value.fields.bl_type, "original");
  tree = ui.render();
  const finalCheckboxes = nodes(tree).filter(
    (n) => n.type === "input" && n.props.type === "checkbox"
  );
  assert.equal(finalCheckboxes[0].props.checked, false);
  assert.equal(finalCheckboxes[1].props.checked, true);
});

test("Commodity dimensions calculate volume in m3, volumetric weight for air /6000 and ocean /1000", () => {
  const { calcDimensionItem, formatDimensions } = compile("lib/freight.ts", (name) => {
    if (name === "./api-client") return { api: {} };
    return require(name);
  });

  // Air freight formula check: (L x W x H cm) / 6000 * pieces
  const airCm = calcDimensionItem(
    { pieces: 10, length: 50, width: 40, height: 30, unit: "cm", gross_weight: 80, volume: 0, volumetric_weight: 0 },
    "air"
  );
  // Volume: (50 * 40 * 30 * 10) / 1,000,000 = 0.6 m³
  assert.equal(airCm.volume, 0.6);
  // Volumetric weight: (50 * 40 * 30 * 10) / 6000 = 100 kg
  assert.equal(airCm.volumetric_weight, 100);

  // Dimensions in meters: 0.5 x 0.4 x 0.3 m
  const airM = calcDimensionItem(
    { pieces: 10, length: 0.5, width: 0.4, height: 0.3, unit: "m", gross_weight: 80, volume: 0, volumetric_weight: 0 },
    "air"
  );
  assert.equal(airM.volume, 0.6);
  assert.equal(airM.volumetric_weight, 100);

  // Ocean freight formula check: (L x W x H cm) / 1000 * pieces (1 CBM = 1000 kg)
  const oceanCm = calcDimensionItem(
    { pieces: 10, length: 50, width: 40, height: 30, unit: "cm", gross_weight: 80, volume: 0, volumetric_weight: 0 },
    "ocean"
  );
  assert.equal(oceanCm.volume, 0.6);
  // Volumetric weight in ocean: (50 * 40 * 30 * 10) / 1000 = 600 kg
  assert.equal(oceanCm.volumetric_weight, 600);

  // Formatting check
  const formatted = formatDimensions([
    { pieces: 5, length: 40, width: 30, height: 20, unit: "cm", gross_weight: 30, volume: 0.12, volumetric_weight: 20 },
    { pieces: 2, length: 1, width: 0.8, height: 1.2, unit: "m", gross_weight: 150, volume: 1.92, volumetric_weight: 320 },
  ]);
  assert.equal(formatted, "5 @ 40x30x20 cm; 2 @ 1x0.8x1.2 m");
});

test("RFQ workspace exposes transport price quote document trigger and modal support", () => {
  const ui = screen(
    "app/rfqs/page.tsx",
    "default",
    {},
    {
      total: 1,
      items: [
        {
          id: "rfq-test-1",
          reference: "RFQ-TEST-001",
          customer_name: "Test Customer",
          origin: "BOM",
          destination: "LHR",
          mode: "ocean",
          status: "quoted",
          etd: "2026-11-15",
          form: { quote_lines: [] },
        },
      ],
    },
  );
  let tree = ui.render();
  button(tree, "Prepared RFQs").props.onClick();
  tree = ui.render();
  assert.ok(text(tree).includes("Transport Quote"));
});
