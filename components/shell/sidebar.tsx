"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Inbox,
  Settings2,
  FileText,
  Gauge,
  Command,
  BookUser,
  Receipt,
  Clock,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
const groups = [
  {
    label: "Workspace",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "RFQ & Quoting", href: "/rfqs", icon: Inbox },
      { label: "Jobs", href: "/shipments", icon: Package },
      { label: "Documents", href: "/documents", icon: FileText },
    ],
  },
  {
    label: "Commercial & Operations",
    items: [
      { label: "Rate Management", href: "/rates", icon: Gauge },
      { label: "Invoice & Audit", href: "/invoice-audit", icon: Receipt },
      { label: "D&D Watch", href: "/dd-watch", icon: Clock },
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
  const [collapsed, setCollapsed] = useState(false);
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
        "hidden h-full shrink-0 flex-col overflow-y-auto border-r border-[#e8e5f4] bg-[#f4f2ff] py-6 transition-[width] md:flex",
        collapsed ? "w-[68px] px-2" : "w-[218px] px-4",
      )}
    >
      <div className="mb-7 flex items-center gap-2 px-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#746ad1] to-[#55b9cb] text-white">
          <Command size={19} />
        </span>
        {!collapsed && (
          <span className="font-display text-[17px] font-semibold">
            Freight<span className="text-[#7770d4]">OS</span>
          </span>
        )}
      </div>
      <button
        onClick={toggle}
        title={collapsed ? "Expand navigation" : "Collapse navigation"}
        aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        aria-expanded={!collapsed}
        className="mb-5 flex items-center gap-2 rounded-xl p-3 text-xs text-[#777884] hover:bg-white"
      >
        {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}{" "}
        {!collapsed && "Collapse"}
      </button>
      {groups.map((group) => (
        <div key={group.label} className="mb-6">
          {!collapsed && (
            <div className="mb-2 px-3 text-[9px] font-bold uppercase tracking-widest text-[#aaa7ba]">
              {group.label}
            </div>
          )}
          <nav aria-label={group.label} className="space-y-1">
            {group.items.map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                aria-label={label}
                aria-current={pathname === href ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-3 text-xs font-medium",
                  pathname === href || pathname.startsWith(href + "/")
                    ? "bg-[#e9e6fb] text-[#655dc4]"
                    : "text-[#777884] hover:bg-white",
                )}
              >
                <Icon size={17} className="shrink-0" />
                {!collapsed && label}
              </Link>
            ))}
          </nav>
        </div>
      ))}
    </aside>
  );
}
