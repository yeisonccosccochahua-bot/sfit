import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import {
  ForbiddenException,
  HttpException,
  UnprocessableEntityException,
} from '@nestjs/common';
import * as crypto from 'crypto';

import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import {
  Report, ReportType, ReportStatus,
  User, UserRole, UserStatus,
  Vehicle,
  Trip, TripStatus,
  AuditLog, IncentivePoint, Notification,
} from '../../entities';

// ─── Mock factory ─────────────────────────────────────────────────────────────
const mockRepo = () => ({
  create:          jest.fn(),
  save:            jest.fn(),
  find:            jest.fn(),
  findOne:         jest.fn(),
  findOneOrFail:   jest.fn(),
  count:           jest.fn(),
  update:          jest.fn(),
  createQueryBuilder: jest.fn(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
const SECRET = 'test_hmac_secret';

function makeHmac(qrCode: string) {
  return crypto.createHmac('sha256', SECRET).update(qrCode).digest('hex');
}

function makeCitizen(overrides: Partial<User> = {}): User {
  return {
    id:               'citizen-uuid',
    email:            'citizen@test.com',
    name:             'Juan Mamani',
    dni:              '12345678',
    role:             UserRole.CIUDADANO,
    municipality_id:  'mun-uuid',
    status:           UserStatus.ACTIVO,
    reputation_score: 90, // >80 triggers the +20 score bonus
    total_points:     50,
    reports_today:    0,
    ...overrides,
  } as User;
}

function makeDto(overrides: Partial<CreateReportDto> = {}): CreateReportDto {
  return {
    trip_id:        'trip-uuid',
    qr_code:        'qr-code-uuid',
    type:           ReportType.CONDUCCION_PELIGROSA,
    description:    'Descripción de prueba',
    is_same_driver: true,
    ...overrides,
  };
}

// ─── Test suite ───────────────────────────────────────────────────────────────
describe('ReportsService', () => {
  let service: ReportsService;
  let reportRepo:    ReturnType<typeof mockRepo>;
  let userRepo:      ReturnType<typeof mockRepo>;
  let vehicleRepo:   ReturnType<typeof mockRepo>;
  let tripRepo:      ReturnType<typeof mockRepo>;
  let auditRepo:     ReturnType<typeof mockRepo>;
  let incentiveRepo: ReturnType<typeof mockRepo>;
  let notifRepo:     ReturnType<typeof mockRepo>;

  // Shared mock stubs
  let mockVehicle: Partial<Vehicle>;
  let mockTrip:    Partial<Trip>;
  let mockQb:      any;

  beforeEach(async () => {
    reportRepo    = mockRepo();
    userRepo      = mockRepo();
    vehicleRepo   = mockRepo();
    tripRepo      = mockRepo();
    auditRepo     = mockRepo();
    incentiveRepo = mockRepo();
    notifRepo     = mockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: ConfigService,
          useValue: { get: (key: string, def: string) => (key === 'QR_HMAC_SECRET' ? SECRET : def) },
        },
        { provide: getRepositoryToken(Report),         useValue: reportRepo },
        { provide: getRepositoryToken(User),           useValue: userRepo },
        { provide: getRepositoryToken(Vehicle),        useValue: vehicleRepo },
        { provide: getRepositoryToken(Trip),           useValue: tripRepo },
        { provide: getRepositoryToken(AuditLog),       useValue: auditRepo },
        { provide: getRepositoryToken(IncentivePoint), useValue: incentiveRepo },
        { provide: getRepositoryToken(Notification),   useValue: notifRepo },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);

    // Set up valid happy-path stubs
    mockVehicle = {
      id:       'vehicle-uuid',
      plate:    'ABC-123',
      qr_code:  'qr-code-uuid',
      qr_hmac:  makeHmac('qr-code-uuid'),
    };
    mockTrip = {
      id:              'trip-uuid',
      vehicle_id:      'vehicle-uuid',
      municipality_id: 'mun-uuid',
      status:          TripStatus.EN_CURSO,
    };

    // QueryBuilder stub — shared across repos (supports both select and update patterns)
    mockQb = {
      where:    jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
      update:   jest.fn().mockReturnThis(),
      set:      jest.fn().mockReturnThis(),
      execute:  jest.fn().mockResolvedValue({ affected: 1 }),
    };

    userRepo.findOneOrFail.mockResolvedValue(makeCitizen());
    vehicleRepo.findOne.mockResolvedValue(mockVehicle);
    tripRepo.findOne.mockResolvedValue(mockTrip);
    reportRepo.createQueryBuilder.mockReturnValue(mockQb);
    userRepo.createQueryBuilder.mockReturnValue(mockQb);
    reportRepo.create.mockImplementation((d) => ({ id: 'report-uuid', ...d }));
    reportRepo.save.mockImplementation((r) => Promise.resolve(r));
    auditRepo.create.mockImplementation((d) => d);
    auditRepo.save.mockResolvedValue({});
    incentiveRepo.create.mockImplementation((d) => d);
    incentiveRepo.save.mockResolvedValue({});
    userRepo.update.mockResolvedValue({});
    userRepo.find.mockResolvedValue([]);
  });

  // ── CAPA 1: Identidad real ─────────────────────────────────────────────────

  it('[Capa 1] rechaza si el ciudadano no tiene DNI verificado', async () => {
    const citizen = makeCitizen({ dni: undefined });
    await expect(service.create(makeDto(), citizen, '127.0.0.1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(vehicleRepo.findOne).not.toHaveBeenCalled();
  });

  it('[Capa 1] rechaza si el ciudadano está BLOQUEADO', async () => {
    const citizen = makeCitizen();
    userRepo.findOneOrFail.mockResolvedValue(
      makeCitizen({ status: UserStatus.BLOQUEADO }),
    );
    await expect(service.create(makeDto(), citizen, '127.0.0.1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  // ── CAPA 3: Límite y reputación ────────────────────────────────────────────

  it('[Capa 3] rechaza si se alcanzó el límite de 3 reportes/día', async () => {
    userRepo.findOneOrFail.mockResolvedValue(makeCitizen({ reports_today: 3 }));
    await expect(service.create(makeDto(), makeCitizen(), '127.0.0.1')).rejects.toThrow(
      HttpException,
    );
  });

  it('[Capa 3] rechaza si la reputación es menor a 30', async () => {
    userRepo.findOneOrFail.mockResolvedValue(makeCitizen({ reputation_score: 25 }));
    await expect(service.create(makeDto(), makeCitizen(), '127.0.0.1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  // ── CAPA 2: Contexto válido ────────────────────────────────────────────────

  it('[Capa 2] rechaza si el QR no corresponde a ningún vehículo', async () => {
    vehicleRepo.findOne.mockResolvedValue(null);
    await expect(service.create(makeDto(), makeCitizen(), '127.0.0.1')).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('[Capa 2] rechaza si el QR tiene HMAC inválido (falsificado)', async () => {
    vehicleRepo.findOne.mockResolvedValue({
      ...mockVehicle,
      qr_hmac: 'invalid_hmac_0000000000000000000000000000000000000000000000000000000000000000',
    });
    await expect(service.create(makeDto(), makeCitizen(), '127.0.0.1')).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('[Capa 2] rechaza si el viaje no está EN_CURSO', async () => {
    tripRepo.findOne.mockResolvedValue(null); // status filter returns nothing
    await expect(service.create(makeDto(), makeCitizen(), '127.0.0.1')).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  // ── CAPA 4: Verificación cruzada ──────────────────────────────────────────

  it('[Capa 4] marca VALIDO automáticamente cuando hay 2+ reportes similares', async () => {
    mockQb.getCount.mockResolvedValue(2); // corroborated

    const result = await service.create(makeDto(), makeCitizen(), '127.0.0.1');

    expect(result.status).toBe(ReportStatus.VALIDO);
    expect(result.validation_score).toBe(85); // 50 + 20(rep>80) + 15(similar) = 85
  });

  it('[Capa 4] marca EN_REVISION cuando el reporte es aislado', async () => {
    mockQb.getCount.mockResolvedValue(0); // no corroboration

    const result = await service.create(makeDto(), makeCitizen(), '127.0.0.1');

    expect(result.status).toBe(ReportStatus.EN_REVISION);
    expect(result.validation_score).toBe(70); // 50 + 20(rep>80) = 70
  });

  // ── CAPA 5: Post-procesamiento ─────────────────────────────────────────────

  it('[Capa 5] otorga 10 puntos al ciudadano al crear el reporte', async () => {
    const citizen = makeCitizen({ total_points: 0, reports_today: 0 });
    userRepo.findOneOrFail.mockResolvedValue(citizen);

    await service.create(makeDto(), citizen, '127.0.0.1');

    expect(mockQb.execute).toHaveBeenCalled();
    expect(incentiveRepo.save).toHaveBeenCalled();
  });

  it('[Capa 5] envía alerta a la municipalidad cuando is_same_driver=false', async () => {
    const fiscal: Partial<User> = { id: 'fiscal-uuid', role: UserRole.FISCAL };
    userRepo.find.mockResolvedValue([fiscal]);
    notifRepo.create.mockImplementation((d) => d);
    notifRepo.save.mockResolvedValue({});

    await service.create(
      makeDto({ is_same_driver: false }),
      makeCitizen(),
      '127.0.0.1',
    );

    expect(notifRepo.save).toHaveBeenCalled();
  });

  // ── validate() ────────────────────────────────────────────────────────────

  it('[validate] baja reputación y bloquea al ciudadano si cae bajo 30', async () => {
    const citizen = makeCitizen({ reputation_score: 32 });
    const report = {
      id:         'report-uuid',
      citizen_id: citizen.id,
      status:     ReportStatus.EN_REVISION,
      trip:       { municipality_id: 'mun-uuid' },
    } as unknown as Report;

    reportRepo.findOne.mockResolvedValue(report);
    userRepo.findOneOrFail.mockResolvedValue(citizen);
    reportRepo.save.mockImplementation((r) => Promise.resolve(r));
    auditRepo.create.mockImplementation((d) => d);
    auditRepo.save.mockResolvedValue({});

    const fiscal = { id: 'fiscal-uuid', role: UserRole.FISCAL, municipality_id: 'mun-uuid' } as User;
    await service.validate('report-uuid', { status: ReportStatus.INVALIDO }, fiscal);

    expect(userRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status:           UserStatus.BLOQUEADO,
        reputation_score: 22, // 32 - 10
      }),
    );
  });
});
