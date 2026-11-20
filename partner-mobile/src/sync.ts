import NetInfo from "@react-native-community/netinfo";
import { ApiError, api, supabase } from "./auth";
import { pending, remove, fail, remember, cache } from "./store";
import { assertCurrent } from "./domain";
import { track } from "./tracking";
import type { Task } from "./types";
let running: Promise<void> | undefined;
export async function online() {
  const state = await NetInfo.fetch();
  return state.isConnected && state.isInternetReachable !== false;
}
export function synchronize(): Promise<void> {
  if (running) return running;
  running = flush().finally(() => {
    running = undefined;
  });
  return running;
}
async function flush() {
  if (!(await online())) return;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const owner = await cache<string>("owner");
  if (!session || owner !== session.user.id) return;
  const blocked = new Set<string>();
  for (const item of await pending()) {
    const {
      data: { session: current },
    } = await supabase.auth.getSession();
    if (current?.user.id !== owner) return;
    if (item.error || blocked.has(item.resource_id)) {
      blocked.add(item.resource_id);
      continue;
    }
    try {
      const p = item.payload;
      if (item.kind === "gps") {
        try {
          await api(`/tasks/${item.resource_id}/locations`, "POST", [p.sample]);
        } catch (error) {
          if (
            !(error instanceof ApiError) ||
            ![403, 404, 409, 422].includes(error.status)
          )
            throw error;
        }
      } else if (item.kind === "upload") {
        const endpoint = p.reservation ? "reservations" : "tasks";
        const upload = await api(
          `/${endpoint}/${item.resource_id}/evidence`,
          "POST",
          p.metadata,
        );
        if (upload.status !== "ready") {
          const bytes = Uint8Array.from(atob(p.bytes), (c) => c.charCodeAt(0));
          const controller = new AbortController(),
            timer = setTimeout(() => controller.abort(), 60000);
          let response: Response;
          try {
            response = await fetch(upload.upload_url, {
              method: "PUT",
              headers: {
                "Content-Type": p.metadata.content_type,
                "x-upsert": "false",
              },
              body: bytes,
              signal: controller.signal,
            });
          } catch {
            throw new ApiError(
              503,
              "Evidence upload interrupted. It will be retried.",
            );
          } finally {
            clearTimeout(timer);
          }
          // An earlier upload may have succeeded before the client lost its response.
          if (
            !response.ok &&
            response.status !== 409 &&
            response.status !== 400
          )
            throw new ApiError(
              503,
              "Evidence upload failed. It will be retried.",
            );
          await api(`/evidence/${p.metadata.id}/finalize`, "POST");
        }
      } else if (item.kind === "action") {
        const remote = await api<Task>(`/tasks/${item.resource_id}`);
        // The server also detects successful retries by event_id before checking versions.
        const already = remote.events?.some(
          (event: any) => event.id === p.body.event_id,
        );
        if (!already) assertCurrent(remote, p);
        const task = await api<Task>(
          `/tasks/${item.resource_id}/actions/${p.action}`,
          "POST",
          p.body,
        );
        await remember("task:" + task.id, {
          ...remote,
          ...task,
          pending_sync: false,
        });
        await track(task);
      } else
        await api(
          `/reservations/${item.resource_id}/handovers`,
          "POST",
          p.body,
        );
      await remove(item.id);
    } catch (error) {
      if (
        (error instanceof ApiError &&
          (error.status >= 500 ||
            error.status === 429 ||
            error.status === 401)) ||
        error instanceof TypeError
      )
        return;
      await fail(
        item.id,
        error instanceof Error
          ? error.message
          : "Synchronization needs attention",
      );
      blocked.add(item.resource_id);
    }
  }
}
