import React, { useEffect, useRef } from "react";
import { api, configured, signInWithGoogle } from "./src/auth";
import { useWorkspace, type Workspace } from "./src/workspace";
import { NetworkAdmin, PendingWork, Profile, TaskDetail, WarehouseListings, WarehouseSpace } from "./src/screens";
import { Button } from "./src/ui.web";
import { Brand, GoogleMark, Icon, StateBadge, WebInbox, WebTaskList, WorkflowIllustration } from "./src/web-ui";
import "./src/web.css";

function SignInPage({ error }: { error: string }) {
  return <div className="auth-page">
    <header className="auth-header"><Brand/><span className="auth-header-note"><Icon name="shield" size={15}/> Your freight. Your team. One workspace.</span></header>
    <main className="auth-layout">
      <section className="auth-story"><span className="eyebrow"><i/> BUILT FOR TRANSPORT TEAMS</span><h1>Accept. Assign.<br/><span>Keep freight moving.</span></h1><p className="auth-description">A little less coordination.<br/>A lot more getting things delivered.</p><WorkflowIllustration/><p className="story-footer"><Icon name="truck" size={16}/> Pickup & delivery <span/> Customs clearance <span/> Warehousing</p></section>
      <section className="auth-welcome"><div className="welcome-icon"><Icon name="truck" size={26}/></div><span className="eyebrow">YOUR PARTNER WORKSPACE</span><h2>Welcome aboard.</h2><p>Sign in to manage your freight jobs,<br className="desktop-break"/> assign drivers and keep everyone updated.</p>
        <div className="google-action"><Button disabled={!configured} onPress={signInWithGoogle}><GoogleMark/>Continue with Google<Icon name="arrow" size={17}/></Button></div>
        <a className="live-demo-entry" href="/v1/demo/">Try the Meridian WhatsApp & GPS demo <Icon name="arrow" size={16}/><small>No Google login needed · Temporary sample job</small></a>
        {(error || !configured) && <p className="inline-error" role="alert">{error || "The app connection is unavailable. Please contact the service owner."}</p>}
        <div className="auth-divider"><span/>One sign-in. All your freight companies.<span/></div>
        <ul className="welcome-features"><li><span><Icon name="jobs" size={18}/></span><div><strong>Your jobs, organised</strong><small>Assignments and instructions in one place.</small></div></li><li><span><Icon name="chat" size={18}/></span><div><strong>Hand off with a WhatsApp link</strong><small>Your driver opens their job on their phone.</small></div></li><li><span><Icon name="inbox" size={18}/></span><div><strong>Every update, easy to find</strong><small>Job updates and enquiries in your Inbox.</small></div></li></ul>
        <div className="auth-safe"><Icon name="shield" size={17}/><p>Use your Google account. Your phone number is used for contact and driver sharing.</p></div>
      </section>
    </main>
    <footer className="auth-footer"><span>Freight Partners · Part of your freight workflow</span><span>For agents, customs partners & warehouse teams</span></footer>
  </div>;
}

const pages: Record<string, { label: string; icon: string; title: string; subtitle: string }> = {
  Tasks: { label: "My jobs", icon: "jobs", title: "Your jobs, in motion.", subtitle: "Review assignments, manage drivers and follow the next step." },
  Inbox: { label: "Inbox", icon: "inbox", title: "Your Inbox", subtitle: "Assignments, changed instructions and enquiries, all together." },
  Profile: { label: "My profile", icon: "user", title: "Your partner profile", subtitle: "Keep your contact details and service coverage up to date." },
  Space: { label: "Space requests", icon: "building", title: "Space requests", subtitle: "Review warehouse enquiries, offers and confirmed reservations." },
  Warehouses: { label: "Warehouses", icon: "building", title: "Your warehouse network", subtitle: "Manage listings, storage capacity and availability." },
  Admin: { label: "Verification", icon: "shield", title: "Partner verification", subtitle: "Review business profiles before they join the directory." },
};
export function PartnerWebWorkspace({ workspace: w }: { workspace: Workspace }) {
  const scroll = useRef<HTMLElement | null>(null);
  useEffect(() => { scroll.current?.scrollTo({ top: 0 }); }, [w.tab, w.selected?.id, w.profile?.id]);
  const { session, profile, tasks, selected, setSelected, tab, setTab, error, connected, space, reservations, inbox, warehouses, refresh, open, logout, booting, loading, profileLoaded } = w;
  if (booting) return <main className="boot-page"><Brand/><span className="button-spinner"/><p>Opening your workspace…</p></main>;
  if (!session) return <SignInPage error={error}/>;
  const onboarding = profileLoaded && !profile;
  const active = onboarding ? "Profile" : tab;
  const currentSelected = selected ? tasks.find((task) => task.id === selected.id) || selected : null;
  const transport = selected && ["pickup", "delivery"].includes(selected.kind);
  const page = pages[active] || pages.Tasks;
  const name = profile?.name || session.user.user_metadata?.full_name || "Partner";
  const initial = String(name).trim().split(/\s+/).slice(0,2).map((part) => part[0]).join("");
  const unread = inbox.filter((item) => !item.read_at).length;
  const tabs = ["Tasks", ...(profile?.capabilities?.includes("warehouse_owner") ? ["Space", "Warehouses"] : []), "Inbox", "Profile", ...(profile?.is_network_admin ? ["Admin"] : [])];
  const navigate = (name: string) => { setTab(name); setSelected(null); };
  const nav = (mobile = false) => tabs.map((name) => <button type="button" key={name} disabled={!profile && name !== "Profile"} title={!profile && name !== "Profile" ? "Save your partner profile to get started" : undefined} className={`nav-item ${active === name ? "is-active" : ""}`} aria-current={active === name ? "page" : undefined} onClick={() => navigate(name)}><Icon name={pages[name].icon} size={mobile ? 21 : 19}/><span>{pages[name].label}</span>{name === "Inbox" && unread > 0 && <b className="nav-count">{unread}</b>}</button>);
  return <div className="workspace-page">
    <a className="skip-link" href="#partner-main">Skip to workspace</a>
    <aside className="workspace-sidebar"><Brand/><div className="workspace-label">PARTNER WORKSPACE</div><nav aria-label="Workspace navigation">{nav()}</nav><div className="sidebar-help"><span className="help-icon"><Icon name="truck" size={25}/></span><strong>Your next move,<br/>made easier.</strong><p>Accept a job. Assign your driver. Share their link.</p></div><div className="sidebar-account"><span className="account-avatar">{initial}</span><div><strong>{name}</strong><small>{profile?.capabilities?.includes("pickup_delivery") ? "Transport partner" : "Freight partner"}</small></div><button type="button" title="My profile" aria-label="My profile" onClick={() => navigate("Profile")}><Icon name="chevron" size={16}/></button></div></aside>
    <div className="workspace-body"><header className="workspace-topbar"><div className="mobile-brand"><Brand compact/></div><div className="workspace-breadcrumb">Workspace <Icon name="chevron" size={13}/><strong>{onboarding ? "Get started" : page.label}</strong></div><div className="topbar-actions"><span className={`connection-status ${!connected ? "is-offline" : ""}`}><i/>{connected ? "Online" : "Offline"}</span><button type="button" className="icon-button inbox-shortcut" disabled={!profile} aria-label={`Open Inbox${unread ? `, ${unread} unread` : ""}`} onClick={() => navigate("Inbox")}><Icon name="bell"/>{unread > 0 && <i/>}</button><button type="button" className="account-avatar" aria-label="Open my profile" onClick={() => navigate("Profile")}>{initial}</button></div></header>
      <main ref={scroll} id="partner-main" className={`workspace-main ${active === "Profile" ? "profile-page" : ""}`}>
        <div className="page-heading"><div><div className="eyebrow">{onboarding ? "WELCOME TO FREIGHT PARTNERS" : active === "Tasks" && !selected ? `HELLO, ${String(name).split(" ")[0].toLocaleUpperCase()}` : "YOUR PARTNER WORKSPACE"}</div><h1>{onboarding ? "Let's get you ready to move." : selected && active === "Tasks" ? selected.job_reference : page.title}</h1><p>{onboarding ? "A few details to connect you with the right freight companies." : selected && active === "Tasks" ? (transport ? "Review the briefing, assign your driver and share their job link." : "Review the briefing, record clearance progress and attach the required proof.") : page.subtitle}</p></div><button type="button" className={`refresh-button ${loading ? "is-loading" : ""}`} aria-label="Refresh workspace" disabled={loading} onClick={() => void refresh()}><Icon name="refresh" size={17}/><span>{loading ? "Refreshing" : "Refresh"}</span></button></div>
        {error && <div className="workspace-alert" role="alert"><Icon name="inbox" size={18}/><span>{error}</span></div>}
        {!connected && <div className="offline-banner">You're viewing saved work. Pending updates will sync when you reconnect.</div>}
        <PendingWork reload={refresh}/>
        {!profileLoaded ? <div className="workspace-loading"><span className="button-spinner"/><h2>{error ? "Your workspace couldn't load" : "Getting your workspace ready"}</h2><p>{error ? "Use Refresh to try again. Your saved work stays on this browser." : "Connecting to your freight jobs and updates…"}</p></div> :
          !profile || active === "Profile" ? <div className="profile-layout"><div className="profile-sections"><Profile key={profile?.id || "new"} profile={profile} reload={refresh} logout={logout}/></div><aside className="profile-guide"><span className="guide-icon"><Icon name="shield" size={25}/></span><h2>{onboarding ? "Your work starts here." : "Connected by design."}</h2><p>Your profile helps freight companies find the services you offer.</p><ol><li><span>1</span><div><strong>Set up your profile</strong><p>Add your name, services and coverage.</p></div></li><li><span>2</span><div><strong>Connect with a company</strong><p>Company approval controls job access.</p></div></li><li><span>3</span><div><strong>Manage your assignments</strong><p>Accept jobs, assign drivers and keep updates together.</p></div></li></ol><div className="profile-google"><GoogleMark/><div><small>SIGNED IN WITH GOOGLE</small><strong>{session.user.email}</strong></div></div></aside></div> :
          active === "Tasks" ? selected ? <div className="detail-sections"><div className="task-workflow"><span><Icon name="jobs" size={16}/> Review job</span><Icon name="chevron" size={13}/><span><Icon name={transport ? "user" : "file"} size={16}/>{transport ? "Assign driver" : "Record clearance"}</span><Icon name="chevron" size={13}/><span><Icon name={transport ? "chat" : "check"} size={16}/>{transport ? "Share link" : "Submit proof"}</span><StateBadge status={currentSelected?.status || selected.status}/></div><TaskDetail initial={selected} back={() => setSelected(null)} changed={refresh}/></div> : <WebTaskList tasks={tasks} select={setSelected}/> :
          active === "Inbox" ? <WebInbox items={inbox} open={open} markRead={async (item) => { await api(`/inbox/${item.id}/read`, "POST"); await refresh(); }}/> :
          active === "Space" ? <div className="detail-sections"><WarehouseSpace enquiries={space} reservations={reservations} reload={refresh}/></div> :
          active === "Warehouses" ? <div className="detail-sections"><WarehouseListings listings={warehouses} reload={refresh}/></div> : active === "Admin" ? <div className="detail-sections"><NetworkAdmin/></div> : null}
        <footer className="workspace-footer"><span>Freight Partners</span><p>Inbox updates while open · Browser location sharing needs an active page</p></footer>
      </main>
    </div>
    <nav className="mobile-navigation" aria-label="Mobile workspace navigation">{nav(true)}</nav>
  </div>;
}
export default function App() { return <PartnerWebWorkspace workspace={useWorkspace()}/>; }
