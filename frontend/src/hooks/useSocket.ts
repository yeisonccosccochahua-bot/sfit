import { useEffect, useCallback } from 'react';
import { getSocket, connectSocket, disconnectSocket, type WsEvent } from '../services/socket';
import { useAuthStore } from '../stores/authStore';

export function useSocket() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated) {
      connectSocket();
    }
    return () => {
      disconnectSocket();
    };
  }, [isAuthenticated]);

  const on = useCallback(<T = unknown>(event: WsEvent, handler: (data: T) => void) => {
    const socket = getSocket();
    socket.on(event, handler);
    return () => { socket.off(event, handler); };
  }, []);

  const emit = useCallback((event: string, data?: unknown) => {
    getSocket().emit(event, data);
  }, []);

  return { on, emit };
}
