import { api } from "./auth";
import { enqueue } from "./store";
import { needsTracking } from "./domain";
import type { Task } from "./types";

let active: Task | null = null, watch: number | null = null;
let interrupted = "";
export const TRACKING = "freight-partner-active-trip-web";
export async function permission(request = true): Promise<"granted" | "denied" | "unavailable"> {
  if (!window.isSecureContext || !navigator.geolocation) return "unavailable";
  if (request) return new Promise((resolve) => navigator.geolocation.getCurrentPosition(
    () => resolve("granted"), (error) => resolve(error.code === 1 ? "denied" : "unavailable"),
    { timeout: 15000, maximumAge: 30000 },
  ));
  try {
    const state = await navigator.permissions.query({ name: "geolocation" });
    return state.state === "granted" ? "granted" : "denied";
  } catch { return watch !== null ? "granted" : "unavailable"; }
}
function clearWatch() {
  if (watch !== null) navigator.geolocation.clearWatch(watch);
  watch = null;
}
export async function stopTracking(taskId?: string) {
  if (taskId && active?.id !== taskId) return;
  clearWatch(); active = null; interrupted = "";
}
async function interruption(task: Task) {
  if (interrupted === task.tracking_session_id) return;
  interrupted = task.tracking_session_id || "";
  try { await api(`/tasks/${task.id}/actions/tracking-interrupted`, "POST", {
    event_id: crypto.randomUUID(), version: task.version, brief_version: task.brief_version,
    captured_at: new Date().toISOString(), tracking_permission: "unavailable",
  }); } catch { /* Staff still see stale samples if connectivity is unavailable. */ }
}
export async function suspendTracking() {
  const task = active;
  clearWatch();
  if (task) await interruption(task);
  active = null;
}
export async function track(task: Task) {
  if (!needsTracking(task)) { if (active?.id === task.id) await stopTracking(); return; }
  if (document.visibilityState !== "visible") { clearWatch(); return; }
  if (active?.tracking_session_id === task.tracking_session_id && watch !== null) { active = task; return; }
  if (await permission(false) !== "granted") { await stopTracking(); await interruption(task); return; }
  clearWatch(); active = task; interrupted = "";
  let last = 0;
  watch = navigator.geolocation.watchPosition((sample) => {
    if (active?.id !== task.id || document.visibilityState !== "visible" || sample.timestamp - last < 20000) return;
    last = sample.timestamp;
    void enqueue(task.id, "gps", { sample: {
      id: crypto.randomUUID(), session_id: task.tracking_session_id,
      captured_at: new Date(sample.timestamp).toISOString(), latitude: sample.coords.latitude,
      longitude: sample.coords.longitude, accuracy: sample.coords.accuracy,
    } }).then(async () => { const { synchronize } = await import("./sync"); await synchronize(); }).catch(() => {});
  }, () => { clearWatch(); void interruption(task); }, { enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 });
}
export async function reconcileTracking() {
  if (!active) return;
  try { await track(await api<Task>(`/tasks/${active.id}`)); } catch { /* Keep pending samples offline. */ }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void reconcileTracking();
  else { clearWatch(); if (active) void interruption(active); }
});
window.addEventListener("pagehide", clearWatch);
