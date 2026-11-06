"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { type Page, localDateInput } from "@/lib/freight";
import { Panel, Field, ErrorBanner, inputClass, buttonClass, secondaryClass } from "./shared";

type Mailbox = { id: string; address: string; enabled: boolean; sync_from: string; last_synced_at: string | null; last_error: string | null };
type MailboxPage = Page<Mailbox> & { manual_mode: boolean; polling_mode?: string; poll_interval_seconds?: number };

function importTimestamp(value: string) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw new Error("Choose a valid import date and time.");
  if (date.getTime() > Date.now()) throw new Error("Import start cannot be in the future.");
  return date.toISOString();
}

export function MailboxSettings() {
  const client = useQueryClient();
  const [address, setAddress] = useState("");
  const [start, setStart] = useState(() => localDateInput(new Date().toISOString()));
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [importStarts, setImportStarts] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [result, setResult] = useState("");
  const mailboxes = useQuery<MailboxPage>({ queryKey: ["mailboxes", page], queryFn: async () =>
    (await api.get("/integrations/outlook/mailboxes", { params: { page, limit: 20 } })).data, refetchInterval: 30000 });
  async function run(action: () => Promise<unknown>) {
    setBusy(true); setError(null);
    try { await action(); }
    catch (e) { setError(e); } finally {
      void client.invalidateQueries({ queryKey: ["mailboxes"] });
      setBusy(false);
    }
  }
  function rememberMailbox(updated: Mailbox) {
    client.setQueriesData<MailboxPage>({ queryKey: ["mailboxes"] }, (current: MailboxPage | undefined) => current ? {
      ...current, items: current.items.map(mailbox => mailbox.id === updated.id ? updated : mailbox),
    } : current);
  }
  return <Panel title="Microsoft Outlook inboxes">
    <ErrorBanner error={error || mailboxes.error} />
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm">
      <span>{!mailboxes.data ? "Loading sync configuration" : mailboxes.data.polling_mode === "api" ? `Inbox and Sent Items checked automatically every ${mailboxes.data.poll_interval_seconds ?? 60} seconds while the backend is running` : mailboxes.data.polling_mode === "worker" ? "Inbox automation uses the background worker" : "Automatic inbox polling is off"}</span>
      <button className={secondaryClass} disabled={busy} onClick={() => run(async () => {
        const response = await api.post("/integrations/outlook/check-alerts", {}, { timeout: 120000 });
        setResult(`Alert check completed: ${response.data.alerts} new milestone and D&D risk alerts.`);
        await client.invalidateQueries({ queryKey: ["freight"] });
      })}>Check milestone & D&D alerts</button>
    </div>
    {result && <p role="status" className="mb-4 text-sm text-[#7068cf]">{result}</p>}
    {syncing && <p role="status" aria-live="polite" className="mb-4 text-sm">Syncing inbox and analysing messages…</p>}
    <h3 className="mb-2 text-sm font-semibold">Connect a new inbox</h3>
    <p className="mb-4 text-xs text-[#858693]">This date is saved when you connect a new inbox. Change an existing inbox&apos;s import date in its settings below. Dates and times use your browser&apos;s local time.</p>
    <form className="grid gap-4 md:grid-cols-3" onSubmit={e => { e.preventDefault(); run(async () => {
      setConnecting(true);
      try {
        await api.post("/integrations/outlook/mailboxes", { address, sync_from: importTimestamp(start) }, { timeout: 120000 });
        setAddress(""); toast.success("Inbox connected");
      } finally { setConnecting(false); }
    }); }}>
      <Field label="Mailbox address"><input type="email" required className={inputClass} value={address} onChange={e => setAddress(e.target.value)} /></Field>
      <Field label="Import messages received since"><input type="datetime-local" required aria-label="Initial import date for a new inbox" max={localDateInput(new Date().toISOString())} className={inputClass} value={start} onChange={e => setStart(e.target.value)} /></Field>
      <div className="self-end"><button disabled={busy} className={buttonClass}>{connecting ? "Connecting..." : "Connect inbox"}</button></div>
    </form>
    <div className="mt-5 space-y-3">
      {mailboxes.isLoading && <p className="text-sm text-[#858693]">Loading inboxes...</p>}
      {mailboxes.data?.total === 0 && <p className="text-sm text-[#858693]">No connected inboxes.</p>}
      {mailboxes.data?.items.map((m: Mailbox) => {
        const selectedStart = importStarts[m.id] ?? localDateInput(m.sync_from);
        const dateChanged = selectedStart !== localDateInput(m.sync_from);
        return <div key={m.id} className="space-y-4 rounded-lg border border-[#eeecf5] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{m.address}</p>
              <p className="mt-1 text-xs text-[#858693]">{!m.enabled ? "Paused" : m.last_error ? "Sync error" : m.last_synced_at ? "Connected" : "Awaiting first sync"} - Last sync: {m.last_synced_at ? new Date(m.last_synced_at).toLocaleString() : "Never"}</p>
              <p className="mt-1 text-xs text-[#858693]">Saved import start: <time dateTime={m.sync_from}>{new Date(m.sync_from).toLocaleString()}</time></p>
              {m.last_error && <p className="mt-1 text-xs text-red-600">{m.last_error}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <button disabled={busy || !m.enabled || dateChanged} className={buttonClass} onClick={() => run(async () => {
                setSyncing(m.id); setResult("");
                try {
                  const response = await api.post(`/integrations/outlook/mailboxes/${m.id}/sync`, {}, { timeout: 120000 });
                  setResult(`${m.address}: ${response.data.messages} messages checked. ${response.data.more ? "Import continues automatically while inbox automation is running." : "Inbox and Sent Items are up to date for the saved import period."}`);
                  await client.invalidateQueries({ queryKey: ["freight"] });
                } finally { setSyncing(null); }
              })}>{syncing === m.id ? "Syncing…" : "Sync inbox"}</button>
              <button disabled={busy} className={secondaryClass} onClick={() => run(async () => {
                const response = await api.patch(`/integrations/outlook/mailboxes/${m.id}`, { enabled: !m.enabled });
                rememberMailbox(response.data);
              })}>{m.enabled ? "Pause" : "Resume"}</button>
            </div>
          </div>
          <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]" onSubmit={e => {
            e.preventDefault(); run(async () => {
              setSaving(m.id);
              try {
                const response = await api.patch(`/integrations/outlook/mailboxes/${m.id}`, { sync_from: importTimestamp(selectedStart) });
                rememberMailbox(response.data);
                setImportStarts(current => { const next = { ...current }; delete next[m.id]; return next; });
                setResult(`${m.address}: Import date saved. Automatic inbox checks will recheck messages from ${new Date(response.data.sync_from).toLocaleString()}.`);
                toast.success("Import date saved");
              } finally { setSaving(null); }
            });
          }}>
            <Field label="Import messages received since">
              <input type="datetime-local" required aria-label={`Import date for ${m.address}`} aria-describedby={`import-help-${m.id}`} disabled={busy} max={localDateInput(new Date().toISOString())} className={inputClass} value={selectedStart} onChange={e => setImportStarts(current => ({ ...current, [m.id]: e.target.value }))} />
            </Field>
            <button disabled={busy || !dateChanged} className={`${secondaryClass} self-end`}>{saving === m.id ? "Saving..." : "Save import date"}</button>
          </form>
          <p id={`import-help-${m.id}`} className="text-xs text-[#858693]">{dateChanged ? "Save the changed import date before syncing. " : ""}Saving a new date rechecks Inbox and Sent Items from that date. Previously imported messages stay in your workspace. Replies that copy this mailbox are detected in Inbox. For other replies, connect the replying mailbox or save shared-mailbox replies in its Sent Items.</p>
        </div>;
      })}
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
