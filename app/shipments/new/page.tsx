"use client";
import { AppShell } from "@/components/shell/app-shell";
import { JobForm } from "@/components/freight/job-form";
export default function NewJobPage() {
  return (
    <AppShell>
      <JobForm />
    </AppShell>
  );
}
