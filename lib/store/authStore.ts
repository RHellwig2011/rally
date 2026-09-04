import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
};

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  /**
   * True once the persisted state has been rehydrated on the client.
   * Always false during SSR and the first client render, so components
   * that branch on auth state can render the logged-out variant until
   * hydration is complete and avoid React hydration mismatches.
   */
  hasHydrated: boolean;
  setHasHydrated: (hasHydrated: boolean) => void;
  setUser: (user: User | null) => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      hasHydrated: false,

      setHasHydrated: (hasHydrated) => set({ hasHydrated }),

      setUser: (user) => set({ user, isAuthenticated: !!user }),

      logout: async () => {
        try {
          await fetch('/api/auth/logout', { method: 'POST' });
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          set({ user: null, isAuthenticated: false });
        }
      },

      checkAuth: async () => {
        try {
          const response = await fetch('/api/auth/me');
          if (response.ok) {
            const data = await response.json();
            if (data.user) {
              set({ user: data.user, isAuthenticated: true });
            } else {
              set({ user: null, isAuthenticated: false });
            }
          } else {
            set({ user: null, isAuthenticated: false });
          }
        } catch (error) {
          console.error('Auth check error:', error);
          set({ user: null, isAuthenticated: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      // hasHydrated is intentionally excluded: it is runtime-only state
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
      onRehydrateStorage: () => (state) => {
        // Mark hydration complete (components also have a mounted-effect
        // fallback in case this callback never fires, e.g. storage errors)
        state?.setHasHydrated(true);
      },
    }
  )
);
