import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';

import { NotificationsService } from './notifications.service';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { User, UserRole } from '../../entities';

const ALL_ROLES = [
  UserRole.ADMIN_MUNICIPAL,
  UserRole.FISCAL,
  UserRole.OPERADOR_EMPRESA,
  UserRole.CIUDADANO,
  UserRole.INSPECTOR,
];

@ApiTags('Notificaciones')
@ApiBearerAuth()
@Controller('api/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  // ── GET /api/notifications/unread-count ─────────────────────────────────────
  // Declared BEFORE /:id to avoid route conflict
  @Get('unread-count')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Contador de notificaciones no leídas del usuario actual' })
  @ApiResponse({ status: 200, schema: { example: { count: 5 } } })
  getUnreadCount(@CurrentUser() user: User) {
    return this.service.getUnreadCount(user);
  }

  // ── PATCH /api/notifications/read-all ────────────────────────────────────────
  @Patch('read-all')
  @Roles(...ALL_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar todas las notificaciones del usuario como leídas' })
  @ApiResponse({ status: 200, schema: { example: { updated: 12 } } })
  markAllRead(@CurrentUser() user: User) {
    return this.service.markAllRead(user);
  }

  // ── GET /api/notifications ───────────────────────────────────────────────────
  @Get()
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Listar mis notificaciones (paginado)' })
  findAll(@Query() query: NotificationQueryDto, @CurrentUser() user: User) {
    return this.service.findAll(query, user);
  }

  // ── PATCH /api/notifications/:id/read ───────────────────────────────────────
  @Patch(':id/read')
  @Roles(...ALL_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar una notificación específica como leída' })
  @ApiParam({ name: 'id', description: 'UUID de la notificación' })
  @ApiResponse({ status: 404, description: 'Notificación no encontrada' })
  markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.service.markRead(id, user);
  }
}
