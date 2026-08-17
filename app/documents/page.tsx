'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Eye, Download, Send, X, FileText } from 'lucide-react';
import { documentsApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { AppShell } from '@/components/shell/app-shell';
import { Card, SectionTitle } from '@/components/shell/card';
import { DocStatusChip } from '@/components/shell/badges';
import { TableSkeleton, EmptyState, ErrorState } from '@/components/shell/states';
import { formatIST } from '@/lib/date';
import type { DocumentType, Document } from '@/lib/types';

const DOC_LABELS: Record<DocumentType, string> = {
  pickup_receipt: 'Pickup Receipt',
  warehouse_receipt: 'Warehouse Receipt',
  commercial_invoice: 'Commercial Invoice',
  packing_list: 'Packing List',
  shipping_bill: 'Shipping Bill',
  house_bill_of_lading: 'House Bill of Lading',
  proof_of_delivery: 'Proof of Delivery',
};

export default function DocumentsPage() {
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [preview, setPreview] = useState<Document | null>(null);

  const { data: docs, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.documents({ type: typeFilter, status: statusFilter, limit: 100 }),
    queryFn: () => documentsApi.list({ type: typeFilter || undefined, status: statusFilter || undefined, limit: 100 }),
  });

  const handleDownload = async (doc: Document) => {
    try {
      const res = await documentsApi.download(doc.id);
      window.open(res.signed_url, '_blank');
    } catch {
      toast.error('Could not download document');
    }
  };

  const selectCls = 'rounded-lg border border-[#ededf2] bg-white px-3 py-2 text-[12px] font-medium text-[#686975] outline-none';

  return (
    <AppShell>
      <SectionTitle>Documents</SectionTitle>

      <Card className="mb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={selectCls}>
            <option value="">All types</option>
            {Object.entries(DOC_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectCls}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="generated">Generated</option>
            <option value="verified">Verified</option>
            <option value="failed">Failed</option>
          </select>
          <div className="flex gap-2 sm:ml-auto">
            <button className="flex items-center gap-1.5 rounded-lg border border-[#e9e9ef] bg-white px-3 py-2 text-[11px] font-semibold text-[#777884] hover:bg-[#f7f7fa]">
              <Download size={13} />Bulk download
            </button>
            <button className="flex items-center gap-1.5 rounded-lg border border-[#e9e9ef] bg-white px-3 py-2 text-[11px] font-semibold text-[#777884] hover:bg-[#f7f7fa]">
              <Send size={13} />Bulk send
            </button>
          </div>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <TableSkeleton rows={8} cols={5} />
        ) : isError ? (
          <ErrorState message="Could not load documents" onRetry={() => refetch()} />
        ) : docs && docs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#f0f0f4] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a2a2ad]">
                  <th className="pb-3">Shipment</th>
                  <th className="pb-3">Type</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Generated</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((doc: Document) => (
                  <tr key={doc.id} className="border-b border-[#f4f4f7] last:border-0">
                    <td className="py-3 text-[12px] font-semibold text-[#393945]">{doc.shipment_ref || doc.shipment_id}</td>
                    <td className="py-3 text-[11px] text-[#777884]">{DOC_LABELS[doc.document_type] || doc.document_type}</td>
                    <td className="py-3"><DocStatusChip status={doc.status} /></td>
                    <td className="py-3 text-[11px] text-[#9899a5]">{doc.generated_at ? formatIST(doc.generated_at) : '—'}</td>
                    <td className="py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setPreview(doc)}
                          disabled={doc.status !== 'generated' && doc.status !== 'verified'}
                          className="rounded-lg border border-[#e9e9ef] p-1.5 text-[#777884] hover:bg-[#f7f7fa] disabled:opacity-40"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => handleDownload(doc)}
                          disabled={doc.status !== 'generated' && doc.status !== 'verified'}
                          className="rounded-lg border border-[#e9e9ef] p-1.5 text-[#777884] hover:bg-[#f7f7fa] disabled:opacity-40"
                        >
                          <Download size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No documents found" message="Documents across all shipments will appear here." />
        )}
      </Card>

      {/* Preview drawer */}
      {preview && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setPreview(null)} />
          <div className="relative z-10 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#f0f0f4] px-5 py-4">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-[#756bd1]" />
                <h3 className="font-display text-[14px] font-semibold">{DOC_LABELS[preview.document_type] || preview.document_type}</h3>
              </div>
              <button onClick={() => setPreview(null)} className="rounded-lg p-1.5 text-[#a0a0ab] hover:bg-[#f7f7fa]">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
              <div className="flex h-full flex-col items-center justify-center text-center">
                <FileText size={48} className="mb-3 text-[#c8c5e8]" />
                <p className="text-[13px] font-semibold text-[#555]">Document preview</p>
                <p className="mt-1 text-[11px] text-[#9899a5]">{preview.shipment_ref || preview.shipment_id}</p>
                <button
                  onClick={() => handleDownload(preview)}
                  className="mt-4 flex items-center gap-2 rounded-xl bg-[#7068cf] px-4 py-2.5 text-[12px] font-semibold text-white"
                >
                  <Download size={14} />Download file
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
