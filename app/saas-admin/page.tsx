"use client";
import { useEffect, useState } from "react";
import { Building2, Command, LogOut, ShieldCheck, Users, CheckCircle2 } from "lucide-react";
import { inputClass, buttonClass, secondaryClass, Field } from "@/components/freight/shared";

type Administrator = { id: string; name: string; email: string; active: boolean };
type CompanyState = { slug: string; company: { id: string; name: string; active: boolean } | null; administrators: Administrator[]; total: number; page: number; limit: number };
const base = process.env.NEXT_PUBLIC_API_BASE_URL || "/api/v1";
async function request(path: string, token: string, body?: unknown): Promise<any> {
  const response = await fetch(`${base}/provider${path}`, { method: body === undefined ? "GET" : "POST", cache: "no-store",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(typeof data.detail === "string" ? data.detail : Array.isArray(data.detail) ? data.detail.map((e: {msg: string}) => e.msg).join("; ") : "Request failed");
  }
  return response.status === 204 ? null : response.json();
}

export default function ProviderAdminPage() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState(""); const [credential, setCredential] = useState("");
  const [state, setState] = useState<CompanyState | null>(null);
  const [error, setError] = useState(""); const [success, setSuccess] = useState(""); const [busy, setBusy] = useState(false);
  const [name, setName] = useState(""); const [adminName, setAdminName] = useState(""); const [adminEmail, setAdminEmail] = useState("");
  const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState("");
  const [reset, setReset] = useState<Administrator | null>(null);
  function clearSession() { setToken(""); setState(null); setCredential(""); setPassword(""); setConfirm(""); setReset(null); setSuccess(""); }
  useEffect(() => { if (!token) return; const timer = window.setTimeout(() => { clearSession(); setError("Session expired. Sign in again."); }, 15 * 60 * 1000); return () => window.clearTimeout(timer); }, [token]);
  async function run(action: () => Promise<void>) { setBusy(true); setError(""); setSuccess(""); try { await action(); } catch(e) { setError(e instanceof Error ? e.message : "Request failed"); } finally { setBusy(false); } }
  const passwordFields = <><Field label="Administrator password"><input className={inputClass} required type="password" minLength={12} maxLength={72} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></Field><Field label="Confirm password"><input className={inputClass} required type="password" minLength={12} maxLength={72} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} /></Field></>;
  return <main className="min-h-screen bg-[#e8e9f6] px-4 py-8 text-[#171725] md:px-10">
    <div className="mx-auto max-w-5xl">
      <header className="mb-10 flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="rounded-xl bg-gradient-to-br from-[#746ad1] to-[#55b9cb] p-3 text-white"><Command size={23} /></span><div><div className="text-xl font-semibold tracking-tight">Freight<span className="text-[#7770d4]">OS</span></div><p className="text-xs text-[#858693]">Provider administration</p></div></div>{token && <button className={secondaryClass} onClick={clearSession}><LogOut size={14} className="mr-2 inline" />Sign out</button>}</header>
      {error && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {success && <div role="status" className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"><CheckCircle2 size={16} className="mr-2 inline" />{success}</div>}
      {!token ? <section className="mx-auto max-w-md rounded-[20px] border border-white/80 bg-white p-7 shadow-[0_22px_60px_rgba(82,78,137,0.12)]"><ShieldCheck className="mb-4 text-[#7068cf]" size={30} /><h1 className="mb-6 text-2xl font-semibold">SaaS administrator sign in</h1><form className="space-y-5" onSubmit={e => {e.preventDefault(); run(async () => {
        const session = await request("/session", "", { email, password: credential });
        const company = await request("/company", session.access_token);
        setCredential(""); setState(company); setToken(session.access_token);
      });}}><Field label="Provider email"><input required type="email" autoComplete="username" className={inputClass} value={email} onChange={e => setEmail(e.target.value)} /></Field><Field label="Provider password"><input required type="password" autoComplete="current-password" className={inputClass} value={credential} onChange={e => setCredential(e.target.value)} /></Field><button disabled={busy} className={`${buttonClass} w-full`}>{busy ? "Signing in…" : "Sign in"}</button></form></section> : <>
        <div className="mb-6"><p className="text-xs font-semibold uppercase tracking-widest text-[#7068cf]">Company administration</p><h1 className="mt-2 text-3xl font-semibold">{state?.company?.name || "Onboard a company"}</h1><p className="mt-2 text-sm text-[#858693]">Workspace · {state?.slug}</p></div>
        {!state?.company ? <form className="rounded-[20px] border border-white/80 bg-white p-6 shadow-sm" onSubmit={e => { e.preventDefault(); run(async () => {
          if (password !== confirm) throw new Error("Passwords do not match");
          await request("/company", token, { name, slug: state?.slug, admin_name: adminName, email: adminEmail, password });
          setPassword(""); setConfirm(""); setState(await request("/company", token)); setSuccess("Company and administrator created.");
        }); }}><div className="mb-6 flex items-center gap-3"><Building2 size={22} className="text-[#7068cf]" /><h2 className="text-lg font-semibold">Company and first administrator</h2></div><div className="grid gap-5 md:grid-cols-2"><Field label="Company name"><input required maxLength={255} minLength={2} className={inputClass} value={name} onChange={e => setName(e.target.value)} /></Field><Field label="Company reference"><input readOnly className={`${inputClass} bg-[#f7f7fb]`} value={state?.slug || ""} /></Field><Field label="Administrator name"><input required minLength={2} maxLength={255} autoComplete="name" className={inputClass} value={adminName} onChange={e => setAdminName(e.target.value)} /></Field><Field label="Administrator email"><input required type="email" autoComplete="email" className={inputClass} value={adminEmail} onChange={e => setAdminEmail(e.target.value)} /></Field>{passwordFields}</div><button className={`${buttonClass} mt-6`} disabled={busy}>{busy ? "Creating company…" : "Create company"}</button></form> : <>
          <div className="mb-6 grid gap-4 md:grid-cols-3">{[["Company status", state.company.active ? "Active" : "Inactive"], ["Workspace", state.slug], ["Administrators", String(state.total)]].map(([label,value]) => <div key={label} className="rounded-2xl bg-white p-5"><p className="text-xs text-[#858693]">{label}</p><p className="mt-2 break-words text-lg font-semibold">{value}</p></div>)}</div>
          <section className="rounded-[20px] bg-white p-6"><div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-lg font-semibold"><Users size={20} className="mr-2 inline text-[#7068cf]" />Company administrators</h2><a className={secondaryClass} href="/login">Company sign in</a></div><div className="space-y-3">{state.administrators.map(admin => <div key={admin.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#eeecf5] p-4"><div><p className="text-sm font-semibold">{admin.name}</p><p className="break-all text-xs text-[#858693]">{admin.email} · {admin.active ? "Active" : "Inactive"}</p></div><button disabled={!admin.active || busy} className={secondaryClass} onClick={() => { setReset(admin); setPassword(""); setConfirm(""); setSuccess(""); }}>Reset password</button></div>)}</div><div className="mt-4 flex justify-end gap-2"><button className={secondaryClass} disabled={busy || state.page === 1} onClick={() => run(async () => setState(await request(`/company?page=${state.page-1}`, token)))}>Previous</button><button className={secondaryClass} disabled={busy || state.page * state.limit >= state.total} onClick={() => run(async () => setState(await request(`/company?page=${state.page+1}`, token)))}>Next</button></div></section>
          {reset && <section className="mt-6 rounded-[20px] bg-white p-6"><h2 className="mb-2 text-lg font-semibold">Reset administrator password</h2><p className="mb-5 text-sm text-[#858693]">{reset.email}</p><form className="grid gap-5 md:grid-cols-2" onSubmit={e => { e.preventDefault(); run(async () => {
            if (password !== confirm) throw new Error("Passwords do not match");
            await request("/administrator-password", token, { email: reset.email, password });
            setPassword(""); setConfirm(""); setReset(null); setSuccess("Password reset. Existing sessions have been revoked.");
          }); }}>{passwordFields}<div className="flex gap-3 md:col-span-2"><button disabled={busy} className={buttonClass}>Reset password</button><button type="button" disabled={busy} className={secondaryClass} onClick={() => {setReset(null);setPassword("");setConfirm("");}}>Cancel</button></div></form></section>}
        </>}
      </>}
    </div>
  </main>;
}
