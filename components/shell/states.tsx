import { cn } from '@/lib/utils';

export function KpiSkeleton() {
  return (
    <div className="rounded-[18px] border border-[#e9eaf0] bg-white p-5 shadow-sm">
      <div className="mb-8 flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-lg bg-[#f0f0f5]" />
        <div className="h-3 w-24 rounded bg-[#f0f0f5]" />
      </div>
      <div className="h-7 w-32 rounded bg-[#f0f0f5]" />
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-4 border-b border-[#f0f0f4] pb-3">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-3 flex-1 rounded bg-[#f0f0f5]" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="h-4 flex-1 rounded bg-[#f5f5f8]" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl bg-[#fbfbfd] p-3">
          <div className="h-8 w-8 rounded-lg bg-[#f0f0f5]" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-48 rounded bg-[#f0f0f5]" />
            <div className="h-2.5 w-32 rounded bg-[#f5f5f8]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="flex h-[188px] items-end gap-1 pt-3">
      {Array.from({ length: 30 }).map((_, i) => (
        <div key={i} className="flex-1 rounded-t-[5px] bg-[#f0f0f5]" style={{ height: `${30 + Math.sin(i) * 20 + Math.random() * 30}%` }} />
      ))}
    </div>
  );
}

export function EmptyState({ title, message, action }: { title: string; message: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#f3f2fd]">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a5a0d0" strokeWidth="1.5">
          <path d="M12 8v4l3 2" strokeLinecap="round" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      </div>
      <p className="mb-1 text-[14px] font-semibold text-[#393945]">{title}</p>
      <p className="mb-4 max-w-xs text-[12px] text-[#9899a5]">{message}</p>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 text-center')}>
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#fff0f2]">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d45166" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
        </svg>
      </div>
      <p className="mb-3 text-[13px] text-[#d45166]">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="rounded-lg border border-[#e9e9ef] bg-white px-4 py-2 text-[12px] font-medium text-[#555] hover:bg-[#f7f7fa]">
          Try again
        </button>
      )}
    </div>
  );
}
