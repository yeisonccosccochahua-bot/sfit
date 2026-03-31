import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@WebSocketGateway({
  namespace:   '/notifications',
  cors:        { origin: '*', credentials: true },
  transports:  ['websocket', 'polling'],
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  // ── Connection lifecycle ──────────────────────────────────────────────────────

  async handleConnection(socket: Socket): Promise<void> {
    try {
      const token =
        (socket.handshake.auth?.token as string) ??
        (socket.handshake.headers.authorization ?? '').replace('Bearer ', '');

      if (!token) {
        socket.emit('error', { message: 'Token requerido' });
        socket.disconnect(true);
        return;
      }

      const payload = this.jwtService.verify<JwtPayload>(token);
      socket.data.userId         = payload.sub;
      socket.data.municipalityId = payload.municipalityId;
      socket.data.role           = payload.role;

      // Join municipality room (broadcast to all staff in the same municipality)
      await socket.join(`municipality:${payload.municipalityId}`);
      // Join personal room (targeted notifications)
      await socket.join(`user:${payload.sub}`);

      this.logger.log(
        `Socket conectado: ${socket.id} | user ${payload.sub} | mun ${payload.municipalityId}`,
      );
    } catch {
      socket.emit('error', { message: 'Token inválido o expirado' });
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket): void {
    this.logger.log(`Socket desconectado: ${socket.id}`);
  }

  // ── Client-initiated events ───────────────────────────────────────────────────

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() socket: Socket): void {
    socket.emit('pong', { ts: Date.now() });
  }

  // ── Server-initiated emitters (called by NotificationsService) ───────────────

  /** Emit a new notification to a specific user's room */
  emitToUser(userId: string, payload: object): void {
    this.server.to(`user:${userId}`).emit('notification:new', payload);
  }

  /** Broadcast to all connected clients of a municipality */
  emitToMunicipality(municipalityId: string, event: string, payload: object): void {
    this.server.to(`municipality:${municipalityId}`).emit(event, payload);
  }

  /** Convenience wrappers for named events */
  emitDashboardUpdate(municipalityId: string, data: object): void {
    this.emitToMunicipality(municipalityId, 'dashboard:update', data);
  }

  emitTripStatusChanged(municipalityId: string, data: object): void {
    this.emitToMunicipality(municipalityId, 'trip:status_changed', data);
  }

  emitFatigueAlert(municipalityId: string, data: object): void {
    this.emitToMunicipality(municipalityId, 'fatigue:alert', data);
  }
}
