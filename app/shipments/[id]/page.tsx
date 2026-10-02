"use client";
import { use } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { JobDetail } from "@/components/freight/job-detail";
export default function JobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <AppShell>
      <JobDetail id={id} />
    </AppShell>
  );
}
