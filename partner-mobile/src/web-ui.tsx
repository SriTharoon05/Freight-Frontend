import React, { useState } from "react";
import { label, terminal, type Json, type Task } from "./types";
import { jobSummary, visibleJobs, type JobFilter } from "./web-domain";
import { Button } from "./ui.web";

const paths: Record<string, React.ReactNode> = {
  box: <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="M3 8v9l9 5 9-5V8M12 13v9M7.5 5.5l9 5"/></>,
  jobs: <><rect x="4" y="5" width="16" height="16" rx="3"/><path d="M9 5V3h6v2M8 10h8M8 14h5M8 18h3"/></>,
  truck: <><path d="M3 6h11v11H3zM14 10h4l3 4v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></>,
  inbox: <><path d="M4 5h16l2 12v3H2v-3L4 5Z"/><path d="M3 14h5l2 3h4l2-3h5"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
  check: <path d="m5 12 4 4L19 6"/>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/></>,
  shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-2l2 3M4 16l2 3a7 7 0 0 0 12-2"/></>,
  search: <><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></>,
  building: <><path d="M4 21V7l8-4 8 4v14M2 21h20M9 21v-5h6v5M8 9h1m6 0h1M8 12h1m6 0h1"/></>,
  logout: <><path d="M9 4H4v16h5M9 12h12m-4-4 4 4-4 4"/></>,
  bell: <><path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3ZM10 21h4"/></>,
  chevron: <path d="m9 5 7 7-7 7"/>,
  file: <><path d="M14 3H5v18h14V8l-5-5ZM14 3v5h5M8 12h8M8 16h5"/></>,
  chat: <><path d="M20 11a8 8 0 0 1-8 8H5l-4 3 2-7a8 8 0 1 1 17-4Z"/><path d="M7 10h9M7 14h5"/></>,
};
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.box}</svg>;
}
export function Brand({ compact = false }: { compact?: boolean }) {
  return <div className="partner-brand"><span className="brand-mark"><Icon name="box" size={23}/></span><div><strong>Freight<span>Partners</span></strong>{!compact && <small>YOUR OPERATIONS, CONNECTED</small>}</div></div>;
}
export function GoogleMark() {
  return <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M43.6 20.5H42V20H24v8h11.3A12 12 0 1 1 32 14.7l5.7-5.7A20 20 0 1 0 44 24c0-1.2-.1-2.4-.4-3.5Z"/><path fill="#34A853" d="M6.3 33.7 12.9 29a12 12 0 0 0 19.7 4.6l6.2 5.2A20 20 0 0 1 6.3 33.7Z"/><path fill="#FBBC05" d="M4 24c0-3.2.8-6.2 2.1-8.9l6.6 4.8a12 12 0 0 0 .2 9.1l-6.6 4.7A19.9 19.9 0 0 1 4 24Z"/><path fill="#EA4335" d="M24 4a20 20 0 0 1 13.7 5l-5.7 5.7a12 12 0 0 0-19.3 5.2l-6.6-4.8A20 20 0 0 1 24 4Z"/></svg>;
}
export function StateBadge({ status }: { status: string }) {
  const tone = ["completed", "verified"].includes(status) ? "green" : ["cancelled", "rejected"].includes(status) ? "red" : ["pending_accept", "awaiting_verification", "pending"].includes(status) ? "orange" : "violet";
  const names: Record<string, string> = { pending_accept: "To accept", accepted: "Accepted", in_progress: "In progress", awaiting_verification: "Under review" };
  return <span className={`status-badge tone-${tone}`}><i/>{names[status] || label(status)}</span>;
}
export function EmptyState({ icon = "jobs", title, children }: { icon?: string; title: string; children: React.ReactNode }) {
  return <div className="empty-state"><span className="empty-art"><Icon name={icon} size={30}/></span><h2>{title}</h2><p>{children}</p></div>;
}
export function WorkflowIllustration() {
  return <div className="workflow-art" aria-label="Accept a job, assign a driver and share their link on WhatsApp">
    <div className="art-grid" aria-hidden="true"/>
    <div className="art-dispatch"><span className="art-truck"><Icon name="truck" size={39}/></span><div><small>ONE SIMPLE WORKFLOW</small><strong>From your desk.<br/>To their next stop.</strong></div><span className="art-route-dash" aria-hidden="true"/></div>
    <div className="art-step step-one"><span className="step-icon"><Icon name="jobs"/></span><div><small>01 · THE ASSIGNMENT</small><strong>Accept a freight job</strong></div><span className="mini-check"><Icon name="check" size={15}/></span></div>
    <div className="art-step step-two"><span className="step-icon"><Icon name="user"/></span><div><small>02 · YOUR TEAM</small><strong>Assign the right driver</strong></div><span className="mini-avatar">D</span></div>
    <div className="art-step step-three"><span className="step-icon"><Icon name="chat"/></span><div><small>03 · READY TO GO</small><strong>Share their job link</strong></div><span className="whatsapp-tag">WhatsApp</span></div>
    <div className="art-caption"><Icon name="shield" size={15}/> The link opens only for the assigned Google account.</div>
  </div>;
}
export function WebTaskList({ tasks, select }: { tasks: Task[]; select: (task: Task) => void }) {
  const [filter, setFilter] = useState<JobFilter>("all"), [search, setSearch] = useState("");
  const counts = jobSummary(tasks), visible = visibleJobs(tasks, filter, search);
  return <>
    <div className="job-stats">
      {([{ id: "attention", icon: "clock", name: "Needs attention", count: counts.attention, tone: "orange" },
        { id: "active", icon: "truck", name: "Active jobs", count: counts.active, tone: "violet" },
        { id: "completed", icon: "check", name: "Completed", count: counts.completed, tone: "green" }] as const).map((stat) =>
        <button type="button" key={stat.id} className={`stat-card stat-${stat.tone} ${filter === stat.id ? "stat-selected" : ""}`} onClick={() => setFilter(filter === stat.id ? "all" : stat.id)} aria-pressed={filter === stat.id}>
          <span className="stat-icon"><Icon name={stat.icon}/></span><span><small>{stat.name}</small><strong>{String(stat.count).padStart(2, "0")}</strong></span><Icon name="chevron" size={16}/>
        </button>)}
    </div>
    <div className="jobs-toolbar"><div className="job-tabs" aria-label="Filter jobs">{([['all','All jobs'],['attention','To review'],['active','Active'],['completed','Completed']] as [JobFilter,string][]).map(([id, name]) => <button type="button" aria-pressed={filter === id} className={filter === id ? "active" : ""} key={id} onClick={() => setFilter(id)}>{name}</button>)}</div>
      <label className="job-search"><Icon name="search" size={17}/><input aria-label="Search jobs" placeholder="Search jobs or drivers" value={search} onChange={(event) => setSearch(event.target.value)}/></label>
    </div>
    <div className="list-heading"><h2>Your assignments <span>{visible.length}</span></h2><p>All your freight companies, in one place.</p></div>
    {!visible.length ? <EmptyState title={tasks.length ? "No matching jobs" : "Ready for your next assignment"}>{tasks.length ? "Try a different search or job filter." : "Jobs from your connected freight companies will appear here. Accept a job to assign a driver and share their link."}</EmptyState> :
      <div className="job-grid">{visible.map((task) => <article className="job-card" key={task.id}>
        <div className="job-card-top"><span className={`job-type ${task.kind === "delivery" ? "type-teal" : ""}`}><Icon name={task.kind.startsWith("customs") ? "file" : "truck"}/></span><div><small>{task.company_name}</small><h3>{task.job_reference}</h3></div><StateBadge status={task.status}/></div>
        <div className="job-meta"><span>{label(task.kind)}</span><span><Icon name="clock" size={13}/>{task.scheduled_at ? new Date(task.scheduled_at).toLocaleDateString(undefined,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : "Schedule in briefing"}</span></div>
        <div className="job-route"><div><span className="route-dot"/><span><small>FROM</small><strong>{task.briefing?.origin || task.briefing?.collection_address || "See collection instructions"}</strong></span></div><div><span className="route-dot route-end"/><span><small>TO</small><strong>{task.briefing?.destination || task.briefing?.delivery_address || "See destination instructions"}</strong></span></div></div>
        <div className="job-driver"><Icon name={task.kind.startsWith("customs") ? "file" : "user"} size={16}/><span>{task.kind.startsWith("customs") ? "Customs clearance task" : task.driver ? task.driver.name : task.status === "pending_accept" ? "Accept first, then assign your driver" : "Driver not assigned"}</span>{task.driver?.vehicle && <small>{task.driver.vehicle}</small>}</div>
        {!terminal(task.status) && task.acknowledged_brief_version < task.brief_version && <p className="job-notice">Updated instructions need your review.</p>}
        {task.pending_sync && <p className="job-notice">Your update is waiting to sync.</p>}
        <button type="button" className="job-open" onClick={() => select(task)}>{task.status === "pending_accept" ? "Review assignment" : terminal(task.status) ? "View job history" : task.kind.startsWith("customs") ? "View assignment" : "View job & driver"}<Icon name="arrow" size={17}/></button>
      </article>)}</div>}
  </>;
}
export function WebInbox({ items, open, markRead }: { items: Json[]; open: (item: Json) => void; markRead: (item: Json) => Promise<void> }) {
  const [filter, setFilter] = useState("all");
  const unread = items.filter((item) => !item.read_at).length;
  const visible = items.filter((item) => filter !== "unread" || !item.read_at);
  return <>
    <div className="jobs-toolbar"><div className="job-tabs" aria-label="Filter inbox"><button type="button" className={filter === "all" ? "active" : ""} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All updates <span>{items.length}</span></button><button type="button" className={filter === "unread" ? "active" : ""} aria-pressed={filter === "unread"} onClick={() => setFilter("unread")}>Unread <span>{unread}</span></button></div><p className="quiet-copy">Job updates & warehouse enquiries</p></div>
    {!visible.length ? <EmptyState icon="inbox" title={filter === "unread" ? "You're all caught up" : "Your updates arrive here"}>New assignments, instructions and warehouse enquiries will appear in your Inbox.</EmptyState> :
      <div className="inbox-list">{visible.map((item) => <article className={`inbox-item ${!item.read_at ? "is-unread" : ""}`} key={item.id}>
        <span className="inbox-kind"><Icon name={item.kind === "task" ? "truck" : item.kind === "relationship" ? "building" : "inbox"}/></span><div className="inbox-content"><div><h2>{item.title}</h2>{!item.read_at && <span className="unread-dot" aria-label="Unread"/>}</div><p>{item.body}</p><small>{new Date(item.created_at).toLocaleString()}</small></div>
        <Button secondary onPress={async () => { await markRead(item); open(item); }}>Open update</Button>
      </article>)}</div>}
  </>;
}
