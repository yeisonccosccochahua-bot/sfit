import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';

import { FatigueEngineService } from './fatigue-engine.service';
import { Driver, DriverStatus } from '../../entities/driver.entity';
import { Trip, TripStatus } from '../../entities/trip.entity';
import { Route } from '../../entities/route.entity';
import { FatigueLog, FatigueLogResult } from '../../entities/fatigue-log.entity';
import { Notification } from '../../entities/notification.entity';
import { AuditLog } from '../../entities/audit-log.entity';

// ────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────
const now = new Date();

/** Crea un Trip completado con duración especificada en horas */
function makeCompletedTrip(startHoursAgo: number, durationHours: number): Partial<Trip> {
  const start = new Date(now.getTime() - startHoursAgo * 3_600_000);
  const end = new Date(start.getTime() + durationHours * 3_600_000);
  return { id: `trip-${startHoursAgo}`, status: TripStatus.FINALIZADO, start_time: start, end_time: end };
}

/** Crea un Trip activo que inició hace N horas */
function makeActiveTrip(startHoursAgo: number): Partial<Trip> {
  const start = new Date(now.getTime() - startHoursAgo * 3_600_000);
  return { id: `trip-active`, status: TripStatus.EN_CURSO, start_time: start, end_time: null };
}

function buildDriver(overrides: Partial<Driver> = {}): Driver {
  return {
    id: 'driver-1',
    name: 'Test Driver',
    status: DriverStatus.APTO,
    company_id: 'company-1',
    total_hours_driven_24h: 0,
    ...overrides,
  } as Driver;
}

function buildRoute(durationMin: number): Route {
  return { id: 'route-1', estimated_duration_minutes: durationMin } as Route;
}

// ────────────────────────────────────────────────────────
// Mock factory — Query Builder
// ────────────────────────────────────────────────────────
function buildQB(trips: Partial<Trip>[]): Partial<SelectQueryBuilder<Trip>> {
  return {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(trips),
    getOne: jest.fn().mockResolvedValue(trips.find((t) => t.status === TripStatus.EN_CURSO) ?? null),
  };
}

// ────────────────────────────────────────────────────────
// Mock repositories
// ────────────────────────────────────────────────────────
const mockDriverRepo = { findOne: jest.fn(), save: jest.fn(), find: jest.fn(), count: jest.fn() };
const mockTripRepo = { createQueryBuilder: jest.fn(), find: jest.fn(), count: jest.fn() };
const mockRouteRepo = { findOne: jest.fn() };
const mockFatigueLogRepo = { create: jest.fn(), save: jest.fn(), findAndCount: jest.fn() };
const mockNotificationRepo = { create: jest.fn(), save: jest.fn() };
const mockAuditRepo = { create: jest.fn(), save: jest.fn() };

// ────────────────────────────────────────────────────────
// Suite
// ────────────────────────────────────────────────────────
describe('FatigueEngineService', () => {
  let service: FatigueEngineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FatigueEngineService,
        { provide: getRepositoryToken(Driver), useValue: mockDriverRepo },
        { provide: getRepositoryToken(Trip), useValue: mockTripRepo },
        { provide: getRepositoryToken(Route), useValue: mockRouteRepo },
        { provide: getRepositoryToken(FatigueLog), useValue: mockFatigueLogRepo },
        { provide: getRepositoryToken(Notification), useValue: mockNotificationRepo },
        { provide: getRepositoryToken(AuditLog), useValue: mockAuditRepo },
      ],
    }).compile();

    service = module.get<FatigueEngineService>(FatigueEngineService);
    jest.clearAllMocks();

    // Defaults para mocks secundarios
    mockFatigueLogRepo.create.mockReturnValue({ id: 'log-1' });
    mockFatigueLogRepo.save.mockResolvedValue({ id: 'log-1' });
    mockDriverRepo.save.mockResolvedValue({});
    mockNotificationRepo.create.mockReturnValue({});
    mockNotificationRepo.save.mockResolvedValue({});
  });

  // ──────────────────────────────────────────────
  // Test 1: Conductor con 0h conducidas → APTO
  // ──────────────────────────────────────────────
  it('T1: Conductor con 0h conducidas → APTO', async () => {
    mockDriverRepo.findOne.mockResolvedValue(buildDriver());
    mockTripRepo.createQueryBuilder.mockReturnValue(buildQB([]));

    const result = await service.evaluateDriver('driver-1');

    expect(result.result).toBe(FatigueLogResult.APTO);
    expect(result.hours_driven_24h).toBe(0);
    expect(result.last_rest_hours).toBe(24);
  });

  // ──────────────────────────────────────────────
  // Test 2: Conductor con 7h conducidas → RIESGO
  // ──────────────────────────────────────────────
  it('T2: Conductor con 7h conducidas → RIESGO', async () => {
    mockDriverRepo.findOne.mockResolvedValue(buildDriver());
    // Viaje completado hace 9h, duró 7h (rest = 2h → NO_APTO por rest < 6h)
    // Para que solo RIESGO por horas, necesitamos rest >= 8h y 6 <= hours < 8
    // Trip: empezó hace 10h, duró 7h → terminó hace 3h → rest = 3h → eso sería NO_APTO
    // Usemos: trip completado hace 19h, duró 7h → terminó hace 12h → rest = 12h, hours = 7
    const trip = makeCompletedTrip(19, 7);
    mockTripRepo.createQueryBuilder.mockReturnValue(buildQB([trip]));

    const result = await service.evaluateDriver('driver-1');

    expect(result.result).toBe(FatigueLogResult.RIESGO);
    expect(result.hours_driven_24h).toBeCloseTo(7, 0);
    expect(result.last_rest_hours).toBeGreaterThanOrEqual(8);
  });

  // ──────────────────────────────────────────────
  // Test 3: Conductor con 9h conducidas → NO_APTO
  // ──────────────────────────────────────────────
  it('T3: Conductor con 9h conducidas → NO_APTO', async () => {
    mockDriverRepo.findOne.mockResolvedValue(buildDriver());
    // Trip: empezó hace 20h, duró 9h → terminó hace 11h → rest = 11h (suficiente), hours = 9
    const trip = makeCompletedTrip(20, 9);
    mockTripRepo.createQueryBuilder.mockReturnValue(buildQB([trip]));

    const result = await service.evaluateDriver('driver-1');

    expect(result.result).toBe(FatigueLogResult.NO_APTO);
    expect(result.hours_driven_24h).toBeCloseTo(9, 0);
  });

  // ──────────────────────────────────────────────
  // Test 4: Conductor con 5h de descanso → NO_APTO
  // ──────────────────────────────────────────────
  it('T4: Conductor con descanso de 5h después de jornada completa → NO_APTO', async () => {
    mockDriverRepo.findOne.mockResolvedValue(buildDriver());
    // Último viaje terminó hace 5h (rest = 5h < 6h → NO_APTO)
    const trip = makeCompletedTrip(13, 8); // duró 8h, terminó hace 5h
    mockTripRepo.createQueryBuilder.mockReturnValue(buildQB([trip]));

    const result = await service.evaluateDriver('driver-1');

    expect(result.result).toBe(FatigueLogResult.NO_APTO);
    expect(result.last_rest_hours).toBeCloseTo(5, 0);
  });

  // ──────────────────────────────────────────────
  // Test 5: Conductor con 10h de descanso → APTO
  // ──────────────────────────────────────────────
  it('T5: Conductor con descanso de 10h → APTO', async () => {
    mockDriverRepo.findOne.mockResolvedValue(buildDriver());
    // Viaje: duró 4h, terminó hace 10h → rest = 10h >= 8h, hours = 4h < 6h → APTO
    const trip = makeCompletedTrip(14, 4);
    mockTripRepo.createQueryBuilder.mockReturnValue(buildQB([trip]));

    const result = await service.evaluateDriver('driver-1');

    expect(result.result).toBe(FatigueLogResult.APTO);
    expect(result.last_rest_hours).toBeCloseTo(10, 0);
    expect(result.hours_driven_24h).toBeCloseTo(4, 0);
  });

  // ──────────────────────────────────────────────
  // Test 6: Ruta larga: conductor con 9h → puede operar (límite 10h)
  // ──────────────────────────────────────────────
  it('T6: Ruta larga (>480min): conductor con 9h puede operar (canOperate=true)', async () => {
    mockDriverRepo.findOne.mockResolvedValue(buildDriver());
    // 9h conducidas, rest = 10h (suficiente), long route limit = 10h → no supera máx
    const trip = makeCompletedTrip(20, 9); // terminó hace 11h
    mockTripRepo.createQueryBuilder.mockReturnValue(buildQB([trip]));
    mockRouteRepo.findOne.mockResolvedValue(buildRoute(540)); // ruta larga: 540min > 480min

    const result = await service.canDriverOperate('driver-1', 'route-1');

    expect(result.canOperate).toBe(true);
    expect(result.route_is_long).toBe(true);
    expect(result.details.max_hours_limit).toBe(10);
    expect(result.evaluation.hours_driven_24h).toBeCloseTo(9, 0);
  });

  // ──────────────────────────────────────────────
  // Test 7: Conducción continua 4h+ → genera alerta (sin bloqueo)
  // ──────────────────────────────────────────────
  it('T7: Conductor con 4h+ de conducción continua → alerta sin bloqueo', async () => {
    mockDriverRepo.findOne.mockResolvedValue(buildDriver());
    // Viaje activo que empezó hace 4.5h
    const activeTrip = makeActiveTrip(4.5);
    mockTripRepo.createQueryBuilder.mockReturnValue(buildQB([activeTrip]));
    // El mock de createQueryBuilder.getOne debe devolver el trip activo
    const qbMock: any = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([activeTrip]),
      getOne: jest.fn().mockResolvedValue(activeTrip),
    };
    mockTripRepo.createQueryBuilder.mockReturnValue(qbMock);

    const result = await service.checkContinuousDriving('driver-1');

    expect(result.continuous_hours).toBeGreaterThanOrEqual(4);
    expect(result.requires_action).toBe(true);
    // Sin bloqueo: el status del driver no fue cambiado a NO_APTO
    expect(mockDriverRepo.save).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────
  // Test 8: Conductor sin viajes previos → APTO
  // ──────────────────────────────────────────────
  it('T8: Conductor sin viajes previos en 24h → APTO', async () => {
    mockDriverRepo.findOne.mockResolvedValue(buildDriver());
    mockTripRepo.createQueryBuilder.mockReturnValue(buildQB([]));

    const result = await service.evaluateDriver('driver-1');

    expect(result.result).toBe(FatigueLogResult.APTO);
    expect(result.details.trips_analyzed).toBe(0);
    expect(result.last_rest_hours).toBe(24);
  });

  // ──────────────────────────────────────────────
  // Test 9: Conductor con viaje activo de 2h → RIESGO por descanso borderline
  // ──────────────────────────────────────────────
  it('T9: Conductor con viaje activo + 7h descanso previo → RIESGO por descanso [6,8h)', async () => {
    mockDriverRepo.findOne.mockResolvedValue(buildDriver());
    // Completó un viaje que terminó hace 7h; actualmente tiene viaje activo (1h continua)
    const completed = makeCompletedTrip(10, 3); // terminó hace 7h
    const active = makeActiveTrip(1);
    const qbMock: any = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([completed, active]),
      getOne: jest.fn().mockResolvedValue(active),
    };
    mockTripRepo.createQueryBuilder.mockReturnValue(qbMock);

    const result = await service.evaluateDriver('driver-1');

    // rest = gap entre fin del completado (hace 7h) y inicio del activo (hace 1h) = 6h → RIESGO
    expect(result.result).toBe(FatigueLogResult.RIESGO);
  });

  // ──────────────────────────────────────────────
  // Test 10: Driver no encontrado → NotFoundException
  // ──────────────────────────────────────────────
  it('T10: Conductor no encontrado → lanza NotFoundException', async () => {
    mockDriverRepo.findOne.mockResolvedValue(null);

    await expect(service.evaluateDriver('nonexistent-uuid')).rejects.toThrow(NotFoundException);
  });

  // ──────────────────────────────────────────────
  // Test 11: Ruta normal: conductor con 9h → NO_APTO (no es ruta larga)
  // ──────────────────────────────────────────────
  it('T11: Ruta normal (<480min): conductor con 9h → canOperate=false (NO_APTO)', async () => {
    mockDriverRepo.findOne.mockResolvedValue(buildDriver());
    const trip = makeCompletedTrip(20, 9); // 9h conducidas, terminó hace 11h
    mockTripRepo.createQueryBuilder.mockReturnValue(buildQB([trip]));
    mockRouteRepo.findOne.mockResolvedValue(buildRoute(300)); // ruta normal: 300min < 480min

    const result = await service.canDriverOperate('driver-1', 'route-1');

    expect(result.canOperate).toBe(false);
    expect(result.route_is_long).toBe(false);
    expect(result.details.max_hours_limit).toBe(8);
  });
});
