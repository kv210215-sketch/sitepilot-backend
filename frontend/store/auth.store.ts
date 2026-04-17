'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

interface AuthState {
  user:      User | null;
  token:     string | null;
  isLoading: boolean;
  setAuth:   (token: string, user: User) => void;
  setUser:   (user: User) => void;
  logout:    () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user:      null,
      token:     null,
      isLoading: false,

      setAuth: (token, user) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('sitepilot_token', token);
          // Also set a cookie so middleware can read it for server-side protection
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
    },
  ),
);
