'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Workflow, Users, Mail, Bell, Truck, Loader2, ChevronDown, ChevronUp, History } from 'lucide-react';
import { automationApi, usersApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { AppShell } from '@/components/shell/app-shell';
import { Card, SectionTitle } from '@/components/shell/card';
import { ListSkeleton, EmptyState, ErrorState, TableSkeleton } from '@/components/shell/states';
import { useAuthStore } from '@/lib/auth-store';
import { toApiError } from '@/lib/api-client';
import { formatIST } from '@/lib/date';
import type { AutomationControl, AutomationMode, AutomationControlHistory, Role, User } from '@/lib/types';

const TABS = [
  { label: 'Automation', icon: Workflow, value: 'automation' },
  { label: 'Users', icon: Users, value: 'users' },
  { label: 'Gmail', icon: Mail, value: 'gmail' },
  { label: 'Carriers', icon: Truck, value: 'carriers' },
  { label: 'Notifications', icon: Bell, value: 'notifications' },
] as const;

type Tab = typeof TABS[number]['value'];

const MODE_OPTIONS: { value: AutomationMode; label: string; color: string }[] = [
  { value: 'full_auto', label: 'Full Auto', color: 'bg-[#eaf9f2] text-[#13945a] border-[#d5f1e0]' },
  { value: 'human_approve', label: 'Human Approve', color: 'bg-[#fff7e7] text-[#b77912] border-[#f9e7bc]' },
  { value: 'human_only', label: 'Human Only', color: 'bg-[#fff0f2] text-[#d45166] border-[#f6d4da]' },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('automation');

  return (
    <AppShell>
      <SectionTitle>Settings</SectionTitle>

      <div className="mb-5 flex gap-1 border-b border-[#f0f0f4]">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`relative flex items-center gap-2 px-4 py-2.5 text-[12px] font-semibold transition ${
                tab === t.value ? 'text-[#7068cf]' : 'text-[#777884] hover:text-[#393945]'
              }`}
            >
              <Icon size={14} />
              {t.label}
              {tab === t.value && <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[#7068cf]" />}
            </button>
          );
        })}
      </div>

      {tab === 'automation' && <AutomationTab />}
      {tab === 'users' && <UsersTab />}
      {tab !== 'automation' && tab !== 'users' && (
        <Card>
          <EmptyState
            title={`${TABS.find((t) => t.value === tab)?.label} settings`}
            message="This section is not yet configured. Contact your administrator to set it up."
          />
        </Card>
      )}
    </AppShell>
  );
}

function AutomationTab() {
  const { hasRole } = useAuthStore();
  const canEdit = hasRole('ops_manager', 'org_admin');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const { data: controls, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.automationControls,
    queryFn: automationApi.controls,
  });

  const { data: history } = useQuery({
    queryKey: queryKeys.automationHistory,
    queryFn: automationApi.history,
    enabled: showHistory,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => automationApi.updateControl(id, body),
    onSuccess: () => {
      toast.success('Automation setting updated');
    },
    onError: (err) => {
      const e = toApiError(err as any);
      toast.error(e.message);
    },
  });

  if (isLoading) return <Card><ListSkeleton rows={5} /></Card>;
  if (isError) return <Card><ErrorState message="Could not load automation controls" onRetry={() => refetch()} /></Card>;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-[15px] font-semibold">Automation controls</h3>
            <p className="mt-1 text-[11px] text-[#9899a5]">Configure how the AI handles each workflow action</p>
          </div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1.5 rounded-lg border border-[#e9e9ef] bg-white px-3 py-2 text-[11px] font-semibold text-[#777884] hover:bg-[#f7f7fa]"
          >
            <History size={13} />Change history
          </button>
        </div>
      </Card>

      {showHistory && (
        <Card>
          <h3 className="mb-3 font-display text-[14px] font-semibold">Change history</h3>
          {history && history.length > 0 ? (
            <div className="space-y-2">
              {history.map((h: AutomationControlHistory) => (
                <div key={h.id} className="flex items-center gap-3 rounded-lg bg-[#fbfbfd] px-3 py-2 text-[11px]">
                  <span className="font-semibold text-[#393945]">{h.action_type}</span>
                  <span className="text-[#9899a5]">{h.old_mode} →</span>
                  <span className="font-semibold text-[#7068cf]">{h.new_mode}</span>
                  <span className="ml-auto text-[#9899a5]">by {h.changed_by} · {formatIST(h.changed_at)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-[#9899a5]">No changes recorded yet.</p>
          )}
        </Card>
      )}

      {(controls || []).map((control: AutomationControl) => (
        <Card key={control.id}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-display text-[14px] font-semibold text-[#393945]">{control.label}</h4>
              </div>
              <p className="mt-1 text-[11px] text-[#9899a5]">{control.description}</p>
            </div>
            {canEdit ? (
              <div className="flex gap-0.5 rounded-xl border border-[#e9e9ef] bg-white p-1">
                {MODE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => updateMutation.mutate({ id: control.id, body: { mode: opt.value } })}
                    disabled={updateMutation.isPending}
                    className={`rounded-lg px-3 py-1.5 text-[10px] font-semibold transition ${
                      control.mode === opt.value
                        ? `${opt.color} border`
                        : 'text-[#777884] hover:bg-[#f7f7fa]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ) : (
              <span className={`rounded-lg border px-3 py-1.5 text-[10px] font-semibold ${MODE_OPTIONS.find((o) => o.value === control.mode)?.color}`}>
                {MODE_OPTIONS.find((o) => o.value === control.mode)?.label}
              </span>
            )}
          </div>

          <button
            onClick={() => setExpanded(expanded === control.id ? null : control.id)}
            className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-[#756bd1]"
          >
            {expanded === control.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            Advanced settings
          </button>

          {expanded === control.id && (
            <div className="mt-3 grid gap-3 border-t border-[#f0f0f4] pt-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-[#393945]">Approval timeout (mins)</label>
                <input
                  type="number"
                  defaultValue={control.approval_timeout_mins}
                  disabled={!canEdit}
                  onChange={(e) => updateMutation.mutate({ id: control.id, body: { approval_timeout_mins: parseInt(e.target.value) } })}
                  className="w-full rounded-lg border border-[#e9e9ef] bg-white px-3 py-2 text-[12px] outline-none focus:border-[#746ad1] disabled:opacity-60"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-[#393945]">Escalate after (mins)</label>
                <input
                  type="number"
                  defaultValue={control.escalate_after_mins}
                  disabled={!canEdit}
                  onChange={(e) => updateMutation.mutate({ id: control.id, body: { escalate_after_mins: parseInt(e.target.value) } })}
                  className="w-full rounded-lg border border-[#e9e9ef] bg-white px-3 py-2 text-[12px] outline-none focus:border-[#746ad1] disabled:opacity-60"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  defaultChecked={control.auto_approve_on_timeout}
                  disabled={!canEdit}
                  onChange={(e) => updateMutation.mutate({ id: control.id, body: { auto_approve_on_timeout: e.target.checked } })}
                  className="rounded"
                />
                <label className="text-[12px] text-[#393945]">Auto-approve on timeout</label>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-[#393945]">Escalate to user</label>
                <input
                  type="text"
                  defaultValue={control.escalate_to_user_name || ''}
                  disabled={!canEdit}
                  placeholder="Select user…"
                  className="w-full rounded-lg border border-[#e9e9ef] bg-white px-3 py-2 text-[12px] outline-none focus:border-[#746ad1] disabled:opacity-60"
                />
              </div>
            </div>
          )}
        </Card>
      ))}

      {!canEdit && (
        <p className="px-1 text-[11px] text-[#a0a0ac]">View-only mode. Only ops managers and admins can change automation settings.</p>
      )}
    </div>
  );
}

function UsersTab() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuthStore();
  const canEdit = hasRole('org_admin', 'ops_manager');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('ops_agent');

  const { data: users, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.users,
    queryFn: usersApi.list,
  });

  const inviteMutation = useMutation({
    mutationFn: () => usersApi.invite(inviteEmail, inviteRole),
    onSuccess: () => {
      toast.success('User invited');
      setInviteOpen(false); setInviteEmail('');
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
    },
    onError: (err) => { const e = toApiError(err as any); toast.error(e.message); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { role?: string; can_approve?: boolean } }) => usersApi.update(id, body),
    onSuccess: () => {
      toast.success('User updated');
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
    },
    onError: (err) => { const e = toApiError(err as any); toast.error(e.message); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      toast.success('User removed');
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
    },
    onError: (err) => { const e = toApiError(err as any); toast.error(e.message); },
  });

  const ROLE_LABELS: Record<string, string> = {
    ops_manager: 'Ops Manager',
    org_admin: 'Org Admin',
    ops_agent: 'Ops Agent',
    readonly: 'Read Only',
  };

  if (isLoading) return <Card><TableSkeleton rows={5} cols={4} /></Card>;
  if (isError) return <Card><ErrorState message="Could not load users" onRetry={() => refetch()} /></Card>;

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-[15px] font-semibold">Users</h3>
        {canEdit && (
          <button
            onClick={() => setInviteOpen(true)}
            className="rounded-xl bg-[#7068cf] px-3.5 py-2 text-[11px] font-semibold text-white"
          >
            Invite user
          </button>
        )}
      </div>

      {users && users.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#f0f0f4] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a2a2ad]">
                <th className="pb-3">Name</th>
                <th className="pb-3">Email</th>
                <th className="pb-3">Role</th>
                <th className="pb-3">Can approve</th>
                {canEdit && <th className="pb-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {users.map((u: User) => (
                <tr key={u.id} className="border-b border-[#f4f4f7] last:border-0">
                  <td className="py-3 text-[12px] font-semibold text-[#393945]">{u.full_name}</td>
                  <td className="py-3 text-[11px] text-[#777884]">{u.email}</td>
                  <td className="py-3">
                    {canEdit ? (
                      <select
                        value={u.role}
                        onChange={(e) => updateMutation.mutate({ id: u.id, body: { role: e.target.value } })}
                        className="rounded-lg border border-[#e9e9ef] bg-white px-2 py-1 text-[11px] font-medium text-[#686975] outline-none"
                      >
                        {Object.entries(ROLE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-[11px] text-[#777884]">{ROLE_LABELS[u.role] || u.role}</span>
                    )}
                  </td>
                  <td className="py-3">
                    {canEdit ? (
                      <input
                        type="checkbox"
                        checked={u.can_approve}
                        onChange={(e) => updateMutation.mutate({ id: u.id, body: { can_approve: e.target.checked } })}
                        className="rounded"
                      />
                    ) : (
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${u.can_approve ? 'bg-[#eaf9f2] text-[#13945a]' : 'bg-slate-50 text-slate-400'}`}>
                        {u.can_approve ? 'Yes' : 'No'}
                      </span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="py-3 text-right">
                      <button
                        onClick={() => { if (confirm(`Remove ${u.full_name}?`)) deleteMutation.mutate(u.id); }}
                        className="rounded-lg border border-[#e9e9ef] px-2.5 py-1.5 text-[10px] font-semibold text-[#d45166] hover:bg-[#fff0f2]"
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No users" message="Invite team members to give them access to the platform." />
      )}

      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setInviteOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="mb-4 font-display text-[15px] font-semibold">Invite user</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-[#393945]">Email</label>
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  type="email"
                  placeholder="colleague@freightops.in"
                  className="w-full rounded-xl border border-[#e9e9ef] bg-white px-3.5 py-2.5 text-[13px] outline-none focus:border-[#746ad1] focus:ring-2 focus:ring-[#e8e5f7]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-[#393945]">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as Role)}
                  className="w-full rounded-xl border border-[#e9e9ef] bg-white px-3.5 py-2.5 text-[13px] outline-none focus:border-[#746ad1]"
                >
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setInviteOpen(false)} className="rounded-lg border border-[#e9e9ef] px-4 py-2 text-[12px] font-medium text-[#777884]">Cancel</button>
              <button
                onClick={() => inviteMutation.mutate()}
                disabled={!inviteEmail.trim() || inviteMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-[#7068cf] px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
              >
                {inviteMutation.isPending && <Loader2 size={13} className="animate-spin" />}
                Send invite
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
