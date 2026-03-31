import { create } from 'zustand';
import type { User, AuthTokens } from '../types';

// Token solo en memoria — refresh_token en sessionStorage (se borra al cerrar pestaña)
const SESSION_KEY = 'sfit_rt';

interface AuthState {
  user: User | null;
  token: string | null;         // access_token (memoria)
  isAuthenticated: boolean;
  isLoading: boolean;

  setTokens: (tokens: AuthTokens, user: User) => void;
  logout: () => void;
  setUser: (user: User) => void;
  getRefreshToken: () => string | null;
  setLoading: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,

  setTokens: (tokens, user) => {
    // access_token solo en memoria
    set({ token: tokens.access_token, user, isAuthenticated: true, isLoading: false });
    // refresh_token en sessionStorage (limpiado al cerrar pestaña)
    sessionStorage.setItem(SESSION_KEY, tokens.refresh_token);
  },

  logout: () => {
    set({ token: null, user: null, isAuthenticated: false });
    sessionStorage.removeItem(SESSION_KEY);
  },

  setUser: (user) => set({ user }),

  getRefreshToken: () => sessionStorage.getItem(SESSION_KEY),

  setLoading: (v) => set({ isLoading: v }),
}));
