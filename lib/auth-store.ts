'use client';

import { create } from 'zustand';
import type { User, Role } from './types';

interface AuthState {
  user: User | null;
  token: string | null;
  hydrated: boolean;
  setAuth: (token: string, user: User) => void;
  setUser: (user: User) => void;
  clear: () => void;
  hasRole: (...roles: Role[]) => boolean;
  canApprove: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  hydrated: false,
  setAuth: (token, user) => set({ token, user, hydrated: true }),
  setUser: (user) => set({ user }),
  clear: () => set({ user: null, token: null, hydrated: true }),
  hasRole: (...roles) => {
    const user = get().user;
    return !!user && roles.includes(user.role);
  },
  canApprove: () => {
    const user = get().user;
    return !!user && (user.can_approve || user.role === 'ops_manager' || user.role === 'org_admin');
  },
}));
