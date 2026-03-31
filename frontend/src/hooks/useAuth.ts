import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import api from '../services/api';
import { destroySocket } from '../services/socket';
import { ROLE_REDIRECT } from '../lib/constants';
import type { AuthTokens, User } from '../types';

export function useAuth() {
  const store = useAuthStore();
  const navigate = useNavigate();

  const login = useCallback(
    async (email: string, password: string) => {
      const tokens = await api.post<AuthTokens>('/api/auth/login', { email, password });
      const user = await api.get<User>('/api/auth/profile', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      store.setTokens(tokens, user);
      navigate(ROLE_REDIRECT[user.role], { replace: true });
    },
    [store, navigate],
  );

  const logout = useCallback(() => {
    destroySocket();
    store.logout();
    navigate('/login', { replace: true });
  }, [store, navigate]);

  const checkAuth = useCallback(async () => {
    const rt = store.getRefreshToken();
    if (!rt) {
      store.setLoading(false);
      return;
    }
    try {
      const tokens = await api.post<AuthTokens>('/api/auth/refresh', { refresh_token: rt });
      const user = await api.get<User>('/api/auth/profile', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      store.setTokens(tokens, user);
    } catch {
      store.logout();
    } finally {
      store.setLoading(false);
    }
  }, [store]);

  return {
    user: store.user,
    token: store.token,
    isAuthenticated: store.isAuthenticated,
    isLoading: store.isLoading,
    login,
    logout,
    checkAuth,
  };
}
