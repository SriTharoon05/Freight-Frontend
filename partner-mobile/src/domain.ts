import type { Json, Task } from "./types";
export function optimistic(task: Task, action: string): Task {
  const status =
    (
      {
        start: "in_progress",
        "submit-completion": "awaiting_verification",
        accept: "accepted",
        decline: "rejected",
      } as Record<string, string>
    )[action] || task.status;
  return { ...task, status, version: task.version + 1, pending_sync: true };
}
export function assertCurrent(task: Task, payload: Json) {
  if (["cancelled", "rejected", "completed"].includes(task.status))
    throw new Error(
      "This task is closed. Review the updated task before discarding pending work.",
    );
  if (
    task.brief_version !== payload.body.brief_version ||
    task.version !== payload.body.version
  )
    throw new Error(
      "The task or its instructions changed. Review the new briefing; pending work needs your attention.",
    );
}
export function needsTracking(task: Task) {
  return (
    ["pickup", "delivery"].includes(task.kind) &&
    !task.driver &&
    task.status === "in_progress" &&
    Boolean(task.tracking_session_id) &&
    task.tracking_status === "active"
  );
}
