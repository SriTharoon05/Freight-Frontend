// Server-side schedule: the credential is never exposed in a browser bundle.
export const config = { schedule: "*/5 * * * *" };

export default async function mailboxSync() {
  const secret = process.env.MAILBOX_SYNC_SECRET || "";
  const endpoint = process.env.MAILBOX_SYNC_URL || "";
  if (!endpoint && !secret) return new Response(null, { status: 204 });
  let url;
  try { url = new URL(endpoint); } catch { throw new Error("Configure MAILBOX_SYNC_URL for inbox automation"); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash
      || !url.pathname.endsWith("/api/v1/integrations/outlook/scheduled-sync") || secret.length < 32) {
    throw new Error("Inbox automation requires an HTTPS API endpoint and a 32-character server secret");
  }
  try {
    const response = await fetch(url, {
      method: "POST", headers: { "X-Mailbox-Sync-Secret": secret },
      signal: AbortSignal.timeout(20000), redirect: "error",
    });
    if (!response.ok) throw new Error(`Inbox schedule HTTP ${response.status}`);
  } catch (error) {
    // The incoming request wakes a sleeping host. The API also polls on startup,
    // and the next schedule retries from its durable database checkpoints.
    if (error?.name === "TimeoutError") {
      console.warn("Inbox schedule timed out; check backend sync status after its cold start");
      return new Response(null, { status: 202 });
    }
    throw new Error("Inbox schedule failed; check backend configuration and availability");
  }
  return new Response(null, { status: 202 });
}
