'use client';

import { cn } from '@/lib/utils';
import type { Severity, ExceptionStatus, DocumentStatus, ShipmentStatus } from '@/lib/types';

export function SeverityBadge({ severity }: { severity: Severity }) {
  const styles: Record<Severity, string> = {
    critical: 'bg-[#fff0f2] text-[#d45166] border-[#f6d4da]',
    high: 'bg-[#fff7e7] text-[#b77912] border-[#f9e7bc]',
    medium: 'bg-[#fffbeb] text-[#a07c18] border-[#fde9b0]',
    low: 'bg-slate-50 text-slate-500 border-slate-100',
  };
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize', styles[severity])}>
      <span className={cn('mr-1.5 h-1.5 w-1.5 rounded-full', {
        'bg-[#db5b6d]': severity === 'critical',
        'bg-[#d99a35]': severity === 'high',
        'bg-[#e0b53a]': severity === 'medium',
        'bg-slate-400': severity === 'low',
      })} />
      {severity}
    </span>
  );
}

export function StatusBadge({ status }: { status: ShipmentStatus | string }) {
  const s = status as string;
  const map: Record<string, { bg: string; text: string; dot: string }> = {
    delivered: { bg: 'bg-[#eaf9f2]', text: 'text-[#13945a]', dot: 'bg-[#32ad78]' },
    on_time: { bg: 'bg-[#eaf9f2]', text: 'text-[#13945a]', dot: 'bg-[#32ad78]' },
    in_transit: { bg: 'bg-[#edf5ff]', text: 'text-[#5185d8]', dot: 'bg-[#5d90d7]' },
    at_risk: { bg: 'bg-[#fff0f2]', text: 'text-[#d45166]', dot: 'bg-[#db5b6d]' },
    exception: { bg: 'bg-[#fff0f2]', text: 'text-[#d45166]', dot: 'bg-[#db5b6d]' },
    custom_hold: { bg: 'bg-[#fff7e7]', text: 'text-[#b77912]', dot: 'bg-[#d99a35]' },
    draft: { bg: 'bg-slate-50', text: 'text-slate-500', dot: 'bg-slate-400' },
    cancelled: { bg: 'bg-slate-50', text: 'text-slate-400', dot: 'bg-slate-300' },
  };
  const style = map[s] || { bg: 'bg-slate-50', text: 'text-slate-500', dot: 'bg-slate-400' };
  return (
    <span className={cn('inline-flex items-center rounded-full border border-transparent px-2.5 py-1 text-[11px] font-semibold capitalize', style.bg, style.text)}>
      <span className={cn('mr-1.5 h-1.5 w-1.5 rounded-full', style.dot)} />
      {s.replace(/_/g, ' ')}
    </span>
  );
}

export function DocStatusChip({ status }: { status: DocumentStatus }) {
  const styles: Record<DocumentStatus, string> = {
    pending: 'bg-slate-50 text-slate-500',
    generated: 'bg-[#edf5ff] text-[#5185d8]',
    verified: 'bg-[#eaf9f2] text-[#13945a]',
    failed: 'bg-[#fff0f2] text-[#d45166]',
  };
  return (
    <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold capitalize', styles[status])}>
      {status}
    </span>
  );
}
