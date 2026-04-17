'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

interface AuthState {
  user:         User | null;
  token:        string | null;
  _hasHydrated: boolean;
  setAuth:      (token: string, user: User) => void;
  setUser:      (user: User) => void;
  logout:       () => void;
  setHasHydrated: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user:         null,
      token:        null,
      _hasHydrated: false,

      setHasHydrated: (v) => set({ _hasHydrated: v }),

      setAuth: (token, user) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('sitepilot_token', token);
          document.cookie = `sitepilot_token=${token}; path=/; max-age=${7 * 24 * 3600}; SameSite=Lax`;
        }
        set({ token, user });
      },

      setUser: (user) => set({ user }),

      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('sitepilot_token');
          document.cookie = 'sitepilot_token=; path=/; max-age=0';
        }
        set({ token: null, user: null });
      },
    }),
    {
      name: 'sitepilot-auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHasHydrated(true);
          // Keep localStorage sitepilot_token in sync with persisted token
          if (state.token && typeof window !== 'undefined') {
            localStorage.setItem('sitepilot_token', state.token);
          }
        }
      },
    },
  ),
);
