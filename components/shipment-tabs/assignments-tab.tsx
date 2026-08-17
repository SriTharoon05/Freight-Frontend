'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MapPin, Phone, Truck, User, Loader2, RefreshCw, Clock3 } from 'lucide-react';
import { shipmentsApi, assignmentsApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { formatIST } from '@/lib/date';
import { Card } from '@/components/shell/card';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/shell/states';
import { Modal } from '@/components/shell/modal';
import { useAuthStore } from '@/lib/auth-store';
import { toApiError } from '@/lib/api-client';
import type { AgentAssignment, AvailableAgent } from '@/lib/types';

export function AssignmentsTab({ shipmentId }: { shipmentId: string }) {
  const queryClient = useQueryClient();
  const { hasRole } = useAuthStore();
  const [reassignOpen, setReassignOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [reason, setReason] = useState('');

  const { data: assignments, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.shipmentAssignments(shipmentId),
    queryFn: () => shipmentsApi.assignments(shipmentId),
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agentsAvailable,
    queryFn: assignmentsApi.agentsAvailable,
    enabled: reassignOpen,
  });

  const active = assignments?.find((a: AgentAssignment) => a.status === 'assigned' || a.status === 'in_progress');
  const history = assignments?.filter((a: AgentAssignment) => a.status === 'completed' || a.status === 'reassigned') || [];
  const activeAssignmentId = active?.id;

  const reassignMutation = useMutation({
    mutationFn: ({ id, agentId, rsn }: { id: string; agentId: string; rsn: string }) =>
      assignmentsApi.reassign(id, agentId, rsn),
    onSuccess: () => {
      toast.success('Agent reassigned');
      setReassignOpen(false);
      setSelectedAgent('');
      setReason('');
      queryClient.invalidateQueries({ queryKey: queryKeys.shipmentAssignments(shipmentId) });
    },
    onError: (err) => {
      const apiErr = toApiError(err as any);
      toast.error(apiErr.message);
    },
  });

  const sortedAgents = (agents || []).slice().sort((a: AvailableAgent, b: AvailableAgent) => (a.distance_km || 0) - (b.distance_km || 0));

  if (isLoading) return <Card><ListSkeleton rows={3} /></Card>;
  if (isError) return <Card><ErrorState message="Could not load assignments" onRetry={() => refetch()} /></Card>;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <h3 className="mb-4 font-display text-[15px] font-semibold">Active assignment</h3>
        {active ? (
          <div>
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf5ff] text-[#5d90d7]">
                <User size={18} />
              </span>
              <div>
                <p className="text-[13px] font-semibold text-[#393945]">{active.agent_name || 'Agent'}</p>
                <p className="text-[11px] text-[#9899a5]">{active.status.replace('_', ' ')}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-[12px]">
              <InfoRow icon={Truck} label="Vehicle" value={active.vehicle_number || '—'} />
              <InfoRow icon={Phone} label="Phone" value={active.agent_phone || '—'} />
              <InfoRow icon={MapPin} label="Location" value={active.lat && active.lng ? `${active.lat.toFixed(3)}, ${active.lng.toFixed(3)}` : '—'} />
              <InfoRow icon={Clock3} label="Assigned" value={formatIST(active.assigned_at)} />
            </div>
            {hasRole('ops_manager', 'org_admin') && (
              <button
                onClick={() => setReassignOpen(true)}
                className="mt-4 flex items-center gap-2 rounded-lg bg-[#f0effd] px-3 py-2 text-[11px] font-semibold text-[#756bd1] hover:bg-[#e8e5f7]"
              >
                <RefreshCw size={13} />Reassign agent
              </button>
            )}
          </div>
        ) : (
          <EmptyState title="No active assignment" message="This shipment has not been assigned to an agent yet." />
        )}
      </Card>

      <Card>
        <h3 className="mb-4 font-display text-[15px] font-semibold">Assignment history</h3>
        {history.length > 0 ? (
          <div className="space-y-2">
            {history.map((a: AgentAssignment) => (
              <div key={a.id} className="rounded-lg bg-[#fbfbfd] px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-semibold text-[#393945]">{a.agent_name || 'Agent'}</p>
                  <span className="text-[10px] text-[#9899a5]">{formatIST(a.assigned_at)}</span>
                </div>
                <p className="mt-0.5 text-[10px] capitalize text-[#9899a5]">{a.status.replace('_', ' ')}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No history" message="Previous assignments will appear here." />
        )}
      </Card>

      <Modal
        open={reassignOpen}
        onClose={() => setReassignOpen(false)}
        title="Reassign agent"
        width="max-w-lg"
        footer={
          <>
            <button onClick={() => setReassignOpen(false)} className="rounded-lg border border-[#e9e9ef] px-4 py-2 text-[12px] font-medium text-[#777884] hover:bg-[#f7f7fa]">Cancel</button>
            <button
              onClick={() => activeAssignmentId && selectedAgent && reassignMutation.mutate({ id: activeAssignmentId, agentId: selectedAgent, rsn: reason })}
              disabled={!selectedAgent || !reason.trim() || reassignMutation.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-[#7068cf] px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
            >
              {reassignMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Confirm reassignment
            </button>
          </>
        }
      >
        <p className="mb-3 text-[12px] text-[#777884]">Available agents, sorted by distance:</p>
        <div className="mb-4 max-h-48 space-y-1.5 overflow-y-auto scrollbar-thin">
          {(sortedAgents as AvailableAgent[]).map((agent) => (
            <button
              key={agent.id}
              onClick={() => setSelectedAgent(agent.id)}
              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition ${
                selectedAgent === agent.id ? 'border-[#746ad1] bg-[#f0effc]' : 'border-[#e9e9ef] hover:bg-[#f7f7fa]'
              }`}
            >
              <div>
                <p className="text-[12px] font-semibold text-[#393945]">{agent.name}</p>
                <p className="text-[10px] text-[#9899a5]">{agent.vehicle_number || '—'}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-semibold text-[#5185d8]">{agent.distance_km ? `${agent.distance_km} km` : '—'}</p>
                {agent.score && <p className="text-[10px] text-[#9899a5]">Score {agent.score}</p>}
              </div>
            </button>
          ))}
          {sortedAgents.length === 0 && <p className="py-4 text-center text-[12px] text-[#9899a5]">No agents available</p>}
        </div>
        <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">Reason</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="Why are you reassigning?"
          className="w-full rounded-xl border border-[#e9e9ef] bg-white px-3.5 py-2.5 text-[13px] outline-none focus:border-[#746ad1] focus:ring-2 focus:ring-[#e8e5f7]"
        />
      </Modal>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Truck; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={14} className="text-[#a0a0ac]" />
      <div>
        <p className="text-[10px] text-[#a0a0ac]">{label}</p>
        <p className="text-[12px] text-[#393945]">{value}</p>
      </div>
    </div>
  );
}

