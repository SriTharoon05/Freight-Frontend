"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/shell/app-shell";
import {
  Panel,
  Pager,
  ErrorBanner,
  buttonClass,
} from "@/components/freight/shared";
import { freight, type Page, dateLabel } from "@/lib/freight";
import { useAuthStore } from "@/lib/auth-store";
type Row = Record<string, any>;
export default function AlertsPage() {
  const user = useAuthStore((s) => s.user),
    client = useQueryClient(),
    [page, setPage] = useState(1),
    [error, setError] = useState<unknown>(null);
  const list = useQuery<Page<Row>>({
    queryKey: ["freight", user?.tenant_id, "alerts", page],
    queryFn: () => freight.get<Page<Row>>("/alerts", { page }),
    refetchInterval: 60000,
  });
  return (
    <AppShell>
      <Panel title="Notifications">
        <ErrorBanner error={error || list.error} />
        <div className="space-y-4">
          {list.data?.items.map((a: Row) => (
            <article
              key={a.id}
              className="rounded-xl border border-red-100 p-4"
            >
              <div className="flex justify-between gap-4">
                <Link
                  href={a.href}
                  className="text-sm font-semibold text-[#7068cf]"
                >
                  {a.customer} · {a.job_reference}
                </Link>
                <span className="text-[10px] text-[#858693]">
                  {dateLabel(a.triggered_at)}
                </span>
              </div>
              <h2 className="mt-3 text-xs font-semibold">
                {a.metadata_?.subject || a.escalation_type.replaceAll("_", " ")}
              </h2>
              <p className="my-3 text-xs text-[#858693]">
                {a.metadata_?.snippet}
              </p>
              <button
                className={buttonClass}
                onClick={async () => {
                  try {
                    await freight.post(`/alerts/${a.id}/acknowledge`, {});
                    client.invalidateQueries({ queryKey: ["freight"] });
                  } catch (e) {
                    setError(e);
                  }
                }}
              >
                Acknowledge
              </button>
            </article>
          ))}
        </div>
        {list.data?.total === 0 && (
          <p className="py-8 text-center text-xs text-[#858693]">
            All notifications acknowledged.
          </p>
        )}
        <Pager
          page={page}
          total={list.data?.total || 0}
          limit={20}
          onChange={setPage}
        />
      </Panel>
    </AppShell>
  );
}
