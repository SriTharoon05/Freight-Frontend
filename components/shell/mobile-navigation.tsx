"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { navigationGroups } from "./sidebar";

export function MobileNavigation() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label="Open navigation"
        aria-expanded={open}
        className="rounded-lg p-2 text-[#7068cf] hover:bg-white focus-visible:ring-2 focus-visible:ring-[#7068cf]"
        onClick={() => setOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="w-80 max-w-[90vw] overflow-y-auto bg-[#f7f5ff]"
        >
          <SheetHeader>
            <SheetTitle>FreightOS</SheetTitle>
            <SheetDescription>Your operations workspace</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            {navigationGroups.map((group) => (
              <nav key={group.label} aria-label={group.label}>
                <h2 className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-[#858693]">
                  {group.label}
                </h2>
                <div className="space-y-1">
                  {group.items.map(({ href, label, icon: Icon }) => {
                    const active =
                      pathname === href || pathname.startsWith(href + "/");
                    return (
                      <Link
                        key={href}
                        href={href}
                        aria-current={active ? "page" : undefined}
                        onClick={() => setOpen(false)}
                        className={
                          "flex items-center gap-3 rounded-xl px-3 py-3 text-sm " +
                          (active
                            ? "bg-[#e9e6fb] font-semibold text-[#655dc4]"
                            : "text-[#606174] hover:bg-white")
                        }
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </Link>
                    );
                  })}
                </div>
              </nav>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
