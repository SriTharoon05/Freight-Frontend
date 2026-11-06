"use client";

import { AppShell } from "@/components/shell/app-shell";
import { MilestoneBoard } from "@/components/freight/milestone-board";

export default function MilestonesPage() {
  return <AppShell><div className="space-y-5">
    <div><h1 className="text-2xl font-semibold tracking-tight">Milestones</h1><p className="mt-1 text-xs text-[#858693]">Vendor progress, completion targets and deadline risks in one view.</p></div>
    <MilestoneBoard />
  </div></AppShell>;
}
