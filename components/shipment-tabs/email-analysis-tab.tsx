'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, RefreshCw, AlertCircle, Mail, Calendar, Flag } from 'lucide-react';
import { emailAnalysisApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { Card } from '@/components/shell/card';
import { EmptyState, ErrorState } from '@/components/shell/states';
import { formatIST, timeAgo } from '@/lib/date';
import { toApiError } from '@/lib/api-client';
import type { EmailThreadItem, EmailAnalysis } from '@/lib/types';

const PRIORITY_STYLES: Record<string, string> = {
  critical: 'bg-[#fff0f2] text-[#d45166] border-[#f6d4da]',
  high: 'bg-[#fff7e7] text-[#b77912] border-[#f9e7bc]',
  medium: 'bg-[#fffbeb] text-[#a07c18] border-[#fde9b0]',
  low: 'bg-[#eaf9f2] text-[#13945a] border-[#cfeee0]',
};

const SENTIMENT_STYLES: Record<string, string> = {
  positive: 'bg-[#eaf9f2] text-[#13945a]',
  neutral: 'bg-slate-100 text-slate-500',
  negative: 'bg-[#fff0f2] text-[#d45166]',
  urgent: 'bg-[#fff7e7] text-[#b77912]',
};

export function EmailAnalysisTab({ shipmentId }: { shipmentId: string }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.emailAnalysis(shipmentId),
    queryFn: () => emailAnalysisApi.get(shipmentId),
  });

  const analyzeMutation = useMutation({
    mutationFn: () => emailAnalysisApi.analyze(shipmentId),
    onSuccess: (result) => {
      toast.success(result.message);
      setAnalyzing(Boolean(result.task_id));
      queryClient.invalidateQueries({ queryKey: queryKeys.emailAnalysis(shipmentId) });
    },
    onError: (err) => {
      toast.error(toApiError(err as any).message);
      setAnalyzing(false);
    },
  });

  useEffect(() => {
    if (!analyzing) return;
    const poll = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: queryKeys.emailAnalysis(shipmentId) });
    }, 3000);

    const timeout = setTimeout(() => {
      setAnalyzing(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.emailAnalysis(shipmentId) });
    }, 30000);

    return () => {
      clearInterval(poll);
      clearTimeout(timeout);
    };
  }, [analyzing, shipmentId, queryClient]);

  if (isLoading) {
    return (
      <div className="grid gap-5 lg:grid-cols-2">
        <Card><div className="h-40 animate-pulse rounded bg-[#f0f0f5]" /></Card>
        <Card><div className="h-40 animate-pulse rounded bg-[#f0f0f5]" /></Card>
      </div>
    );
  }

  if (isError) {
    return <Card><ErrorState message="Could not load email analysis" onRetry={() => refetch()} /></Card>;
  }

  const emails = data?.emails || [];
  const analysis = data?.analysis || null;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Left: Email Thread */}
      <Card>
        <h3 className="mb-4 font-display text-[15px] font-semibold">Email Thread</h3>
        {emails.length === 0 ? (
          <EmptyState title="No emails" message="No emails recorded yet for this shipment." />
        ) : (
          <div className="space-y-3">
            {emails.map((email: EmailThreadItem) => (
              <div
                key={email.id}
                className={`rounded-xl border-l-4 bg-[#fbfbfd] p-3 ${
                  email.direction === 'inbound' ? 'border-l-[#5185d8]' : 'border-l-[#a0a0ac]'
                }`}
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div className="text-[10px] text-[#9899a5]">
                    <p><span className="font-semibold">From:</span> {email.from_email}</p>
                    <p><span className="font-semibold">To:</span> {email.to_emails.join(', ')}</p>
                  </div>
                  {email.intent && (
                    <span className="shrink-0 rounded-full bg-[#f0effd] px-2 py-0.5 text-[9px] font-semibold text-[#756bd1] capitalize">
                      {email.intent.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
                <p className="text-[12px] font-semibold text-[#393945]">{email.subject}</p>
                <p className="mt-1 text-[10px] text-[#9899a5]">{formatIST(email.received_at)}</p>
                <p className="mt-1.5 text-[11px] text-[#555566]">
                  {expanded === email.id ? email.body : email.body.slice(0, 200)}
                  {email.body.length > 200 && (
                    <button onClick={() => setExpanded(expanded === email.id ? null : email.id)} className="ml-1 font-semibold text-[#5185d8]">
                      {expanded === email.id ? 'less' : 'more'}
                    </button>
                  )}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Right: AI Analysis */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-[15px] font-semibold">AI Analysis</h3>
          <button
            onClick={() => analyzeMutation.mutate()}
            disabled={analyzeMutation.isPending || analyzing}
            className="flex items-center gap-1.5 rounded-lg bg-[#edf5ff] px-3 py-1.5 text-[10px] font-semibold text-[#5185d8] hover:bg-[#e0edff] disabled:opacity-50"
          >
            {analyzeMutation.isPending || analyzing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {analyzing ? 'Analyzing…' : analysis ? 'Refresh Analysis' : 'Analyze Now'}
          </button>
        </div>

        {analyzing ? (
          <div className="space-y-3">
            <div className="h-20 animate-pulse rounded-lg bg-[#f0f0f5]" />
            <div className="h-32 animate-pulse rounded-lg bg-[#f0f0f5]" />
            <div className="h-16 animate-pulse rounded-lg bg-[#f0f0f5]" />
          </div>
        ) : analysis ? (
          <AnalysisContent analysis={analysis} />
        ) : (
          <div className="rounded-xl bg-[#f7f6fc] px-4 py-8 text-center">
            <Mail size={24} className="mx-auto mb-2 text-[#a0a0d0]" />
            <p className="text-[12px] font-semibold text-[#777884]">No analysis yet</p>
            <p className="mt-1 text-[11px] text-[#9899a5]">Click &ldquo;Analyze Now&rdquo; to run AI analysis on this email thread.</p>
          </div>
        )}
      </Card>
    </div>
  );
}

function AnalysisContent({ analysis }: { analysis: EmailAnalysis }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className={`inline-flex rounded-full border px-3 py-1.5 text-[12px] font-bold capitalize ${PRIORITY_STYLES[analysis.priority] || PRIORITY_STYLES.medium}`}>
          {analysis.priority} priority
        </span>
        <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${SENTIMENT_STYLES[analysis.sentiment] || SENTIMENT_STYLES.neutral}`}>
          {analysis.sentiment}
        </span>
      </div>

      <div>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[#a0a0ac]">Summary</p>
        <p className="text-[12px] leading-[1.6] text-[#555566]">{analysis.summary}</p>
      </div>

      {analysis.action_required && analysis.action_description && (
        <div className="flex items-start gap-2 rounded-xl border border-[#f6d4da] bg-[#fff0f2] px-3 py-3">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-[#d45166]" />
          <div>
            <p className="text-[11px] font-bold text-[#d45166]">Action Required</p>
            <p className="mt-0.5 text-[11px] text-[#555566]">{analysis.action_description}</p>
          </div>
        </div>
      )}

      {analysis.key_dates?.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#a0a0ac]">Key Dates</p>
          <div className="space-y-1.5">
            {analysis.key_dates.map((kd, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-[#fbfbfd] px-3 py-2">
                <Calendar size={12} className="shrink-0 text-[#756bd1]" />
                <span className="text-[11px] font-semibold text-[#393945]">{kd.date}</span>
                <span className="text-[11px] text-[#777884]">— {kd.event}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {analysis.risk_flags?.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#a0a0ac]">Risk Flags</p>
          <div className="flex flex-wrap gap-1.5">
            {analysis.risk_flags.map((flag, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full bg-[#fff0f2] px-2.5 py-1 text-[10px] font-semibold text-[#d45166]">
                <Flag size={10} /> {flag}
              </span>
            ))}
          </div>
        </div>
      )}

      {analysis.analyzed_at && (
        <p className="text-[10px] text-[#a0a0ac]">Analyzed {timeAgo(analysis.analyzed_at)}</p>
      )}
    </div>
  );
}
