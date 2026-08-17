'use client';

import { useState } from 'react';
import { Mail, MessageCircle, Bell, ChevronDown, ChevronUp } from 'lucide-react';
import DOMPurify from 'dompurify';
import { useQuery } from '@tanstack/react-query';
import { shipmentsApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { formatIST } from '@/lib/date';
import { Card } from '@/components/shell/card';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/shell/states';
import type { CommunicationLog } from '@/lib/types';

const CHANNEL_ICONS: Record<string, typeof Mail> = {
  email: Mail, whatsapp: MessageCircle, push: Bell, sms: MessageCircle,
};

export function CommunicationsTab({ shipmentId }: { shipmentId: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: logs, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.shipmentCommunications(shipmentId),
    queryFn: () => shipmentsApi.communications(shipmentId),
  });

  if (isLoading) return <Card><ListSkeleton rows={4} /></Card>;
  if (isError) return <Card><ErrorState message="Could not load communications" onRetry={() => refetch()} /></Card>;

  return (
    <Card>
      <h3 className="mb-4 font-display text-[15px] font-semibold">Communication timeline</h3>
      {logs && logs.length > 0 ? (
        <div className="space-y-2">
          {logs.map((log: CommunicationLog) => {
            const Icon = CHANNEL_ICONS[log.channel] || Mail;
            const isOpen = expanded === log.id;
            const safeBody = log.body ? DOMPurify.sanitize(log.body) : '';
            return (
              <div key={log.id} className="rounded-xl bg-[#fbfbfd] px-3 py-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f0effd] text-[#756bd1]">
                    <Icon size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[12px] font-semibold text-[#393945]">{log.subject || log.channel}</p>
                      <span className="shrink-0 text-[10px] text-[#9899a5]">{formatIST(log.sent_at)}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-[#9899a5]">
                      <span className="capitalize">{log.direction}</span> · {log.recipient || log.sender || '—'}
                    </p>
                    {log.body && (
                      <button
                        onClick={() => setExpanded(isOpen ? null : log.id)}
                        className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-[#756bd1]"
                      >
                        {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        {isOpen ? 'Hide' : 'Show'} body
                      </button>
                    )}
                    {isOpen && safeBody && (
                      <div
                        className="prose prose-sm mt-2 max-w-none rounded-lg border border-[#eeedf3] bg-white p-3 text-[12px] text-[#555]"
                        dangerouslySetInnerHTML={{ __html: safeBody }}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No communications" message="Email, WhatsApp, and push notifications will appear here." />
      )}
    </Card>
  );
}
