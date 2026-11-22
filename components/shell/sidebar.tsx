"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import {
  LayoutDashboard,
  Package,
  Inbox,
  Mail,
  Settings2,
  FileText,
  Gauge,
  Command,
  BookUser,
  Receipt,
  Clock,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
export const navigationGroups = [
  {
    label: "Workspace",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "RFQ & Quoting", href: "/rfqs", icon: Inbox },
      { label: "Other emails", href: "/emails", icon: Mail },
      { label: "Jobs", href: "/shipments", icon: Package },
      { label: "Milestones", href: "/milestones", icon: Clock },
      { label: "Partners", href: "/partners", icon: BookUser },
      { label: "Documents", href: "/documents", icon: FileText },
    ],
  },
  {
    label: "Commercial & Operations",
    items: [
      { label: "Rate Management", href: "/rates", icon: Gauge },
      { label: "Invoice & Audit", href: "/invoice-audit", icon: Receipt },
      { label: "D&D Watch", href: "/dd-watch", icon: Clock },
      { label: "AI Suite & Customs", href: "/ai-tools", icon: Sparkles },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Directory", href: "/directory", icon: BookUser },
      { label: "Settings", href: "/settings", icon: Settings2 },
    ],
  },
];
export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const [collapsed, setCollapsed] = useState(false);
  const canFinance = ["finance", "admin", "org_admin", "manager", "ops_manager"].includes(
    user?.role || "",
  );
  const canManage = ["admin", "org_admin", "manager", "ops_manager"].includes(
    user?.role || "",
  );
  const activeDashView = searchParams?.get("view") || "Operations";
  const dashboardSubItems = [
    { label: "Operations Control", view: "Operations", href: "/dashboard" },
    { label: "Exceptions & Risk", view: "Exceptions", href: "/dashboard?view=Exceptions" },
    { label: "Commercial & RFQ", view: "Sales", href: "/dashboard?view=Sales" },
    ...(canFinance
      ? [{ label: "Executive Finance", view: "Finance", href: "/dashboard?view=Finance" }]
      : []),
    ...(canManage
      ? [{ label: "Team Capacity", view: "Team", href: "/dashboard?view=Team" }]
      : []),
  ];
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("freight:sidebar") === "collapsed");
    } catch {}
  }, []);
  const toggle = () => {
    setCollapsed(!collapsed);
    try {
      localStorage.setItem(
        "freight:sidebar",
        collapsed ? "expanded" : "collapsed",
      );
    } catch {}
  };
  return (
    <aside
      className={cn(
        "scrollbar-thin hidden h-full shrink-0 flex-col overflow-y-auto border-r border-white/10 bg-gradient-to-b from-[#0c1021] via-[#11172f] to-[#151d3a] py-5 text-slate-300 transition-[width] duration-200 md:flex",
        collapsed ? "w-[72px] px-2.5" : "w-[238px] px-4",
      )}
    >
      <div className="mb-6 flex items-center justify-between gap-2 px-1.5">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#6f66d9] via-[#537be2] to-[#38bdf8] text-white shadow-[0_6px_18px_rgba(56,189,248,0.28)] ring-1 ring-white/20">
            <Command size={18} />
          </span>
          {!collapsed && (
            <div className="leading-tight">
              <span className="font-display block text-[16px] font-bold tracking-tight text-white">
                Freight<span className="text-[#38bdf8]">OS</span>
              </span>
              <span className="block text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Meridian Control
              </span>
            </div>
          )}
        </Link>
        {!collapsed && (
          <button
            onClick={toggle}
            title="Collapse navigation"
            aria-label="Collapse navigation"
            aria-expanded={!collapsed}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <PanelLeftClose size={16} />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          onClick={toggle}
          title="Expand navigation"
          aria-label="Expand navigation"
          aria-expanded={!collapsed}
          className="mb-5 flex items-center justify-center rounded-xl p-2.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          <PanelLeftOpen size={17} />
        </button>
      )}

      <div className="flex-1 space-y-5">
        {navigationGroups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <div className="mb-2 px-3 text-[9.5px] font-bold uppercase tracking-[0.15em] text-slate-500">
                {group.label}
              </div>
            )}
            <nav aria-label={group.label} className="space-y-1">
              {group.items.map(({ label, href, icon: Icon }) => {
                const isActive = pathname === href || pathname.startsWith(href + "/");
                return (
                  <div key={href}>
                    <Link
                      href={href}
                      title={collapsed ? label : undefined}
                      aria-label={label}
                      aria-current={pathname === href ? "page" : undefined}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] font-medium transition-all",
                        isActive
                          ? "bg-gradient-to-r from-[#6d63dc]/30 via-[#5271e0]/20 to-transparent font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] ring-1 ring-white/12"
                          : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100",
                      )}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-[#38bdf8] shadow-[0_0_8px_#38bdf8]" />
                      )}
                      <Icon
                        size={16}
                        className={cn(
                          "shrink-0 transition-colors",
                          isActive ? "text-[#38bdf8]" : "text-slate-400 group-hover:text-slate-200",
                        )}
                      />
                      {!collapsed && <span className="truncate">{label}</span>}
                    </Link>
                    {!collapsed && href === "/dashboard" && (
                      <div className="ml-5 mt-1.5 space-y-0.5 border-l border-white/10 pl-3">
                        {dashboardSubItems.map((sub) => {
                          const subActive =
                            pathname === "/dashboard" && activeDashView === sub.view;
                          return (
                            <Link
                              key={sub.view}
                              href={sub.href}
                              className={cn(
                                "block rounded-lg px-2.5 py-1.5 text-[11px] transition",
                                subActive
                                  ? "bg-white/10 font-semibold text-[#7dd3fc]"
                                  : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200",
                              )}
                            >
                              {sub.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      {!collapsed && (
        <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            Network Online
          </div>
          <p className="mt-1 text-[10.5px] leading-relaxed text-slate-400">
            Ocean, Air &amp; Field Partner telemetry synced in real time.
          </p>
        </div>
      )}
    </aside>
  );
}
