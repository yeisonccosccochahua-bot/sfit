import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';

import { RoutesService } from './routes.service';
import { Route, RouteType, RouteStatus } from '../../entities/route.entity';
import { Trip } from '../../entities/trip.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { User, UserRole, UserStatus } from '../../entities/user.entity';
import { CreateRouteDto } from './dto/create-route.dto';
import { RouteQueryDto } from './dto/route-query.dto';

// ─── Mock factories ───────────────────────────────────────────────────────────
const mockRepo = () => ({
  create:             jest.fn(),
  save:               jest.fn(),
  findOne:            jest.fn(),
  find:               jest.fn(),
  count:              jest.fn(),
  remove:             jest.fn(),
  createQueryBuilder: jest.fn(),
});

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id:              'user-uuid',
    email:           'admin@municipio.gob.pe',
    role:            UserRole.ADMIN_MUNICIPAL,
    municipality_id: 'mun-uuid',
    status:          UserStatus.ACTIVO,
    ...overrides,
  } as User;
}

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
    authorized_by_id:           'user-uuid',
    status:                     RouteStatus.ACTIVA,
    created_at:                 new Date(),
    updated_at:                 new Date(),
    ...overrides,
  } as Route;
}

// ─── Test suite ───────────────────────────────────────────────────────────────
describe('RoutesService', () => {
  let service:    RoutesService;
  let routeRepo:  ReturnType<typeof mockRepo>;
  let tripRepo:   ReturnType<typeof mockRepo>;
  let auditRepo:  ReturnType<typeof mockRepo>;
  let mockQb:     any;

  beforeEach(async () => {
    routeRepo = mockRepo();
    tripRepo  = mockRepo();
    auditRepo = mockRepo();

    mockQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where:             jest.fn().mockReturnThis(),
      andWhere:          jest.fn().mockReturnThis(),
      orderBy:           jest.fn().mockReturnThis(),
      skip:              jest.fn().mockReturnThis(),
      take:              jest.fn().mockReturnThis(),
      getManyAndCount:   jest.fn().mockResolvedValue([[], 0]),
    };
    routeRepo.createQueryBuilder.mockReturnValue(mockQb);
    auditRepo.create.mockReturnValue({});
    auditRepo.save.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoutesService,
        { provide: getRepositoryToken(Route),    useValue: routeRepo },
        { provide: getRepositoryToken(Trip),     useValue: tripRepo },
        { provide: getRepositoryToken(AuditLog), useValue: auditRepo },
      ],
    }).compile();

    service = module.get<RoutesService>(RoutesService);
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('retorna paginación vacía cuando no hay rutas', async () => {
      const query: RouteQueryDto = { page: 1, limit: 20 } as RouteQueryDto;
      const result = await service.findAll(query, 'mun-uuid');
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.page).toBe(1);
    });

    it('aplica filtro de municipalidad en el where principal', async () => {
      const query: RouteQueryDto = { page: 1, limit: 20 } as RouteQueryDto;
      await service.findAll(query, 'mun-uuid');
      expect(mockQb.where).toHaveBeenCalledWith(
        'r.municipality_id = :municipalityId',
        { municipalityId: 'mun-uuid' },
      );
    });

    it('aplica andWhere para búsqueda libre con Brackets cuando se pasa search', async () => {
      const query: RouteQueryDto = { page: 1, limit: 20, search: 'Arequipa' } as RouteQueryDto;
      await service.findAll(query, 'mun-uuid');
      expect(mockQb.andWhere).toHaveBeenCalled();
    });

    it('calcula lastPage correctamente', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 45]);
      const query: RouteQueryDto = { page: 1, limit: 20 } as RouteQueryDto;
      const result = await service.findAll(query, 'mun-uuid');
      expect(result.lastPage).toBe(3); // ceil(45/20) = 3
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('lanza NotFoundException si la ruta no existe', async () => {
      routeRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('no-uuid', 'mun-uuid')).rejects.toThrow(NotFoundException);
    });

    it('retorna la ruta si existe en la municipalidad', async () => {
      const route = makeRoute();
      routeRepo.findOne.mockResolvedValue(route);
      const result = await service.findOne('route-uuid', 'mun-uuid');
      expect(result.id).toBe('route-uuid');
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('lanza ForbiddenException si el usuario intenta crear en otra municipalidad', async () => {
      const user = makeUser({ municipality_id: 'mun-uuid' });
      const dto: CreateRouteDto = {
        origin: 'Cusco', destination: 'Lima',
        estimated_duration_minutes: 600,
        type: RouteType.PREDEFINIDA,
        municipality_id: 'otra-mun-uuid',
      } as CreateRouteDto;
      await expect(service.create(dto, user)).rejects.toThrow(ForbiddenException);
    });

    it('crea ruta con status ACTIVA y registra auditoría', async () => {
      const user = makeUser();
      const dto: CreateRouteDto = {
        origin: 'Cotabambas', destination: 'Challhuahuacho',
        estimated_duration_minutes: 120,
        type: RouteType.PREDEFINIDA,
      } as CreateRouteDto;
      const route = makeRoute({ origin: dto.origin, destination: dto.destination, status: RouteStatus.ACTIVA });
      routeRepo.create.mockReturnValue(route);
      routeRepo.save.mockResolvedValue(route);

      const result = await service.create(dto, user);
      expect(result.status).toBe(RouteStatus.ACTIVA);
      expect(auditRepo.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'CREATE' }));
    });

    it('asigna municipality_id del JWT cuando no viene en el DTO', async () => {
      const user = makeUser({ municipality_id: 'mun-uuid' });
      const dto: CreateRouteDto = {
        origin: 'Origen', destination: 'Destino',
        estimated_duration_minutes: 60,
        type: RouteType.ESPECIAL,
      } as CreateRouteDto;
      const route = makeRoute();
      routeRepo.create.mockReturnValue(route);
      routeRepo.save.mockResolvedValue(route);

      await service.create(dto, user);
      expect(routeRepo.create).toHaveBeenCalledWith(expect.objectContaining({ municipality_id: 'mun-uuid' }));
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('actualiza solo los campos presentes en el DTO', async () => {
      const route = makeRoute();
      routeRepo.findOne.mockResolvedValue(route);
      routeRepo.save.mockImplementation((r: any) => Promise.resolve(r));

      const result = await service.update('route-uuid', { min_drivers: 1 }, makeUser());
      expect(result.min_drivers).toBe(1);
      expect(auditRepo.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'UPDATE' }));
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('lanza ConflictException si la ruta tiene viajes asociados', async () => {
      routeRepo.findOne.mockResolvedValue(makeRoute());
      tripRepo.count.mockResolvedValue(3);
      await expect(service.remove('route-uuid', makeUser())).rejects.toThrow(ConflictException);
    });

    it('elimina la ruta si no tiene viajes y registra auditoría', async () => {
      const route = makeRoute();
      routeRepo.findOne.mockResolvedValue(route);
      tripRepo.count.mockResolvedValue(0);
      routeRepo.remove.mockResolvedValue(route);

      const result = await service.remove('route-uuid', makeUser());
      expect(result.message).toContain('eliminada');
      expect(auditRepo.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'DELETE' }));
    });
  });
});
