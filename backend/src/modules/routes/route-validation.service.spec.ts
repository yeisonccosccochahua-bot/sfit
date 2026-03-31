import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';

import { RouteValidationService } from './route-validation.service';
import { Route, RouteType, RouteStatus } from '../../entities/route.entity';
import { Driver, DriverStatus } from '../../entities/driver.entity';
import { Trip, TripStatus } from '../../entities/trip.entity';

// ─── Mock factories ───────────────────────────────────────────────────────────
const mockRepo = () => ({
  findOne: jest.fn(),
  find:    jest.fn(),
  count:   jest.fn(),
});

function makeRoute(overrides: Partial<Route> = {}): Route {
  return {
    id:                         'route-uuid',
    origin:                     'Arequipa',
    destination:                'Challhuahuacho',
    stops:                      [],
    estimated_duration_minutes: 660,
    type:                       RouteType.PREDEFINIDA,
    min_drivers:                2,
    rest_between_legs_hours:    null,
    allows_roundtrip:           false,
    municipality_id:            'mun-uuid',
    authorized_by_id:           null,
    status:                     RouteStatus.ACTIVA,
    created_at:                 new Date(),
    updated_at:                 new Date(),
    ...overrides,
  } as Route;
}

function makeDriver(overrides: Partial<Driver> = {}): Driver {
  return {
    id:     'drv-uuid',
    name:   'Juan Pérez',
    dni:    '12345678',
    status: DriverStatus.APTO,
    ...overrides,
  } as Driver;
}

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id:            'trip-uuid',
    route_id:      'route-uuid',
    status:        TripStatus.FINALIZADO,
    end_time:      new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 horas atrás
    is_return_leg: false,
    ...overrides,
  } as Trip;
}

// ─── Test suite ───────────────────────────────────────────────────────────────
describe('RouteValidationService', () => {
  let service:    RouteValidationService;
  let routeRepo:  ReturnType<typeof mockRepo>;
  let driverRepo: ReturnType<typeof mockRepo>;
  let tripRepo:   ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    routeRepo  = mockRepo();
    driverRepo = mockRepo();
    tripRepo   = mockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RouteValidationService,
        { provide: getRepositoryToken(Route),  useValue: routeRepo },
        { provide: getRepositoryToken(Driver), useValue: driverRepo },
        { provide: getRepositoryToken(Trip),   useValue: tripRepo },
      ],
    }).compile();

    service = module.get<RouteValidationService>(RouteValidationService);
  });

  // ── getRouteRules ─────────────────────────────────────────────────────────

  describe('getRouteRules', () => {
    it('lanza NotFoundException si la ruta no existe', async () => {
      routeRepo.findOne.mockResolvedValue(null);
      await expect(service.getRouteRules('no-uuid')).rejects.toThrow(NotFoundException);
    });

    it('[Arequipa→Challhuahuacho] retorna min_drivers=2, roundtrip=false, rest=null', async () => {
      routeRepo.findOne.mockResolvedValue(makeRoute());
      const rules = await service.getRouteRules('route-uuid');
      expect(rules.min_drivers).toBe(2);
      expect(rules.allows_roundtrip).toBe(false);
      expect(rules.rest_between_legs_hours).toBeNull();
    });

    it('[Cusco→Tambobamba] retorna min_drivers=1, roundtrip=true, rest=4', async () => {
      routeRepo.findOne.mockResolvedValue(
        makeRoute({ origin: 'Cusco', destination: 'Tambobamba', min_drivers: 1, rest_between_legs_hours: 4, allows_roundtrip: true }),
      );
      const rules = await service.getRouteRules('route-uuid');
      expect(rules.min_drivers).toBe(1);
      expect(rules.allows_roundtrip).toBe(true);
      expect(rules.rest_between_legs_hours).toBe(4);
    });
  });

  // ── validateDriverRequirements ────────────────────────────────────────────

  describe('validateDriverRequirements', () => {
    beforeEach(() => {
      // Ruta Arequipa→Challhuahuacho requiere min_drivers=2
      routeRepo.findOne.mockResolvedValue(makeRoute({ min_drivers: 2 }));
    });

    it('[Test A1] sin conductores → valid=false', async () => {
      const result = await service.validateDriverRequirements('route-uuid', []);
      expect(result.valid).toBe(false);
      expect(result.requiredDrivers).toBe(2);
    });

    it('[Test A2] solo 1 conductor para ruta que exige 2 → valid=false, reason incluye "2 conductor(es)"', async () => {
      const result = await service.validateDriverRequirements('route-uuid', ['drv-1']);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('2 conductor(es)');
    });

    it('[Test A3] 2 conductores APTOS → valid=true', async () => {
      const drv1 = makeDriver({ id: 'drv-1', status: DriverStatus.APTO });
      const drv2 = makeDriver({ id: 'drv-2', status: DriverStatus.APTO });
      driverRepo.find.mockResolvedValue([drv1, drv2]);

      const result = await service.validateDriverRequirements('route-uuid', ['drv-1', 'drv-2']);
      expect(result.valid).toBe(true);
      expect(result.aptDriversFound).toBe(2);
    });

    it('[Test A4] 2 conductores pero uno NO_APTO → valid=false, reason menciona al conductor', async () => {
      const drv1 = makeDriver({ id: 'drv-1', name: 'Juan', status: DriverStatus.APTO });
      const drv2 = makeDriver({ id: 'drv-2', name: 'Pedro', status: DriverStatus.NO_APTO });
      driverRepo.find.mockResolvedValue([drv1, drv2]);

      const result = await service.validateDriverRequirements('route-uuid', ['drv-1', 'drv-2']);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Pedro');
      expect(result.reason).toContain('APTO');
    });

    it('[Test A5] conductor no encontrado en DB → valid=false, reason menciona el ID faltante', async () => {
      const drv1 = makeDriver({ id: 'drv-1' });
      driverRepo.find.mockResolvedValue([drv1]); // solo 1 encontrado de los 2 enviados

      const result = await service.validateDriverRequirements('route-uuid', ['drv-1', 'drv-MISSING']);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('drv-MISSING');
    });
  });

  // ── validateReturnLeg ─────────────────────────────────────────────────────

  describe('validateReturnLeg', () => {
    it('[Test B1] ruta NO permite roundtrip → allowed=false', async () => {
      routeRepo.findOne.mockResolvedValue(makeRoute({ allows_roundtrip: false }));
      const result = await service.validateReturnLeg('route-uuid', 'trip-uuid');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('retorno');
    });

    it('[Test B2] viaje padre no encontrado → allowed=false', async () => {
      routeRepo.findOne.mockResolvedValue(
        makeRoute({ allows_roundtrip: true, rest_between_legs_hours: 4 }),
      );
      tripRepo.findOne.mockResolvedValue(null);
      const result = await service.validateReturnLeg('route-uuid', 'no-uuid');
      expect(result.allowed).toBe(false);
    });

    it('[Test B3] viaje padre ya es retorno → no se puede encadenar', async () => {
      routeRepo.findOne.mockResolvedValue(makeRoute({ allows_roundtrip: true }));
      tripRepo.findOne.mockResolvedValue(makeTrip({ is_return_leg: true }));
      const result = await service.validateReturnLeg('route-uuid', 'trip-uuid');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('retorno');
    });

    it('[Test B4] viaje de ida no está FINALIZADO → allowed=false', async () => {
      routeRepo.findOne.mockResolvedValue(
        makeRoute({ allows_roundtrip: true, rest_between_legs_hours: 4 }),
      );
      tripRepo.findOne.mockResolvedValue(makeTrip({ status: TripStatus.EN_CURSO }));
      const result = await service.validateReturnLeg('route-uuid', 'trip-uuid');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('FINALIZADO');
    });

    it('[Test B5] ida finalizada hace 2h, descanso requerido=4h → allowed=false, waitHours~2', async () => {
      routeRepo.findOne.mockResolvedValue(
        makeRoute({ allows_roundtrip: true, rest_between_legs_hours: 4 }),
      );
      tripRepo.findOne.mockResolvedValue(
        makeTrip({ end_time: new Date(Date.now() - 2 * 60 * 60 * 1000) }),
      );
      const result = await service.validateReturnLeg('route-uuid', 'trip-uuid');
      expect(result.allowed).toBe(false);
      expect(result.waitHours).toBeGreaterThan(0);
      expect(result.waitHours).toBeLessThanOrEqual(2.1);
    });

    it('[Test B6] [Cusco→Tambobamba] ida finalizada hace 5h, descanso=4h → allowed=true', async () => {
      routeRepo.findOne.mockResolvedValue(
        makeRoute({
          origin: 'Cusco', destination: 'Tambobamba',
          allows_roundtrip: true, rest_between_legs_hours: 4,
        }),
      );
      tripRepo.findOne.mockResolvedValue(
        makeTrip({ end_time: new Date(Date.now() - 5 * 60 * 60 * 1000) }),
      );
      const result = await service.validateReturnLeg('route-uuid', 'trip-uuid');
      expect(result.allowed).toBe(true);
    });

    it('[Test B7] viaje de ida pertenece a otra ruta → allowed=false', async () => {
      routeRepo.findOne.mockResolvedValue(makeRoute({ allows_roundtrip: true }));
      tripRepo.findOne.mockResolvedValue(makeTrip({ route_id: 'otra-ruta-uuid' }));
      const result = await service.validateReturnLeg('route-uuid', 'trip-uuid');
      expect(result.allowed).toBe(false);
    });
  });
});
