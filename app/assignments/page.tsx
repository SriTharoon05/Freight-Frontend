'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Phone, Truck, User } from 'lucide-react';
import { assignmentsApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { AppShell } from '@/components/shell/app-shell';
import { Card, SectionTitle } from '@/components/shell/card';
import { ListSkeleton, EmptyState, ErrorState } from '@/components/shell/states';
import type { Assignment, AvailableAgent } from '@/lib/types';

const STATUS_COLORS: Record<string, string> = {
  available: '#34bf87',
  on_job: '#5d90d7',
  offline: '#a0a0ac',
};

const ASSIGN_STATUS_STYLES: Record<string, string> = {
  assigned: 'bg-[#edf5ff] text-[#5185d8]',
  in_progress: 'bg-[#fff7e7] text-[#b77912]',
  completed: 'bg-[#eaf9f2] text-[#13945a]',
  reassigned: 'bg-slate-50 text-slate-500',
};

export default function AssignmentsPage() {
  const [selectedAgent, setSelectedAgent] = useState<AvailableAgent | null>(null);

  const { data: assignments, isLoading: aLoading, isError: aError, refetch: aRefetch } = useQuery({
    queryKey: queryKeys.assignments({ date: 'today' }),
    queryFn: () => assignmentsApi.list({ date: 'today', limit: 50 }),
  });

  const { data: agents, isLoading: gLoading } = useQuery({
    queryKey: queryKeys.agentsAvailable,
    queryFn: assignmentsApi.agentsAvailable,
  });

  return (
    <AppShell>
      <SectionTitle>Assignments</SectionTitle>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* Left: assignment list */}
        <Card>
          <h3 className="mb-4 font-display text-[15px] font-semibold">Today&apos;s assignments</h3>
          {aLoading ? (
            <ListSkeleton rows={6} />
          ) : aError ? (
            <ErrorState message="Could not load assignments" onRetry={() => aRefetch()} />
          ) : assignments && assignments.length > 0 ? (
            <div className="space-y-2">
              {assignments.map((a: Assignment) => (
                <div key={a.id} className="rounded-xl bg-[#fbfbfd] p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-semibold text-[#393945]">{a.shipment_ref || a.shipment_id}</p>
                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold capitalize ${ASSIGN_STATUS_STYLES[a.status] || 'bg-slate-50 text-slate-500'}`}>
                      {a.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-[#9899a5]">{a.agent_name || 'Unassigned'}</p>
                  {a.vehicle_number && <p className="text-[10px] text-[#a0a0ac]">{a.vehicle_number}</p>}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No assignments today" message="Assignments will appear here as they are created." />
          )}
        </Card>

        {/* Right: agent map (visual representation) */}
        <Card>
          <h3 className="mb-4 font-display text-[15px] font-semibold">Agent locations</h3>
          {gLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#c8c5e8] border-t-[#746ad1]" />
            </div>
          ) : agents && agents.length > 0 ? (
            <div>
              {/* Map placeholder with agent markers */}
              <div className="relative h-80 overflow-hidden rounded-xl bg-gradient-to-br from-[#e8e9f6] to-[#d8d9ee]">
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: 'radial-gradient(circle at 30% 40%, rgba(116,106,209,0.08) 0%, transparent 50%), radial-gradient(circle at 70% 60%, rgba(85,185,203,0.08) 0%, transparent 50%)',
                  }}
                />
                {(agents as AvailableAgent[]).map((agent, i) => {
                  const left = 15 + ((i * 37) % 70);
                  const top = 15 + ((i * 53) % 60);
                  return (
                    <button
                      key={agent.id}
                      onClick={() => setSelectedAgent(agent)}
                      className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white shadow-lg transition hover:scale-110"
                      style={{
                        left: `${left}%`,
                        top: `${top}%`,
                        backgroundColor: STATUS_COLORS[agent.status] || '#a0a0ac',
                      }}
                    >
                      <MapPin size={14} className="text-white" />
                    </button>
                  );
                })}
                {/* Legend */}
                <div className="absolute bottom-3 left-3 flex gap-3 rounded-lg bg-white/90 px-3 py-2 backdrop-blur-sm">
                  {Object.entries(STATUS_COLORS).map(([status, color]) => (
                    <span key={status} className="flex items-center gap-1.5 text-[10px] font-medium text-[#555]">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                      <span className="capitalize">{status.replace('_', ' ')}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Agent list */}
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {(agents as AvailableAgent[]).map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => setSelectedAgent(agent)}
                    className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                      selectedAgent?.id === agent.id ? 'border-[#746ad1] bg-[#f0effc]' : 'border-[#eeedf3] hover:bg-[#fbfbfd]'
                    }`}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg text-white" style={{ backgroundColor: STATUS_COLORS[agent.status] }}>
                      <User size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-semibold text-[#393945]">{agent.name}</p>
                      <p className="text-[10px] text-[#9899a5]">
                        <span className="capitalize">{agent.status.replace('_', ' ')}</span>
                        {agent.current_shipment_ref ? ` · ${agent.current_shipment_ref}` : ''}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState title="No agents available" message="Available agents will appear on the map when they come online." />
          )}
        </Card>
      </div>

      {/* Agent detail card */}
      {selectedAgent && (
        <div className="fixed bottom-6 right-6 z-40 w-72 rounded-2xl border border-[#e9eaf0] bg-white p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg text-white" style={{ backgroundColor: STATUS_COLORS[selectedAgent.status] }}>
                <User size={15} />
              </span>
              <p className="text-[13px] font-semibold text-[#393945]">{selectedAgent.name}</p>
            </div>
            <button onClick={() => setSelectedAgent(null)} className="text-[#a0a0ab] hover:text-[#555]">✕</button>
          </div>
          <div className="space-y-1.5 text-[11px] text-[#777884]">
            <p className="flex items-center gap-2"><Phone size={13} className="text-[#a0a0ac]" />{selectedAgent.phone || '—'}</p>
            <p className="flex items-center gap-2"><Truck size={13} className="text-[#a0a0ac]" />{selectedAgent.vehicle_number || '—'}</p>
            <p className="flex items-center gap-2"><MapPin size={13} className="text-[#a0a0ac]" />
              {selectedAgent.lat.toFixed(3)}, {selectedAgent.lng.toFixed(3)}
            </p>
            {selectedAgent.current_shipment_ref && (
              <p className="mt-2 rounded-lg bg-[#f0effd] px-2 py-1.5 font-semibold text-[#756bd1]">
                Current job: {selectedAgent.current_shipment_ref}
              </p>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
