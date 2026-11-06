const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const ts = require("typescript");
const React = require("react");

const base = {
  id: "milestone-1", source: "milestone", job_id: "job-1", job_reference: "JOB-001",
  customer: "Customer", event_type: "Customs release", vendor_name: "Customs Co",
  planned_at: "2026-10-21T12:00:43Z", occurred_at: null, alert_before_hours: 6,
  notes: "", editable: true, task_status: null, status: "pending", at_risk: true,
};
function localDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function screen(items, props = {}, role = "ops") {
  const states = [], calls = [], queries = [];
  let hook = 0;
  const { outputText } = ts.transpileModule(readFileSync(path.join(__dirname, "../components/freight/milestone-board.tsx"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  const exports = {};
  vm.runInNewContext(outputText, { exports, Date, require(name) {
    if (name === "react") return { ...React, useState(initial) {
      const index = hook++;
      if (!(index in states)) states[index] = initial;
      return [states[index], next => { states[index] = typeof next === "function" ? next(states[index]) : next; }];
    } };
    if (name === "@/lib/auth-store") return { useAuthStore: select => select({ user: { tenant_id: "tenant-1", role } }) };
    if (name === "@/lib/use-debounced-value") return { useDebouncedValue: value => value };
    if (name === "@tanstack/react-query") return {
      useQuery(options) { queries.push(options); return { data: { items, total: items.length, summary: { total: items.length, done: 1, pending: 1, overdue: 1, risk: 2, no_target: 1 }, as_of: "2026-10-21T12:00:00Z" } }; },
      useQueryClient: () => ({ async invalidateQueries(value) { calls.push({ invalidate: value }); } }),
    };
    if (name === "@/lib/freight") return {
      localDateInput, dateLabel: value => value || "—",
      freight: { async patch(url, body) { calls.push({ url, body }); }, async get(url, params) { calls.push({ url, params }); } },
    };
    if (name === "./shared") return { Panel: "Panel", Field: "Field", ErrorBanner: "ErrorBanner", Pager: "Pager", inputClass: "input", buttonClass: "primary", secondaryClass: "secondary" };
    if (name === "@/components/ui/sheet") return { Sheet: "Sheet", SheetContent: "SheetContent", SheetHeader: "SheetHeader", SheetTitle: "SheetTitle" };
    if (name === "next/link") return { __esModule: true, default: "a" };
    return require(name);
  } });
  return { calls, queries, render() { hook = 0; return exports.MilestoneBoard(props); } };
}
function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
function text(tree) {
  if (tree == null || typeof tree === "boolean") return "";
  if (typeof tree !== "object") return String(tree);
  return Array.isArray(tree) ? tree.map(text).join("") : text(tree.props?.children);
}
const find = (tree, type) => nodes(tree).filter(node => node.type === type);

test("one board exposes every vendor, text status and the requested status colors", async () => {
  const ui = screen([
    base,
    { ...base, id: "2", status: "done", vendor_name: "Pickup Co", occurred_at: "2026-10-21T13:00:00Z", at_risk: false },
    { ...base, id: "3", status: "overdue", vendor_name: "Delivery Co" },
    { ...base, id: "4", planned_at: null, at_risk: false },
  ]);
  const tree = ui.render();
  for (const [label, color] of [["Done", "green"], ["Pending", "orange"], ["Overdue", "red"]]) {
    assert.ok(find(tree, "span").some(node => text(node) === label && node.props.className.includes(`bg-${color}-50`)));
  }
  assert.match(text(tree), /Pickup Co/);
  assert.match(text(tree), /Delivery Co/);
  assert.match(text(tree), /Completed after target/);
  assert.match(text(tree), /No target set/);
  assert.match(text(tree), /Due soon/);
  assert.equal(ui.queries[0].refetchInterval, 30000);
  const filter = find(tree, "button").find(node => text(node).startsWith("Red · Overdue"));
  filter.props.onClick(); ui.render();
  await ui.queries.at(-1).queryFn({ signal: undefined });
  assert.equal(ui.calls.at(-1).params.status, "overdue");
});

test("target edits retain the exact actual and target instants unless the user changes them", async () => {
  const ui = screen([{ ...base, occurred_at: "2026-10-21T12:22:57Z", status: "done", at_risk: false }], { jobId: "job-1" });
  find(ui.render(), "button").find(node => node.props["aria-label"]?.startsWith("Edit target")).props.onClick();
  const tree = ui.render();
  await find(tree, "form")[0].props.onSubmit({ preventDefault() {} });
  const saved = ui.calls.find(call => call.url);
  assert.equal(saved.url, "/jobs/job-1/milestones/milestone-1");
  assert.equal(saved.body.planned_at, base.planned_at);
  assert.equal(saved.body.alert_before_hours, 6);
  assert.equal("actual_at" in saved.body, false);
});

test("vendor completion targets use their own endpoint without a manual completion field", async () => {
  const ui = screen([{ ...base, source: "partner_task", id: "task-1", planned_at: null }]);
  find(ui.render(), "button").find(node => node.props["aria-label"]?.startsWith("Edit target")).props.onClick();
  let tree = ui.render();
  const dateFields = find(tree, "input").filter(node => node.props.type === "datetime-local");
  assert.equal(dateFields.length, 1);
  dateFields[0].props.onChange({ target: { value: "2026-10-23T10:00" } });
  tree = ui.render();
  await find(tree, "form")[0].props.onSubmit({ preventDefault() {} });
  const saved = ui.calls.find(call => call.url);
  assert.equal(saved.url, "/jobs/job-1/vendor-targets/task-1");
  assert.equal(saved.body.planned_at, new Date("2026-10-23T10:00").toISOString());
  assert.equal("actual_at" in saved.body, false);
});

test("dashboard starts with risks and read-only users cannot edit targets", () => {
  const ui = screen([base], { compact: true }, "readonly");
  const tree = ui.render();
  assert.ok(ui.queries[0].queryKey.includes("risk"));
  assert.equal(find(tree, "button").filter(node => node.props["aria-label"]?.startsWith("Edit target")).length, 0);
  assert.equal(tree.props.action.props.href, "/milestones");
});
