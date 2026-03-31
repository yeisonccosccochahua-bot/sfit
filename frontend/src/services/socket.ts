import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';

// VITE_WS_URL takes precedence; fall back to VITE_API_URL (same server in Railway)
const WS_URL =
  import.meta.env.VITE_WS_URL ??
  import.meta.env.VITE_API_URL ??
  'http://localhost:3000';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    // Connect to /notifications namespace (matches NotificationsGateway)
    socket = io(`${WS_URL}/notifications`, {
      autoConnect:      false,
      transports:       ['websocket', 'polling'],
      reconnection:     true,
      reconnectionDelay: 2_000,
      reconnectionAttempts: 10,
      auth: (cb) => {
        cb({ token: useAuthStore.getState().token });
      },
    });
  }
  return socket;
}

export function connectSocket(): void {
  const s = getSocket();
  if (!s.connected) s.connect();
}

export function disconnectSocket(): void {
  socket?.disconnect();
  // Do not null out the singleton — reconnect reuses the same instance.
  // This prevents a race condition in React Strict Mode where cleanup fires
  // before the WebSocket handshake completes, creating a second socket instance.
}

export function destroySocket(): void {
  socket?.disconnect();
  socket = null;
}

export type WsEvent =
  | 'trip:started'
  | 'trip:ended'
  | 'trip:auto_closed'
  | 'trip:status_changed'
  | 'fatigue:alert'
  | 'report:new'
  | 'notification:new'
  | 'dashboard:update'
  | 'pong';
