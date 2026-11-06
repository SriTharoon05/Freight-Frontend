"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { EmailRequests } from "@/components/freight/email-requests";
import { type MailQueue } from "@/lib/mail-triage";
import { useAuthStore } from "@/lib/auth-store";
import { secondaryClass } from "@/components/freight/shared";

export default function EmailsPage() {
  const params = useSearchParams();
  const initial = params.get("workflow");
  const [queue, setQueue] = useState<MailQueue>(["all", "supplier_rates", "closed", "job"].includes(initial || "") ? initial as MailQueue : "other");
  const user = useAuthStore((state) => state.user);
  const permitted = [
    "sales",
    "admin",
    "org_admin",
    "manager",
    "ops_manager",
  ].includes(user?.role || "");
  return (
    <AppShell>
      <div className="space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Email workspace
            </h1>
            <p className="mt-1 text-sm text-[#777884]">
              Keep commercial and operational correspondence organised, with
              clear priorities.
            </p>
          </div>
          <Link href="/rfqs" className={secondaryClass}>
            Open RFQ pipeline →
          </Link>
        </header>
        {permitted ? (
          <>
            <div
              role="group"
              aria-label="Mail workspace"
              className="flex flex-wrap gap-2"
            >
              {(
                [
                  ["all", "All correspondence"],
                  ["other", "Other emails"],
                  ["supplier_rates", "Supplier enquiries & replies"],
                  ["closed", "Cancelled / on hold"],
                  ["job", "Linked to jobs"],
                ] as const
              ).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={queue === value}
                  className={
                    "rounded-lg px-4 py-2.5 text-sm font-medium " +
                    (queue === value
                      ? "bg-[#7068cf] text-white"
                      : "bg-white text-[#606174]")
                  }
                  onClick={() => setQueue(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <EmailRequests key={queue} workflow={queue} />
          </>
        ) : (
          <p className="rounded-xl bg-white p-6 text-sm text-[#606174]">
            Email triage is available to your sales and management teams.
          </p>
        )}
      </div>
    </AppShell>
  );
}
