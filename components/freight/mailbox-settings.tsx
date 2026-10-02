"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { type Page, localDateInput } from "@/lib/freight";
import { Panel, Field, ErrorBanner, inputClass, buttonClass, secondaryClass } from "./shared";

type Mailbox = { id: string; address: string; enabled: boolean; sync_from: string; last_synced_at: string | null; last_error: string | null };
export function MailboxSettings() {
  const client = useQueryClient();
  const [address, setAddress] = useState("");
  const [start, setStart] = useState(() => localDateInput(new Date().toISOString()));
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [result, setResult] = useState("");
  const mailboxes = useQuery<Page<Mailbox> & { manual_mode: boolean }>({ queryKey: ["mailboxes", page], queryFn: async () =>
    (await api.get("/integrations/outlook/mailboxes", { params: { page, limit: 20 } })).data, refetchInterval: 30000 });
  async function run(action: () => Promise<unknown>) {
    setBusy(true); setError(null);
    try { await action(); await client.invalidateQueries({ queryKey: ["mailboxes"] }); }
    catch (e) { setError(e); } finally { setBusy(false); }
  }
  return <Panel title="Microsoft Outlook inboxes">
    <ErrorBanner error={error || mailboxes.error} />
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm">
      <span>{!mailboxes.data ? "Loading sync configuration" : mailboxes.data.manual_mode ? "Manual sync · automatic polling and scheduled reminders off" : "Automatic polling enabled"}</span>
      <button className={secondaryClass} disabled={busy} onClick={() => run(async () => {
        const response = await api.post("/integrations/outlook/check-alerts", {}, { timeout: 120000 });
        setResult(`Alert check completed: ${response.data.alerts} new overdue milestone alerts.`);
        await client.invalidateQueries({ queryKey: ["freight"] });
      })}>Check overdue milestones</button>
    </div>
    {result && <p role="status" className="mb-4 text-sm text-[#7068cf]">{result}</p>}
    {syncing && <p role="status" aria-live="polite" className="mb-4 text-sm">Syncing inbox and analysing messages…</p>}
    <form className="grid gap-4 md:grid-cols-3" onSubmit={e => { e.preventDefault(); run(async () => {
      await api.post("/integrations/outlook/mailboxes", { address, sync_from: new Date(start).toISOString() });
      setAddress(""); toast.success("Inbox connected");
    }); }}>
      <Field label="Mailbox address"><input type="email" required className={inputClass} value={address} onChange={e => setAddress(e.target.value)} /></Field>
      <Field label="Import messages received since"><input type="datetime-local" required className={inputClass} value={start} onChange={e => setStart(e.target.value)} /></Field>
      <div className="self-end"><button disabled={busy} className={buttonClass}>{busy ? "Connectingâ€¦" : "Connect inbox"}</button></div>
    </form>
    <div className="mt-5 space-y-3">
      {mailboxes.isLoading && <p className="text-sm text-[#858693]">Loading inboxesâ€¦</p>}
      {mailboxes.data?.total === 0 && <p className="text-sm text-[#858693]">No connected inboxes.</p>}
      {mailboxes.data?.items.map((m: Mailbox) => <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#eeecf5] p-4">
        <div><p className="text-sm font-semibold">{m.address}</p><p className="mt-1 text-xs text-[#858693]">{!m.enabled ? "Paused" : m.last_error ? "Sync error" : m.last_synced_at ? "Connected" : "Awaiting first sync"} Â· Last sync: {m.last_synced_at ? new Date(m.last_synced_at).toLocaleString() : "â€”"}</p>{m.last_error && <p className="mt-1 text-xs text-red-600">{m.last_error}</p>}</div>
        <button disabled={busy || !m.enabled} className={buttonClass} onClick={() => run(async () => {
          setSyncing(m.id); setResult("");
          try {
            const response = await api.post(`/integrations/outlook/mailboxes/${m.id}/sync`, {}, { timeout: 120000 });
            setResult(`${m.address}: ${response.data.messages} messages checked. ${response.data.more ? "More messages available — sync the next batch." : "Inbox is up to date."}`);
            await client.invalidateQueries({ queryKey: ["freight"] });
          } finally { setSyncing(null); }
        })}>{syncing === m.id ? "Syncing…" : "Sync inbox"}</button>
        <button disabled={busy} className={secondaryClass} onClick={() => run(() => api.patch(`/integrations/outlook/mailboxes/${m.id}`, { enabled: !m.enabled }))}>{m.enabled ? "Pause" : "Resume"}</button>
      </div>)}
    </div>
    <div className="mt-4 flex items-center justify-between text-xs"><span>{mailboxes.data?.total ?? 0} inboxes</span><div className="flex gap-2"><button className={secondaryClass} disabled={page === 1} onClick={() => setPage(page-1)}>Previous</button><button className={secondaryClass} disabled={page*20 >= (mailboxes.data?.total ?? 0)} onClick={() => setPage(page+1)}>Next</button></div></div>
  </Panel>;
}

export function PasswordSettings() {
  const [current, setCurrent] = useState(""); const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState<unknown>(null);
  return <Panel title="Change password"><ErrorBanner error={error} /><form className="grid gap-4 md:grid-cols-3" onSubmit={async e => {
    e.preventDefault(); setError(null);
    if (password !== confirm) { setError(new Error("Passwords do not match")); return; }
    setBusy(true); try { await api.post("/auth/password", { current_password: current, new_password: password });
      setCurrent(""); setPassword(""); setConfirm(""); toast.success("Password changed. Sign in again.");
      localStorage.removeItem("freightos_token"); localStorage.removeItem("freightos_refresh_token");
      document.cookie = "freightos_token=; path=/; Max-Age=0; SameSite=Lax"; window.location.assign("/login");
    } catch(e) { setError(e); } finally { setBusy(false); }
  }}><Field label="Current password"><input type="password" autoComplete="current-password" required className={inputClass} value={current} onChange={e => setCurrent(e.target.value)} /></Field>
  <Field label="New password"><input type="password" autoComplete="new-password" required minLength={12} className={inputClass} value={password} onChange={e => setPassword(e.target.value)} /></Field>
  <Field label="Confirm new password"><input type="password" autoComplete="new-password" required minLength={12} className={inputClass} value={confirm} onChange={e => setConfirm(e.target.value)} /></Field>
  <button className={buttonClass} disabled={busy}>Change password</button></form></Panel>;
}
