'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Ship, Plane, Truck, Train, Check } from 'lucide-react';
import { shipmentsApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { AppShell } from '@/components/shell/app-shell';
import { Card } from '@/components/shell/card';
import { StatusBadge } from '@/components/shell/badges';
import { ErrorState } from '@/components/shell/states';
import { OverviewTab } from '@/components/shipment-tabs/overview-tab';
import { DocumentsTab } from '@/components/shipment-tabs/documents-tab';
import { AssignmentsTab } from '@/components/shipment-tabs/assignments-tab';
import { EmailAnalysisTab } from '@/components/shipment-tabs/email-analysis-tab';
import { ExceptionsTab } from '@/components/shipment-tabs/exceptions-tab';
import { AiActivityTab } from '@/components/shipment-tabs/ai-activity-tab';
import type { ShipmentStatus } from '@/lib/types';
import { useState, use } from 'react';

const MODE_ICONS: Record<string, typeof Ship> = {
  ocean: Ship, air: Plane, road: Truck, rail: Train,
};

const TIMELINE: ShipmentStatus[] = [
  'draft', 'booked', 'assigned', 'picked_up', 'in_transit',
  'at_port', 'customs_cleared', 'loaded', 'departed', 'arrived',
  'unloaded', 'warehouse_received', 'out_for_delivery', 'delivered',
];

const TABS = ['Overview', 'Documents', 'Assignments', 'Emails & Analysis', 'Exceptions', 'AI Activity'] as const;
type Tab = typeof TABS[number];

export default function ShipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);          // 🔧 unwrap the params Promise once
  const [tab, setTab] = useState<Tab>('Overview');

  const { data: shipment, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.shipmentDetail(id),
    queryFn: () => shipmentsApi.get(id),
  });

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#c8c5e8] border-t-[#746ad1]" />
        </div>
      </AppShell>
    );
  }

  if (isError || !shipment) {
    return (
      <AppShell>
        <Card>
          <ErrorState
            message="Could not load this shipment"
            onRetry={() => refetch()}
          />
        </Card>
      </AppShell>
    );
  }

  const ModeIcon = MODE_ICONS[shipment.transport_mode] || Ship;
  const currentStepIndex = TIMELINE.indexOf(shipment.status);

  return (
    <AppShell>
      <button onClick={() => router.push('/shipments')} className="mb-4 flex items-center gap-1.5 text-[12px] font-medium text-[#777884] hover:text-[#393945]">
        <ArrowLeft size={15} />Back to shipments
      </button>

      {/* Hero */}
      <Card className="mb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f0effd] text-[#756bd1]">
              <ModeIcon size={22} />
            </span>
            <div>
              <h1 className="font-display text-[22px] font-semibold tracking-[-0.03em] text-[#171725]">{shipment.ref_number}</h1>
              <p className="mt-0.5 text-[12px] text-[#9899a5]">{shipment.origin} → {shipment.destination} · <span className="capitalize">{shipment.transport_mode}</span></p>
            </div>
          </div>
          <StatusBadge status={shipment.status} />
        </div>

        {/* Status timeline */}
        <div className="mt-6 overflow-x-auto">
          <div className="flex min-w-[600px] items-center gap-1">
            {TIMELINE.map((step, i) => {
              const completed = i <= currentStepIndex;
              const current = i === currentStepIndex;
              return (
                <div key={step} className="flex flex-1 flex-col items-center">
                  <div className="flex w-full items-center">
                    {i > 0 && <div className={`h-0.5 flex-1 ${i <= currentStepIndex ? 'bg-[#746ad1]' : 'bg-[#e9e9ef]'}`} />}
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition ${
                        completed
                          ? current
                            ? 'bg-[#746ad1] text-white ring-4 ring-[#e8e5f7]'
                            : 'bg-[#746ad1] text-white'
                          : 'bg-[#f0f0f5] text-[#a0a0ac]'
                      }`}
                    >
                      {completed && !current ? <Check size={12} /> : i + 1}
                    </div>
                    {i < TIMELINE.length - 1 && <div className={`h-0.5 flex-1 ${i < currentStepIndex ? 'bg-[#746ad1]' : 'bg-[#e9e9ef]'}`} />}
                  </div>
                  <span className={`mt-1.5 text-center text-[9px] font-medium ${completed ? 'text-[#555]' : 'text-[#a0a0ac]'}`}>
                    {step.replace(/_/g, ' ')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 border-b border-[#f0f0f4]">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative px-4 py-2.5 text-[12px] font-semibold transition ${
              tab === t ? 'text-[#7068cf]' : 'text-[#777884] hover:text-[#393945]'
            }`}
          >
            {t}
            {tab === t && <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[#7068cf]" />}
          </button>
        ))}
      </div>

      {/* Tab content */}
{tab === 'Overview' && <OverviewTab shipmentId={id} detail={shipment} />}
{tab === 'Documents' && <DocumentsTab shipmentId={id} />}
{tab === 'Assignments' && <AssignmentsTab shipmentId={id} />}
{tab === 'Emails & Analysis' && <EmailAnalysisTab shipmentId={id} />}
{tab === 'Exceptions' && <ExceptionsTab shipmentId={id} />}
{tab === 'AI Activity' && <AiActivityTab shipmentId={id} />}
    </AppShell>
  );
}
