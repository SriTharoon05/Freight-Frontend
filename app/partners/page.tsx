"use client";
import { AppShell } from "@/components/shell/app-shell";
import { PartnerDirectory } from "@/components/freight/partner-directory";
export default function PartnersPage() {
  return (
    <AppShell>
      <div className="space-y-5">
        <h1 className="text-2xl font-semibold">Partners</h1>
        <p className="text-sm text-[#858693]">
          Find verified pickup, delivery, customs and warehouse partners. Each
          company approves its own working relationships.
        </p>
        <PartnerDirectory />
      </div>
    </AppShell>
  );
}
