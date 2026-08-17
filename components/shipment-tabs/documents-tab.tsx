'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Eye, FileText, Zap } from 'lucide-react';
import { shipmentsApi, documentsApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { formatIST } from '@/lib/date';
import { Card } from '@/components/shell/card';
import { DocStatusChip } from '@/components/shell/badges';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/shell/states';
import { Tooltip } from '@/components/ui/tooltip';
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

export function DocumentsTab({ shipmentId }: { shipmentId: string }) {
  const queryClient = useQueryClient();

  const { data: docs, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.shipmentDocuments(shipmentId),
    queryFn: () => shipmentsApi.documents(shipmentId),
  });

  const generateMutation = useMutation({
    mutationFn: (docType: DocumentType) => shipmentsApi.generateDocument(shipmentId, docType),
    onSuccess: () => {
      toast.success('Document generation started');
      queryClient.invalidateQueries({ queryKey: queryKeys.shipmentDocuments(shipmentId) });
    },
    onError: () => toast.error('Failed to generate document'),
  });

  const handleView = async (doc: Document) => {
    try {
      const res = await documentsApi.download(doc.id);
      window.open(res.signed_url, '_blank');
    } catch {
      toast.error('Could not open document');
    }
  };

  const allDocs: DocumentType[] = ['pickup_receipt', 'warehouse_receipt', 'commercial_invoice', 'packing_list', 'shipping_bill', 'house_bill_of_lading', 'proof_of_delivery'];
  const docMap = new Map<DocumentType, Document>(docs?.map((d: Document) => [d.document_type, d]));
  const prerequisiteMap: Partial<Record<DocumentType, DocumentType>> = {
    warehouse_receipt: 'pickup_receipt',
    shipping_bill: 'commercial_invoice',
    house_bill_of_lading: 'shipping_bill',
    proof_of_delivery: 'warehouse_receipt',
  };

  if (isLoading) return <Card><TableSkeleton rows={7} cols={4} /></Card>;
  if (isError) return <Card><ErrorState message="Could not load documents" onRetry={() => refetch()} /></Card>;

  return (
    <Card>
      <h3 className="mb-4 font-display text-[15px] font-semibold">Document checklist</h3>
      {docs && docs.length === 0 && !isLoading ? (
        <div className="space-y-2">
          {allDocs.map((type) => {
            const prereq = prerequisiteMap[type];
            const prereqDoc = prereq ? docMap.get(prereq) : undefined;
            const canGenerate = !prereq || prereqDoc?.status === 'generated' || prereqDoc?.status === 'verified';
            return (
              <DocRow
                key={type}
                type={type}
                status="pending"
                canGenerate={canGenerate}
                prereqLabel={prereq && !canGenerate ? `Requires ${DOC_LABELS[prereq]} first` : undefined}
                onGenerate={() => generateMutation.mutate(type)}
                onView={undefined}
                generating={generateMutation.isPending}
              />
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {allDocs.map((type) => {
            const doc = docMap.get(type);
            const prereq = prerequisiteMap[type];
            const prereqDoc = prereq ? docMap.get(prereq) : undefined;
            const canGenerate = !prereq || prereqDoc?.status === 'generated' || prereqDoc?.status === 'verified';
            return (
              <DocRow
                key={type}
                type={type}
                status={doc?.status || 'pending'}
                generatedAt={doc?.generated_at}
                canGenerate={canGenerate && doc?.status !== 'generated' && doc?.status !== 'verified'}
                prereqLabel={prereq && !canGenerate ? `Requires ${DOC_LABELS[prereq]} first` : undefined}
                onGenerate={() => generateMutation.mutate(type)}
                onView={doc ? () => handleView(doc) : undefined}
                generating={generateMutation.isPending && generateMutation.variables === type}
              />
            );
          })}
        </div>
      )}
    </Card>
  );
}

function DocRow({
  type, status, generatedAt, canGenerate, prereqLabel, onGenerate, onView, generating,
}: {
  type: DocumentType;
  status: string;
  generatedAt?: string;
  canGenerate: boolean;
  prereqLabel?: string;
  onGenerate: () => void;
  onView?: () => void;
  generating: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-[#fbfbfd] px-3 py-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f0effd] text-[#756bd1]">
        <FileText size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-[#393945]">{DOC_LABELS[type]}</p>
        <p className="text-[10px] text-[#9899a5]">{generatedAt ? `Generated ${formatIST(generatedAt)}` : 'Not generated'}</p>
      </div>
      <DocStatusChip status={status as Document['status']} />
      {onView && (
        <button onClick={onView} className="flex items-center gap-1 rounded-lg border border-[#e9e9ef] px-2.5 py-1.5 text-[10px] font-semibold text-[#777884] hover:bg-[#f7f7fa]">
          <Eye size={12} />View
        </button>
      )}
      {canGenerate && (
        prereqLabel ? (
          <Tooltip content={prereqLabel}>
            <button disabled className="flex cursor-not-allowed items-center gap-1 rounded-lg bg-[#f0f0f5] px-2.5 py-1.5 text-[10px] font-semibold text-[#a0a0ac]">
              <Zap size={12} />Generate
            </button>
          </Tooltip>
        ) : (
          <button
            onClick={onGenerate}
            disabled={generating}
            className="flex items-center gap-1 rounded-lg bg-[#edf5ff] px-2.5 py-1.5 text-[10px] font-semibold text-[#5185d8] hover:bg-[#e0edff] disabled:opacity-60"
          >
            {generating ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
            Generate
          </button>
        )
      )}
    </div>
  );
}
