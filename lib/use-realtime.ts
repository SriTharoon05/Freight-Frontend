'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from './supabase';
import { queryKeys } from './query-keys';

export function useRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('freightos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shipments' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['shipments'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        if (payload.eventType === 'UPDATE') {
          queryClient.invalidateQueries({ queryKey: ['shipments', 'detail'] });
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'exceptions' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['exceptions'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        const ex = payload.new as { title?: string };
        if (ex?.title) {
          toast.error(`New exception: ${ex.title}`);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'exceptions' }, () => {
        queryClient.invalidateQueries({ queryKey: ['exceptions'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'human_approval_queue' }, (payload) => {
        const item = payload.new as { status?: string };
        if (item?.status === 'pending') {
          queryClient.invalidateQueries({ queryKey: ['approvals'] });
          queryClient.invalidateQueries({ queryKey: ['shipments'] });
          toast.info('New approval request received');
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'human_approval_queue' }, (payload) => {
        const item = payload.new as { status?: string };
        if (item?.status !== 'pending') {
          queryClient.invalidateQueries({ queryKey: ['approvals'] });
          queryClient.invalidateQueries({ queryKey: ['shipments'] });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
