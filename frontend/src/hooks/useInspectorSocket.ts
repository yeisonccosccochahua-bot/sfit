import { useEffect, useCallback } from 'react';
import { getSocket, connectSocket } from '../services/socket';

type InspectorSocketEvent =
  | 'fatigue:alert'
  | 'trip:status_changed'
  | 'dashboard:update'
  | 'notification:new';

export function useInspectorSocket(
  handlers: Partial<Record<InspectorSocketEvent, (data: any) => void>>,
) {
  const stableHandlers = useCallback(() => handlers, []);

  useEffect(() => {
    connectSocket();
    const socket = getSocket();

    const registered: Array<{ event: string; fn: (d: any) => void }> = [];

    const h = stableHandlers();
    for (const [event, fn] of Object.entries(h)) {
      if (fn) {
        socket.on(event, fn);
        registered.push({ event, fn });
      }
    }

    return () => {
      registered.forEach(({ event, fn }) => socket.off(event, fn));
    };
  }, []);
}
