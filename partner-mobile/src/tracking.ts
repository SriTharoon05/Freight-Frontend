import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { enqueue } from "./store";
import { api } from "./auth";
import type { Task } from "./types";
import { needsTracking } from "./domain";
export const TRACKING = "freight-partner-active-trip";
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
  TRACKING,
  async ({ data, error }) => {
    if (error || !data) return;
    const stored = await SecureStore.getItemAsync("active_trip");
    if (!stored) return;
    const active = JSON.parse(stored);
    for (const sample of data.locations)
      await enqueue(active.taskId, "gps", {
        sample: {
          id: Crypto.randomUUID(),
          session_id: active.sessionId,
          captured_at: new Date(sample.timestamp).toISOString(),
          latitude: sample.coords.latitude,
          longitude: sample.coords.longitude,
          accuracy: sample.coords.accuracy ?? 100000,
        },
      });
    // OS background tasks can send samples without the screen being open.
    try {
      const { synchronize } = await import("./sync");
      await synchronize();
    } catch {
      /* Queue survives connectivity loss. */
    }
  },
);
export async function permission(
  request = true,
): Promise<"granted" | "denied" | "unavailable"> {
  if (!(await Location.hasServicesEnabledAsync())) return "unavailable";
  if (
    (
      await (request
        ? Location.requestForegroundPermissionsAsync()
        : Location.getForegroundPermissionsAsync())
    ).status !== "granted"
  )
    return "denied";
  return (
    await (request
      ? Location.requestBackgroundPermissionsAsync()
      : Location.getBackgroundPermissionsAsync())
  ).status === "granted"
    ? "granted"
    : "denied";
}
export async function stopTracking(taskId?: string) {
  if (taskId) {
    const active = await SecureStore.getItemAsync("active_trip");
    if (!active || JSON.parse(active).taskId !== taskId) return;
  }
  await SecureStore.deleteItemAsync("active_trip");
  if (await Location.hasStartedLocationUpdatesAsync(TRACKING))
    await Location.stopLocationUpdatesAsync(TRACKING);
}

export async function suspendTracking() {
  const active = await SecureStore.getItemAsync("active_trip");
  await stopTracking();
  if (!active) return;
  try {
    const task = await api<Task>(`/tasks/${JSON.parse(active).taskId}`);
    if (task.status === "in_progress")
      await api(`/tasks/${task.id}/actions/tracking-interrupted`, "POST", {
        event_id: Crypto.randomUUID(),
        version: task.version,
        brief_version: task.brief_version,
        captured_at: new Date().toISOString(),
        tracking_permission: "unavailable",
      });
  } catch {
    /* The stale indicator records an interruption if the service is unreachable. */
  }
}
export async function track(task: Task) {
  if (!needsTracking(task)) {
    const active = await SecureStore.getItemAsync("active_trip");
    if (active && JSON.parse(active).taskId === task.id) await stopTracking();
    return;
  }
  const active = await SecureStore.getItemAsync("active_trip");
  const allowed = await permission(false);
  if (allowed !== "granted") {
    await stopTracking();
    try {
      await api(`/tasks/${task.id}/actions/tracking-interrupted`, "POST", {
        event_id: Crypto.randomUUID(),
        version: task.version,
        brief_version: task.brief_version,
        captured_at: new Date().toISOString(),
        tracking_permission: allowed,
      });
    } catch {
      /* Stale display still identifies missing samples while offline. */
    }
    return;
  }
  if (
    active &&
    JSON.parse(active).sessionId === task.tracking_session_id &&
    (await Location.hasStartedLocationUpdatesAsync(TRACKING))
  )
    return;
  await stopTracking();
  await SecureStore.setItemAsync(
    "active_trip",
    JSON.stringify({ taskId: task.id, sessionId: task.tracking_session_id }),
    { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY },
  );
  try {
    await Location.startLocationUpdatesAsync(TRACKING, {
      accuracy: Location.Accuracy.High,
      timeInterval: 30000,
      distanceInterval: 20,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "Freight task tracking",
        notificationBody:
          "Location is shared while this pickup or delivery is active.",
        killServiceOnDestroy: true,
      },
    });
  } catch {
    await stopTracking();
    try {
      await api(`/tasks/${task.id}/actions/tracking-interrupted`, "POST", {
        event_id: Crypto.randomUUID(),
        version: task.version,
        brief_version: task.brief_version,
        captured_at: new Date().toISOString(),
        tracking_permission: "unavailable",
      });
    } catch {
      /* Staff still see stale samples if connectivity is unavailable. */
    }
  }
}
export async function reconcileTracking() {
  const active = await SecureStore.getItemAsync("active_trip");
  if (!active) return;
  try {
    await track(await api<Task>("/tasks/" + JSON.parse(active).taskId));
  } catch {
    /* Keep an active trip when temporarily offline. */
  }
}
