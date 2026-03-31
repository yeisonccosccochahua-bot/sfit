import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  Notification,
  NotificationChannel,
  NotificationStatus,
  User,
} from '../../entities';

import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { WhatsappService } from './whatsapp.service';
import { EmailService } from './email.service';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification) private readonly notifRepo: Repository<Notification>,
    @InjectRepository(User)         private readonly userRepo:  Repository<User>,
    private readonly whatsapp: WhatsappService,
    private readonly email:    EmailService,
    private readonly gateway:  NotificationsGateway,
  ) {}

  // ── SEND ─────────────────────────────────────────────────────────────────────
  /**
   * Persists one Notification record per channel and dispatches
   * each channel asynchronously (fire-and-forget with status update).
   */
  async send(dto: CreateNotificationDto): Promise<Notification[]> {
    // Load user for contact info
    const user = await this.userRepo.findOne({
      where: { id: dto.userId },
      select: ['id', 'email', 'phone', 'municipality_id'],
    });
    if (!user) {
      this.logger.warn(`send() — usuario ${dto.userId} no encontrado`);
      return [];
    }

    const results: Notification[] = [];

    for (const channel of dto.channels) {
      // Persist record as PENDIENTE
      const record = await this.notifRepo.save(
        this.notifRepo.create({
          user_id: dto.userId,
          channel,
          type:    dto.type,
          title:   dto.title,
          content: dto.content,
          status:  NotificationStatus.PENDIENTE,
        }),
      );
      results.push(record);

      // Dispatch — update status after delivery
      this.dispatch(record, user, dto).catch((err) =>
        this.logger.error(`dispatch() error canal ${channel}: ${err.message}`),
      );
    }

    return results;
  }

  // ── FIND ALL (paginated, mine only) ──────────────────────────────────────────
  async findAll(query: NotificationQueryDto, user: User) {
    const qb = this.notifRepo
      .createQueryBuilder('n')
      .where('n.user_id = :uid', { uid: user.id })
      .orderBy('n.created_at', 'DESC');

    if (query.unread_only) {
      qb.andWhere('n.status != :read', { read: NotificationStatus.LEIDO });
    }

    const [data, total] = await qb
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();

    return {
      data,
      total,
      page:     query.page,
      lastPage: Math.ceil(total / query.limit) || 1,
    };
  }

  // ── MARK READ ─────────────────────────────────────────────────────────────────
  async markRead(id: string, user: User): Promise<Notification> {
    const notif = await this.notifRepo.findOne({ where: { id } });
    if (!notif) throw new NotFoundException(`Notificación ${id} no encontrada`);
    if (notif.user_id !== user.id) throw new ForbiddenException();

    notif.status = NotificationStatus.LEIDO;
    return this.notifRepo.save(notif);
  }

  // ── MARK ALL READ ─────────────────────────────────────────────────────────────
  async markAllRead(user: User): Promise<{ updated: number }> {
    const result = await this.notifRepo
      .createQueryBuilder()
      .update(Notification)
      .set({ status: NotificationStatus.LEIDO })
      .where('user_id = :uid', { uid: user.id })
      .andWhere('status != :read', { read: NotificationStatus.LEIDO })
      .execute();

    return { updated: result.affected ?? 0 };
  }

  // ── UNREAD COUNT ─────────────────────────────────────────────────────────────
  async getUnreadCount(user: User): Promise<{ count: number }> {
    const count = await this.notifRepo
      .createQueryBuilder('n')
      .where('n.user_id = :uid', { uid: user.id })
      .andWhere('n.status != :read', { read: NotificationStatus.LEIDO })
      .getCount();
    return { count };
  }

  // ── PRIVATE ──────────────────────────────────────────────────────────────────

  private async dispatch(
    record: Notification,
    user:   User,
    dto:    CreateNotificationDto,
  ): Promise<void> {
    let success = false;

    switch (record.channel) {
      case NotificationChannel.WHATSAPP: {
        const res = await this.whatsapp.send(
          user.phone ?? '',
          dto.type,
          dto.title,
          dto.content,
          dto.metadata,
        );
        success = res.success;
        break;
      }

      case NotificationChannel.EMAIL: {
        const res = await this.email.send(
          user.email ?? '',
          dto.type,
          dto.title,
          dto.content,
          dto.metadata,
        );
        success = res.success;
        break;
      }

      case NotificationChannel.WEB: {
        // Emit to the user's personal socket room
        this.gateway.emitToUser(user.id, {
          id:       record.id,
          type:     dto.type,
          title:    dto.title,
          content:  dto.content,
          priority: dto.priority,
          metadata: dto.metadata,
          created_at: record.created_at,
        });

        // If priority ALTA and municipality known → broadcast to fiscal staff too
        if (dto.priority === 'ALTA' && user.municipality_id) {
          this.gateway.emitToMunicipality(user.municipality_id, 'notification:new', {
            type:     dto.type,
            title:    dto.title,
            content:  dto.content,
            priority: dto.priority,
          });
        }
        success = true;
        break;
      }
    }

    // Update delivery status
    record.status  = success ? NotificationStatus.ENVIADO : NotificationStatus.FALLIDO;
    record.sent_at = success ? new Date() : record.sent_at;
    await this.notifRepo.save(record).catch((err) =>
      this.logger.error('Error actualizando estado de notificación', err),
    );
  }
}
