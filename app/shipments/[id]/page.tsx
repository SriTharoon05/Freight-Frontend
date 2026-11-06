"use client";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { JobDetail } from "@/components/freight/job-detail";
export default function JobPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <AppShell>
      <JobDetail id={id} />
    </AppShell>
  );
}
