import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';

import { SanctionEngineService } from './sanction-engine.service';
import {
  Sanction, AppealStatus,
  Appeal, AppealDecisionStatus,
  Driver, DriverStatus,
  User, UserRole, UserStatus,
  Report, ReportStatus,
  Trip, TripStatus,
  FatigueLog, FatigueLogResult,
  AuditLog,
  Notification, NotificationChannel, NotificationStatus,
  Municipality,
} from '../../entities';
import { CreateAppealDto } from './dto/create-appeal.dto';
import { ResolveAppealDto } from './dto/resolve-appeal.dto';
import { SanctionQueryDto } from './dto/sanction-query.dto';

// ─── Mock repository factory ──────────────────────────────────────────────────
const mockRepo = () => ({
  create:             jest.fn(),
  save:               jest.fn(),
  find:               jest.fn(),
  findOne:            jest.fn(),
  findOneOrFail:      jest.fn(),
  count:              jest.fn(),
  createQueryBuilder: jest.fn(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeFiscal(overrides: Partial<User> = {}): User {
  return {
    id:              'fiscal-uuid',
    role:            UserRole.FISCAL,
    municipality_id: 'mun-uuid',
    status:          UserStatus.ACTIVO,
    ...overrides,
  } as User;
}

function makeDriver(overrides: Partial<Driver> = {}): Driver {
  return {
    id:               'driver-uuid',
    name:             'Pedro Quispe',
    dni:              '87654321',
    status:           DriverStatus.APTO,
    reputation_score: 80,
    company: {
      municipality_id: 'mun-uuid',
      municipality: {
        id:          'mun-uuid',
        name:        'Lima',
        config_json: {},
      } as Municipality,
    },
    ...overrides,
  } as unknown as Driver;
}

function makeSanction(overrides: Partial<Sanction> = {}): Sanction {
  return {
    id:              'sanction-uuid',
    driver_id:       'driver-uuid',
    level:           1,
    appeal_status:   AppealStatus.SIN_APELACION,
    municipality_id: 'mun-uuid',
    appeal_deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1_000), // 3 days future
    driver:          { name: 'Pedro Quispe' } as Driver,
    ...overrides,
  } as unknown as Sanction;
}

// ─── Test suite ───────────────────────────────────────────────────────────────
describe('SanctionEngineService', () => {
  let service: SanctionEngineService;

  let sanctionRepo:    ReturnType<typeof mockRepo>;
  let appealRepo:      ReturnType<typeof mockRepo>;
  let driverRepo:      ReturnType<typeof mockRepo>;
  let userRepo:        ReturnType<typeof mockRepo>;
  let reportRepo:      ReturnType<typeof mockRepo>;
  let tripRepo:        ReturnType<typeof mockRepo>;
  let fatigueLogRepo:  ReturnType<typeof mockRepo>;
  let auditRepo:       ReturnType<typeof mockRepo>;
  let notifRepo:       ReturnType<typeof mockRepo>;
  let municipalityRepo: ReturnType<typeof mockRepo>;

  // Shared QueryBuilder mock
  let mockQb: any;

  beforeEach(async () => {
    sanctionRepo    = mockRepo();
    appealRepo      = mockRepo();
    driverRepo      = mockRepo();
    userRepo        = mockRepo();
    reportRepo      = mockRepo();
    tripRepo        = mockRepo();
    fatigueLogRepo  = mockRepo();
    auditRepo       = mockRepo();
    notifRepo       = mockRepo();
    municipalityRepo = mockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SanctionEngineService,
        { provide: getRepositoryToken(Sanction),     useValue: sanctionRepo },
        { provide: getRepositoryToken(Appeal),       useValue: appealRepo },
        { provide: getRepositoryToken(Driver),       useValue: driverRepo },
        { provide: getRepositoryToken(User),         useValue: userRepo },
        { provide: getRepositoryToken(Report),       useValue: reportRepo },
        { provide: getRepositoryToken(Trip),         useValue: tripRepo },
        { provide: getRepositoryToken(FatigueLog),   useValue: fatigueLogRepo },
        { provide: getRepositoryToken(AuditLog),     useValue: auditRepo },
        { provide: getRepositoryToken(Notification), useValue: notifRepo },
        { provide: getRepositoryToken(Municipality), useValue: municipalityRepo },
      ],
    }).compile();

    service = module.get<SanctionEngineService>(SanctionEngineService);

    // Default QueryBuilder stub
    mockQb = {
      select:         jest.fn().mockReturnThis(),
      where:          jest.fn().mockReturnThis(),
      andWhere:       jest.fn().mockReturnThis(),
      innerJoin:      jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy:        jest.fn().mockReturnThis(),
      skip:           jest.fn().mockReturnThis(),
      take:           jest.fn().mockReturnThis(),
      getCount:       jest.fn().mockResolvedValue(0),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getRawMany:     jest.fn().mockResolvedValue([]),
    };

    reportRepo.createQueryBuilder.mockReturnValue(mockQb);
    tripRepo.createQueryBuilder.mockReturnValue(mockQb);
    fatigueLogRepo.count.mockResolvedValue(0);

    sanctionRepo.create.mockImplementation((d: any) => ({ id: 'sanction-uuid', ...d }));
    sanctionRepo.save.mockImplementation((s: any) => Promise.resolve(s));
    appealRepo.create.mockImplementation((d: any) => ({ id: 'appeal-uuid', ...d }));
    appealRepo.save.mockImplementation((a: any) => Promise.resolve(a));
    driverRepo.save.mockImplementation((d: any) => Promise.resolve(d));
    auditRepo.create.mockImplementation((d: any) => d);
    auditRepo.save.mockResolvedValue({});
    userRepo.find.mockResolvedValue([]);
    notifRepo.create.mockImplementation((d: any) => d);
    notifRepo.save.mockResolvedValue([]);
  });

  // ── evaluateDriver ──────────────────────────────────────────────────────────

  it('[evaluateDriver] lanza NotFoundException si el conductor no existe', async () => {
    driverRepo.findOne.mockResolvedValue(null);
    await expect(service.evaluateDriver('no-existe')).rejects.toThrow(NotFoundException);
  });

  it('[evaluateDriver] retorna null si no hay incidencias suficientes para nivel 1', async () => {
    driverRepo.findOne.mockResolvedValue(makeDriver());
    sanctionRepo.findOne.mockResolvedValue(null); // no active level 3
    // 0 incidents (all counters at 0)

    const result = await service.evaluateDriver('driver-uuid');
    expect(result).toBeNull();
    expect(sanctionRepo.save).not.toHaveBeenCalled();
  });

  it('[evaluateDriver] crea sanción nivel 1 con 1 incidencia menor', async () => {
    driverRepo.findOne.mockResolvedValue(makeDriver());
    sanctionRepo.findOne.mockResolvedValue(null); // no active L3, no same-level

    // 1 minor from reports QueryBuilder
    mockQb.getCount.mockResolvedValue(1);

    const sanction = await service.evaluateDriver('driver-uuid');

    expect(sanction).toBeTruthy();
    expect(sanctionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ level: 1, appeal_status: AppealStatus.SIN_APELACION }),
    );
  });

  it('[evaluateDriver] escala a nivel 3 con 6+ incidencias menores', async () => {
    driverRepo.findOne.mockResolvedValue(makeDriver());
    sanctionRepo.findOne.mockResolvedValue(null);

    // 6 reports + 0 auto-trips = 6 minor
    mockQb.getCount
      .mockResolvedValueOnce(6)  // VALIDO reports count
      .mockResolvedValueOnce(0); // CERRADO_AUTO trips count

    await service.evaluateDriver('driver-uuid');

    expect(sanctionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ level: 3 }),
    );
    // Driver should be set to NO_APTO
    expect(driverRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: DriverStatus.NO_APTO }),
    );
  });

  it('[evaluateDriver] no duplica sanción si el nivel ya está activo (idempotencia)', async () => {
    driverRepo.findOne.mockResolvedValue(makeDriver());

    // First findOne (active level 3) returns null, second (same-level check) returns active
    sanctionRepo.findOne
      .mockResolvedValueOnce(null)                   // no active level 3
      .mockResolvedValueOnce(makeSanction({ level: 1 })); // level 1 already active

    mockQb.getCount.mockResolvedValue(1); // 1 minor → level 1

    const result = await service.evaluateDriver('driver-uuid');
    expect(result).toBeNull();
    expect(sanctionRepo.save).not.toHaveBeenCalled();
  });

  it('[evaluateDriver] escala a nivel 4 cuando hay nivel 3 activo y nuevas incidencias', async () => {
    driverRepo.findOne.mockResolvedValue(makeDriver());

    // First findOne: has active level 3
    sanctionRepo.findOne
      .mockResolvedValueOnce(makeSanction({ level: 3 })) // active level 3
      .mockResolvedValueOnce(null);                       // no same-level active (level 4)

    mockQb.getCount.mockResolvedValue(1); // at least 1 new incident

    await service.evaluateDriver('driver-uuid');

    expect(sanctionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ level: 4 }),
    );
    // Audit log for legal escalation
    expect(auditRepo.save).toHaveBeenCalled();
  });

  // ── createAppeal ─────────────────────────────────────────────────────────────

  it('[createAppeal] lanza NotFoundException si la sanción no existe', async () => {
    sanctionRepo.findOne.mockResolvedValue(null);
    const dto: CreateAppealDto = { description: 'Apelación de prueba con mínimo 20 chars', evidence_urls: [] };
    await expect(service.createAppeal('no-existe', dto, makeFiscal())).rejects.toThrow(NotFoundException);
  });

  it('[createAppeal] lanza ForbiddenException si la municipalidad no coincide', async () => {
    sanctionRepo.findOne.mockResolvedValue(makeSanction({ municipality_id: 'otra-mun' }));
    const dto: CreateAppealDto = { description: 'Apelación de prueba con mínimo 20 chars' };
    await expect(
      service.createAppeal('sanction-uuid', dto, makeFiscal({ municipality_id: 'mun-uuid' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('[createAppeal] lanza ConflictException si ya hay una apelación activa', async () => {
    sanctionRepo.findOne.mockResolvedValue(
      makeSanction({ appeal_status: AppealStatus.EN_APELACION }),
    );
    const dto: CreateAppealDto = { description: 'Apelación de prueba con mínimo 20 chars' };
    await expect(
      service.createAppeal('sanction-uuid', dto, makeFiscal()),
    ).rejects.toThrow(ConflictException);
  });

  it('[createAppeal] lanza BadRequestException si el plazo venció', async () => {
    sanctionRepo.findOne.mockResolvedValue(
      makeSanction({ appeal_deadline: new Date(Date.now() - 1_000) }), // past
    );
    const dto: CreateAppealDto = { description: 'Apelación de prueba con mínimo 20 chars' };
    await expect(
      service.createAppeal('sanction-uuid', dto, makeFiscal()),
    ).rejects.toThrow(BadRequestException);
  });

  it('[createAppeal] crea apelación y cambia appeal_status a EN_APELACION', async () => {
    const sanction = makeSanction();
    sanctionRepo.findOne.mockResolvedValue(sanction);

    const dto: CreateAppealDto = { description: 'Apelación de prueba con mínimo 20 chars' };
    const appeal = await service.createAppeal('sanction-uuid', dto, makeFiscal());

    expect(appeal).toBeTruthy();
    expect(sanctionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ appeal_status: AppealStatus.EN_APELACION }),
    );
  });

  // ── resolveAppeal ─────────────────────────────────────────────────────────────

  it('[resolveAppeal] lanza BadRequestException si la sanción no está EN_APELACION', async () => {
    sanctionRepo.findOne.mockResolvedValue(makeSanction({ appeal_status: AppealStatus.SIN_APELACION }));
    const dto: ResolveAppealDto = { status: AppealDecisionStatus.ACEPTADA, reason: 'Válido' };
    await expect(
      service.resolveAppeal('sanction-uuid', dto, makeFiscal()),
    ).rejects.toThrow(BadRequestException);
  });

  it('[resolveAppeal] ACEPTADA restaura reputación y estado del conductor', async () => {
    const driver = makeDriver({ reputation_score: 50, status: DriverStatus.NO_APTO });
    const sanction = makeSanction({ level: 3, appeal_status: AppealStatus.EN_APELACION, driver });
    sanctionRepo.findOne.mockResolvedValue(sanction);

    const pendingAppeal = {
      id: 'appeal-uuid',
      sanction_id: 'sanction-uuid',
      status: AppealDecisionStatus.PENDIENTE,
      submitted_at: new Date(),
    };
    appealRepo.findOne.mockResolvedValue(pendingAppeal);

    // No other active L3 sanctions
    sanctionRepo.findOne
      .mockResolvedValueOnce(sanction) // first call (load sanction)
      .mockResolvedValueOnce(null);    // check for other active L3 sanctions

    const dto: ResolveAppealDto = { status: AppealDecisionStatus.ACEPTADA, reason: 'Apelación válida' };
    await service.resolveAppeal('sanction-uuid', dto, makeFiscal());

    expect(driverRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status:           DriverStatus.APTO,
        reputation_score: 80, // 50 + REP_PENALTY[3]=30
      }),
    );
  });

  it('[resolveAppeal] RECHAZADA mantiene el estado del conductor intacto', async () => {
    const driver = makeDriver({ status: DriverStatus.NO_APTO, reputation_score: 50 });
    const sanction = makeSanction({ level: 2, appeal_status: AppealStatus.EN_APELACION, driver });
    sanctionRepo.findOne.mockResolvedValue(sanction);

    appealRepo.findOne.mockResolvedValue({
      id: 'appeal-uuid',
      status: AppealDecisionStatus.PENDIENTE,
      submitted_at: new Date(),
    });

    const dto: ResolveAppealDto = { status: AppealDecisionStatus.RECHAZADA, reason: 'Sin fundamento' };
    await service.resolveAppeal('sanction-uuid', dto, makeFiscal());

    expect(driverRepo.save).not.toHaveBeenCalled(); // driver unchanged
    expect(sanctionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ appeal_status: AppealStatus.APELACION_RECHAZADA }),
    );
  });

  // ── getStats ─────────────────────────────────────────────────────────────────

  it('[getStats] retorna conteos paralelos correctamente', async () => {
    const qb = {
      where:    jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn()
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(2)  // today
        .mockResolvedValueOnce(5)  // level1
        .mockResolvedValueOnce(3)  // level2
        .mockResolvedValueOnce(2)  // level3
        .mockResolvedValueOnce(0)  // level4
        .mockResolvedValueOnce(1), // pending_appeals
    };
    sanctionRepo.createQueryBuilder.mockReturnValue(qb);

    const stats = await service.getStats('mun-uuid');

    expect(stats.total).toBe(10);
    expect(stats.today).toBe(2);
    expect(stats.by_level[1]).toBe(5);
    expect(stats.by_level[3]).toBe(2);
    expect(stats.pending_appeals).toBe(1);
  });
});
