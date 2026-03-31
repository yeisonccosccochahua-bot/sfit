import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

import { NotificationsService } from './notifications.service';
import { WhatsappService } from './whatsapp.service';
import { EmailService } from './email.service';
import { NotificationsGateway } from './notifications.gateway';

import {
  Notification,
  NotificationChannel,
  NotificationStatus,
  User,
  UserRole,
  UserStatus,
} from '../../entities';
import {
  CreateNotificationDto,
  NotificationType,
} from './dto/create-notification.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';

// ─── Mock factories ───────────────────────────────────────────────────────────
const mockRepo = () => ({
  create:             jest.fn(),
  save:               jest.fn(),
  findOne:            jest.fn(),
  count:              jest.fn(),
  createQueryBuilder: jest.fn(),
});

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id:              'user-uuid',
    email:           'user@test.com',
    phone:           '+51999000111',
    role:            UserRole.FISCAL,
    municipality_id: 'mun-uuid',
    status:          UserStatus.ACTIVO,
    ...overrides,
  } as User;
}

function makeNotif(overrides: Partial<Notification> = {}): Notification {
  return {
    id:         'notif-uuid',
    user_id:    'user-uuid',
    channel:    NotificationChannel.WEB,
    type:       NotificationType.SANCION,
    title:      'Test',
    content:    'Contenido',
    status:     NotificationStatus.PENDIENTE,
    created_at: new Date(),
    ...overrides,
  } as unknown as Notification;
}

// ─── Test suite ───────────────────────────────────────────────────────────────
describe('NotificationsService', () => {
  let service:       NotificationsService;
  let notifRepo:     ReturnType<typeof mockRepo>;
  let userRepo:      ReturnType<typeof mockRepo>;
  let whatsappSvc:   jest.Mocked<WhatsappService>;
  let emailSvc:      jest.Mocked<EmailService>;
  let gateway:       jest.Mocked<NotificationsGateway>;
  let mockQb:        any;

  beforeEach(async () => {
    notifRepo = mockRepo();
    userRepo  = mockRepo();

    whatsappSvc = {
      send:       jest.fn().mockResolvedValue({ success: true, messageId: 'wa-123' }),
      isMockMode: true,
    } as unknown as jest.Mocked<WhatsappService>;

    emailSvc = {
      send:       jest.fn().mockResolvedValue({ success: true, messageId: 'em-123' }),
      isMockMode: true,
    } as unknown as jest.Mocked<EmailService>;

    gateway = {
      emitToUser:        jest.fn(),
      emitToMunicipality: jest.fn(),
      emitDashboardUpdate: jest.fn(),
      emitTripStatusChanged: jest.fn(),
      emitFatigueAlert:  jest.fn(),
    } as unknown as jest.Mocked<NotificationsGateway>;

    mockQb = {
      where:           jest.fn().mockReturnThis(),
      andWhere:        jest.fn().mockReturnThis(),
      orderBy:         jest.fn().mockReturnThis(),
      skip:            jest.fn().mockReturnThis(),
      take:            jest.fn().mockReturnThis(),
      update:          jest.fn().mockReturnThis(),
      set:             jest.fn().mockReturnThis(),
      execute:         jest.fn().mockResolvedValue({ affected: 3 }),
      getCount:        jest.fn().mockResolvedValue(2),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    notifRepo.createQueryBuilder.mockReturnValue(mockQb);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(Notification), useValue: notifRepo },
        { provide: getRepositoryToken(User),         useValue: userRepo },
        { provide: WhatsappService,                  useValue: whatsappSvc },
        { provide: EmailService,                     useValue: emailSvc },
        { provide: NotificationsGateway,             useValue: gateway },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  // ── send() ──────────────────────────────────────────────────────────────────

  it('[send] retorna [] si el usuario no existe', async () => {
    userRepo.findOne.mockResolvedValue(null);
    const dto: CreateNotificationDto = {
      userId:   'no-existe',
      channels: [NotificationChannel.WEB],
      type:     NotificationType.SANCION,
      title:    'Test',
      content:  'Contenido',
      priority: 'MEDIA',
    };
    const result = await service.send(dto);
    expect(result).toEqual([]);
    expect(notifRepo.save).not.toHaveBeenCalled();
  });

  it('[send] crea un registro por canal y llama al gateway para WEB', async () => {
    const user = makeUser();
    userRepo.findOne.mockResolvedValue(user);

    const notifRecord = makeNotif({ channel: NotificationChannel.WEB });
    notifRepo.create.mockReturnValue(notifRecord);
    notifRepo.save
      .mockResolvedValueOnce(notifRecord)  // persist record
      .mockResolvedValue(notifRecord);     // status update

    const dto: CreateNotificationDto = {
      userId:   user.id,
      channels: [NotificationChannel.WEB],
      type:     NotificationType.REPORTE_NUEVO,
      title:    'Nuevo reporte',
      content:  'Reporte ciudadano recibido',
      priority: 'MEDIA',
    };

    const records = await service.send(dto);

    expect(records).toHaveLength(1);
    expect(records[0].channel).toBe(NotificationChannel.WEB);
    // Gateway emit happens async — wait one tick
    await new Promise((r) => setImmediate(r));
    expect(gateway.emitToUser).toHaveBeenCalledWith(user.id, expect.objectContaining({
      type:  NotificationType.REPORTE_NUEVO,
      title: 'Nuevo reporte',
    }));
  });

  it('[send] llama al WhatsappService cuando el canal es WHATSAPP', async () => {
    const user = makeUser({ phone: '+51987654321' });
    userRepo.findOne.mockResolvedValue(user);

    const notifRecord = makeNotif({ channel: NotificationChannel.WHATSAPP });
    notifRepo.create.mockReturnValue(notifRecord);
    notifRepo.save.mockResolvedValue(notifRecord);

    const dto: CreateNotificationDto = {
      userId:   user.id,
      channels: [NotificationChannel.WHATSAPP],
      type:     NotificationType.FATIGA_RIESGO,
      title:    'Alerta fatiga',
      content:  'Conductor en riesgo',
      priority: 'ALTA',
    };

    await service.send(dto);
    await new Promise((r) => setImmediate(r));

    expect(whatsappSvc.send).toHaveBeenCalledWith(
      user.phone,
      NotificationType.FATIGA_RIESGO,
      'Alerta fatiga',
      'Conductor en riesgo',
      undefined,
    );
  });

  it('[send] llama al EmailService cuando el canal es EMAIL', async () => {
    const user = makeUser({ email: 'fiscal@municipio.gob.pe' });
    userRepo.findOne.mockResolvedValue(user);

    const notifRecord = makeNotif({ channel: NotificationChannel.EMAIL });
    notifRepo.create.mockReturnValue(notifRecord);
    notifRepo.save.mockResolvedValue(notifRecord);

    const dto: CreateNotificationDto = {
      userId:   user.id,
      channels: [NotificationChannel.EMAIL],
      type:     NotificationType.APELACION,
      title:    'Apelación recibida',
      content:  'El operador ha apelado la sanción.',
      priority: 'MEDIA',
    };

    await service.send(dto);
    await new Promise((r) => setImmediate(r));

    expect(emailSvc.send).toHaveBeenCalledWith(
      user.email,
      NotificationType.APELACION,
      'Apelación recibida',
      'El operador ha apelado la sanción.',
      undefined,
    );
  });

  it('[send] crea un registro por cada canal en envío multi-canal', async () => {
    const user = makeUser();
    userRepo.findOne.mockResolvedValue(user);
    notifRepo.create.mockImplementation((d: any) => ({ id: 'n-uuid', ...d }));
    notifRepo.save.mockImplementation((n: any) => Promise.resolve(n));

    const dto: CreateNotificationDto = {
      userId:   user.id,
      channels: [NotificationChannel.WHATSAPP, NotificationChannel.WEB],
      type:     NotificationType.FATIGA_BLOQUEADO,
      title:    'Conductor bloqueado',
      content:  'El conductor ha sido bloqueado por fatiga extrema.',
      priority: 'ALTA',
    };

    const records = await service.send(dto);
    expect(records).toHaveLength(2);
  });

  // ── markRead() ───────────────────────────────────────────────────────────────

  it('[markRead] lanza NotFoundException si la notificación no existe', async () => {
    notifRepo.findOne.mockResolvedValue(null);
    await expect(service.markRead('no-uuid', makeUser())).rejects.toThrow(NotFoundException);
  });

  it('[markRead] lanza ForbiddenException si la notificación pertenece a otro usuario', async () => {
    notifRepo.findOne.mockResolvedValue(makeNotif({ user_id: 'otro-uuid' }));
    await expect(service.markRead('notif-uuid', makeUser())).rejects.toThrow(ForbiddenException);
  });

  it('[markRead] actualiza estado a LEIDO', async () => {
    const notif = makeNotif({ user_id: 'user-uuid' });
    notifRepo.findOne.mockResolvedValue(notif);
    notifRepo.save.mockImplementation((n: any) => Promise.resolve(n));

    const result = await service.markRead('notif-uuid', makeUser());
    expect(result.status).toBe(NotificationStatus.LEIDO);
  });

  // ── markAllRead() ────────────────────────────────────────────────────────────

  it('[markAllRead] retorna el número de registros actualizados', async () => {
    const result = await service.markAllRead(makeUser());
    expect(result.updated).toBe(3); // mockQb.execute returns { affected: 3 }
  });

  // ── getUnreadCount() ─────────────────────────────────────────────────────────

  it('[getUnreadCount] retorna el conteo de notificaciones no leídas', async () => {
    mockQb.getCount.mockResolvedValue(7);
    const result = await service.getUnreadCount(makeUser());
    expect(result.count).toBe(7);
  });

  // ── findAll() ────────────────────────────────────────────────────────────────

  it('[findAll] filtra solo no leídas cuando unread_only=true', async () => {
    mockQb.getManyAndCount.mockResolvedValue([[], 0]);

    const query: NotificationQueryDto = { page: 1, limit: 20, unread_only: true };
    await service.findAll(query, makeUser());

    expect(mockQb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('status'),
      expect.objectContaining({ read: NotificationStatus.LEIDO }),
    );
  });
});
