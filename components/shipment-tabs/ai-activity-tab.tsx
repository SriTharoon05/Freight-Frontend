'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Bot, User } from 'lucide-react';
import { shipmentsApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { formatIST } from '@/lib/date';
import { Card } from '@/components/shell/card';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/shell/states';
import type { AutomationAudit } from '@/lib/types';

const OUTCOME_STYLES: Record<string, string> = {
  success: 'bg-[#eaf9f2] text-[#13945a]',
  failed: 'bg-[#fff0f2] text-[#d45166]',
  pending: 'bg-[#fff7e7] text-[#b77912]',
  rejected: 'bg-slate-100 text-slate-500',
};

const MODE_ICONS: Record<string, typeof Bot> = {
  auto: Bot, human_approve: User, human_only: User,
};

export function AiActivityTab({ shipmentId }: { shipmentId: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: audits, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.shipmentAutomation(shipmentId),
    queryFn: () => shipmentsApi.automationActivity(shipmentId),
  });

  if (isLoading) return <Card><TableSkeleton rows={5} cols={5} /></Card>;
  if (isError) return <Card><ErrorState message="Could not load AI activity" onRetry={() => refetch()} /></Card>;

  return (
    <Card>
      <h3 className="mb-4 font-display text-[15px] font-semibold">AI & automation activity</h3>
      {audits && audits.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#f0f0f4] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a2a2ad]">
                <th className="pb-3">Action</th>
                <th className="pb-3">Mode</th>
                <th className="pb-3">Executed by</th>
                <th className="pb-3">Outcome</th>
                <th className="pb-3">Time</th>
              </tr>
            </thead>
            <tbody>
              {audits.map((audit: AutomationAudit) => {
                const isOpen = expanded === audit.id;
                const ModeIcon = MODE_ICONS[audit.mode] || Bot;
                return (
                  <>
                    <tr
                      key={audit.id}
                      className="cursor-pointer border-b border-[#f4f4f7] last:border-0"
                      onClick={() => setExpanded(isOpen ? null : audit.id)}
                    >
                      <td className="py-3 text-[12px] font-semibold text-[#393945]">
                        <span className="flex items-center gap-1.5">
                          {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          {audit.action}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className="flex items-center gap-1.5 text-[11px] text-[#777884] capitalize">
                          <ModeIcon size={13} />{audit.mode.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 text-[11px] text-[#777884]">{audit.executed_by}</td>
                      <td className="py-3">
                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold capitalize ${OUTCOME_STYLES[audit.outcome] || 'bg-slate-100 text-slate-500'}`}>
                          {audit.outcome}
                        </span>
                      </td>
                      <td className="py-3 text-[11px] text-[#9899a5]">{formatIST(audit.created_at)}</td>
                    </tr>
                    {isOpen && (
                      <tr key={`${audit.id}-detail`} className="bg-[#fbfbfd]">
                        <td colSpan={5} className="py-4">
                          <div className="grid gap-4 sm:grid-cols-2">
                            {audit.input_snapshot && (
                              <div>
                                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[#a0a0ac]">Input snapshot</p>
                                <pre className="overflow-x-auto rounded-lg border border-[#eeedf3] bg-white p-3 text-[10px] text-[#555]">
                                  {JSON.stringify(audit.input_snapshot, null, 2)}
                                </pre>
                              </div>
                            )}
                            {audit.output_snapshot && (
                              <div>
                                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[#a0a0ac]">Output snapshot</p>
                                <pre className="overflow-x-auto rounded-lg border border-[#eeedf3] bg-white p-3 text-[10px] text-[#555]">
                                  {JSON.stringify(audit.output_snapshot, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No AI activity" message="Automation audit entries for this shipment will appear here." />
      )}
    </Card>
  );
}
