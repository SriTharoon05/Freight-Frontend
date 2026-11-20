const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { stripTypeScriptTypes } = require("node:module");

test("parallel customs completion cannot stop the active transport session", async () => {
  const initial = JSON.stringify({ taskId: "transport-task", sessionId: "session" });
  let active = initial, stops = 0;
  const context = vm.createContext({
    TaskManager: { defineTask() {} },
    SecureStore: {
      async getItemAsync() { return active; },
      async deleteItemAsync() { active = null; },
    },
    Location: {
      async hasStartedLocationUpdatesAsync() { return true; },
      async stopLocationUpdatesAsync() { stops += 1; },
    },
  });
  const source = stripTypeScriptTypes(fs.readFileSync(require("node:path").join(__dirname, "../src/tracking.ts"), "utf8"))
    .replace(/^import[\s\S]*?from\s+["'][^"']+["'];?\s*/gm, "")
    .replace(/^export\s+/gm, "");
  vm.runInContext(source, context);
  await context.stopTracking("customs-task");
  assert.equal(active, initial);
  assert.equal(stops, 0);
  await context.stopTracking("transport-task");
  assert.equal(active, null);
  assert.equal(stops, 1);
});
