"use client";

import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { MilestoneBoard } from "@/components/freight/milestone-board";
import { PageHero, secondaryClass } from "@/components/freight/shared";

export default function MilestonesPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <PageHero
          eyebrow="Vendor SLA & Schedule Control"
          title="End-to-End Milestone & Deadline Board"
          subtitle="Monitor carrier departures, customs clearances, field partner tasks, and container detention deadlines in one unified operational timeline."
          actions={
            <Link href="/dd-watch" className={`${secondaryClass} !border-white/20 !bg-white/10 !text-white hover:!bg-white/20`}>
              D&amp;D Container Watch →
            </Link>
          }
        />
        <MilestoneBoard />
      </div>
    </AppShell>
  );
}
