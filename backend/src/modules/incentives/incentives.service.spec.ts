import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { IncentivesService, ACTION_POINTS } from './incentives.service';
import {
  IncentivePoint, IncentiveActionType,
  User, UserRole, UserStatus,
} from '../../entities';

// ─── Mock factory ─────────────────────────────────────────────────────────────
const mockRepo = () => ({
  create:             jest.fn(),
  save:               jest.fn(),
  find:               jest.fn(),
  findOne:            jest.fn(),
  count:              jest.fn(),
  createQueryBuilder: jest.fn(),
});

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id:              'citizen-uuid',
    name:            'María López',
    email:           'maria@test.com',
    role:            UserRole.CIUDADANO,
    municipality_id: 'mun-uuid',
    status:          UserStatus.ACTIVO,
    total_points:    0,
    reports_today:   0,
    reputation_score: 80,
    ...overrides,
  } as User;
}

// ─── Test suite ───────────────────────────────────────────────────────────────
describe('IncentivesService', () => {
  let service:   IncentivesService;
  let pointRepo: ReturnType<typeof mockRepo>;
  let userRepo:  ReturnType<typeof mockRepo>;
  let mockQb:    any;

  beforeEach(async () => {
    pointRepo = mockRepo();
    userRepo  = mockRepo();

    mockQb = {
      select:         jest.fn().mockReturnThis(),
      addSelect:      jest.fn().mockReturnThis(),
      where:          jest.fn().mockReturnThis(),
      andWhere:       jest.fn().mockReturnThis(),
      orderBy:        jest.fn().mockReturnThis(),
      groupBy:        jest.fn().mockReturnThis(),
      limit:          jest.fn().mockReturnThis(),
      skip:           jest.fn().mockReturnThis(),
      take:           jest.fn().mockReturnThis(),
      update:         jest.fn().mockReturnThis(),
      set:            jest.fn().mockReturnThis(),
      setParameter:   jest.fn().mockReturnThis(),
      execute:        jest.fn().mockResolvedValue({ affected: 5 }),
      getMany:        jest.fn().mockResolvedValue([]),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getRawMany:     jest.fn().mockResolvedValue([]),
      getRawOne:      jest.fn().mockResolvedValue(null),
    };

    pointRepo.createQueryBuilder.mockReturnValue(mockQb);
    userRepo.createQueryBuilder.mockReturnValue(mockQb);

    pointRepo.create.mockImplementation((d: any) => ({ id: 'p-uuid', ...d }));
    pointRepo.save.mockImplementation((p: any) => Promise.resolve({ ...p, created_at: new Date() }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncentivesService,
        { provide: getRepositoryToken(IncentivePoint), useValue: pointRepo },
        { provide: getRepositoryToken(User),           useValue: userRepo },
      ],
    }).compile();

    service = module.get<IncentivesService>(IncentivesService);
  });

  // ── grantPoints ─────────────────────────────────────────────────────────────

  it('[grantPoints] REPORTE_VALIDO guarda +10 puntos y actualiza total_points', async () => {
    const record = await service.grantPoints('citizen-uuid', IncentiveActionType.REPORTE_VALIDO);

    expect(pointRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        citizen_id:  'citizen-uuid',
        points:      10,
        action_type: IncentiveActionType.REPORTE_VALIDO,
      }),
    );
    expect(mockQb.execute).toHaveBeenCalled(); // update total_points
    expect(record.points).toBe(10);
  });

  it('[grantPoints] REPORTE_CON_SANCION guarda +50 puntos', async () => {
    const record = await service.grantPoints(
      'citizen-uuid',
      IncentiveActionType.REPORTE_CON_SANCION,
      'report-uuid',
    );

    expect(pointRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        points:      50,
        action_type: IncentiveActionType.REPORTE_CON_SANCION,
        report_id:   'report-uuid',
      }),
    );
  });

  it('[grantPoints] VALIDACION_CORRECTA guarda +2 puntos', async () => {
    const record = await service.grantPoints(
      'citizen-uuid',
      IncentiveActionType.VALIDACION_CORRECTA,
    );

    expect(pointRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ points: 2, action_type: IncentiveActionType.VALIDACION_CORRECTA }),
    );
  });

  it('[grantPoints] acepta puntos personalizados (BONUS)', async () => {
    await service.grantPoints('citizen-uuid', IncentiveActionType.BONUS, undefined, 100);

    expect(pointRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ points: 100, action_type: IncentiveActionType.BONUS }),
    );
  });

  // ── getHistory ───────────────────────────────────────────────────────────────

  it('[getHistory] retorna historial paginado con descripción localizada', async () => {
    const mockPoints: Partial<IncentivePoint>[] = [
      { id: '1', points: 10, action_type: IncentiveActionType.REPORTE_VALIDO, report_id: 'r-1', created_at: new Date() },
      { id: '2', points: 2,  action_type: IncentiveActionType.VALIDACION_CORRECTA, report_id: null, created_at: new Date() },
    ];
    mockQb.getManyAndCount.mockResolvedValue([mockPoints, 2]);

    const result = await service.getHistory('citizen-uuid', 1, 20);

    expect(result.total).toBe(2);
    expect(result.data[0].description).toBe('Reporte validado');
    expect(result.data[1].description).toBe('Confirmación de conductor correcto');
  });

  // ── getRanking ───────────────────────────────────────────────────────────────

  it('[getRanking] retorna lista ordenada con posición y valid_reports', async () => {
    const mockUsers = [
      makeUser({ id: 'u1', name: 'Ana', total_points: 200 }),
      makeUser({ id: 'u2', name: 'Bob', total_points: 150 }),
    ];
    mockQb.getMany.mockResolvedValue(mockUsers);
    mockQb.getRawMany.mockResolvedValue([
      { citizen_id: 'u1', cnt: '5' },
      { citizen_id: 'u2', cnt: '3' },
    ]);

    const result = await service.getRanking('mun-uuid');

    expect(result).toHaveLength(2);
    expect(result[0].position).toBe(1);
    expect(result[0].name).toBe('Ana');
    expect(result[0].valid_reports).toBe(5);
    expect(result[1].position).toBe(2);
  });

  // ── resetDailyCounters ───────────────────────────────────────────────────────

  it('[resetDailyCounters] actualiza todos los ciudadanos y retorna el número afectado', async () => {
    mockQb.execute.mockResolvedValue({ affected: 42 });

    const updated = await service.resetDailyCounters();

    expect(updated).toBe(42);
    expect(mockQb.set).toHaveBeenCalledWith({ reports_today: 0 });
  });

  // ── ACTION_POINTS constante ───────────────────────────────────────────────────

  it('[ACTION_POINTS] tiene los valores correctos por acción', () => {
    expect(ACTION_POINTS[IncentiveActionType.REPORTE_VALIDO]).toBe(10);
    expect(ACTION_POINTS[IncentiveActionType.REPORTE_CON_SANCION]).toBe(50);
    expect(ACTION_POINTS[IncentiveActionType.VALIDACION_CORRECTA]).toBe(2);
  });
});
