import { cn } from '@/lib/utils';

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-[18px] border border-[#e9eaf0] bg-white p-5 shadow-[0_6px_18px_rgba(87,86,117,0.04)]', className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h2 className="font-display text-[16px] font-semibold tracking-[-0.02em]">{title}</h2>
        {subtitle && <p className="mt-1 text-[11px] text-[#9b9ba7]">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <h1 className="font-display text-[26px] font-semibold tracking-[-0.045em] text-[#171725]">{children}</h1>
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}
