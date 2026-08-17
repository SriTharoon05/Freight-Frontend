'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search, ArrowLeft } from 'lucide-react';
import { customersApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { AppShell } from '@/components/shell/app-shell';
import { Card, SectionTitle } from '@/components/shell/card';
import { StatusBadge } from '@/components/shell/badges';
import { TableSkeleton, EmptyState, ErrorState, ListSkeleton } from '@/components/shell/states';
import { formatINR } from '@/lib/format';
import { formatISTDate } from '@/lib/date';
import type { Customer } from '@/lib/types';

export default function CustomersPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.customers({ search: debounced, page, limit }),
    queryFn: () => customersApi.list({ search: debounced || undefined, page, limit }),
  });

  return (
    <AppShell>
      <SectionTitle>Customers</SectionTitle>

      <Card className="mb-5">
        <div className="flex items-center gap-2 rounded-lg border border-[#ededf2] px-3 py-2.5">
          <Search size={16} className="text-[#9b9aa6]" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search customers by name, GSTIN, or email…"
            className="w-full bg-transparent text-[13px] outline-none placeholder:text-[#b0b0ba]"
          />
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <TableSkeleton rows={8} cols={5} />
        ) : isError ? (
          <ErrorState message="Could not load customers" onRetry={() => refetch()} />
        ) : data && data.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#f0f0f4] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a2a2ad]">
                  <th className="pb-3">Name</th>
                  <th className="pb-3">GSTIN</th>
                  <th className="pb-3">Credit limit</th>
                  <th className="pb-3">Outstanding</th>
                  <th className="pb-3">Since</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((c: Customer) => (
                  <tr
                    key={c.id}
                    className="cursor-pointer border-b border-[#f4f4f7] last:border-0 hover:bg-[#fbfbfd]"
                    onClick={() => router.push(`/customers/${c.id}`)}
                  >
                    <td className="py-3 text-[12px] font-semibold text-[#393945]">{c.name}</td>
                    <td className="py-3 text-[11px] text-[#777884]">{c.gstin || '—'}</td>
                    <td className="py-3 text-[11px] text-[#777884]">{c.credit_limit_paise ? formatINR(c.credit_limit_paise) : '—'}</td>
                    <td className="py-3 text-[11px]">
                      {c.outstanding_paise ? (
                        <span className="font-semibold text-[#d45166]">{formatINR(c.outstanding_paise)}</span>
                      ) : '—'}
                    </td>
                    <td className="py-3 text-[11px] text-[#9899a5]">{formatISTDate(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No customers found" message="Try a different search term or add a new customer." />
        )}
      </Card>
    </AppShell>
  );
}
