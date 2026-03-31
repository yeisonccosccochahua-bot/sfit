import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, Brackets } from 'typeorm';

import { Route, RouteStatus } from '../../entities/route.entity';
import { Trip } from '../../entities/trip.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { User, UserRole } from '../../entities/user.entity';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { RouteQueryDto } from './dto/route-query.dto';

export interface PaginatedRoutes {
  data: Route[];
  total: number;
  page: number;
  lastPage: number;
}

@Injectable()
export class RoutesService {
  constructor(
    @InjectRepository(Route)
    private routeRepo: Repository<Route>,
    @InjectRepository(Trip)
    private tripRepo: Repository<Trip>,
    @InjectRepository(AuditLog)
    private auditRepo: Repository<AuditLog>,
  ) {}

  // ──────────────────────────────────────────────
  // LIST
  // ──────────────────────────────────────────────
  async findAll(query: RouteQueryDto, municipalityId: string): Promise<PaginatedRoutes> {
    const { page, limit, type, status, origin, destination, search } = query;
    const skip = (page - 1) * limit;

    const qb = this.routeRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.municipality', 'municipality')
      .leftJoinAndSelect('r.authorized_by', 'authorized_by')
      .where('r.municipality_id = :municipalityId', { municipalityId })
      .orderBy('r.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    if (type)   qb.andWhere('r.type = :type', { type });
    if (status) qb.andWhere('r.status = :status', { status });

    // Specific field filters
    if (origin)      qb.andWhere('r.origin ILIKE :origin', { origin: `%${origin}%` });
    if (destination) qb.andWhere('r.destination ILIKE :destination', { destination: `%${destination}%` });

    // Free-text search across origin OR destination
    if (search) {
      qb.andWhere(
        new Brackets((sub) =>
          sub
            .where('r.origin ILIKE :s', { s: `%${search}%` })
            .orWhere('r.destination ILIKE :s', { s: `%${search}%` }),
        ),
      );
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, lastPage: Math.ceil(total / limit) };
  }

  // ──────────────────────────────────────────────
  // FIND ONE
  // ──────────────────────────────────────────────
  async findOne(id: string, municipalityId: string): Promise<Route> {
    const route = await this.routeRepo.findOne({
      where: { id, municipality_id: municipalityId },
      relations: ['municipality', 'authorized_by'],
    });
    if (!route) throw new NotFoundException(`Ruta ${id} no encontrada`);
    return route;
  }

  // ──────────────────────────────────────────────
  // CREATE
  // ──────────────────────────────────────────────
  async create(dto: CreateRouteDto, user: User): Promise<Route> {
    const municipalityId = dto.municipality_id ?? user.municipality_id;

    // Ambos roles solo pueden crear en su propia municipalidad
    if (user.municipality_id !== municipalityId) {
      throw new ForbiddenException('Solo puedes crear rutas en tu propia municipalidad');
    }

    const route = this.routeRepo.create({
      origin: dto.origin,
      destination: dto.destination,
      stops: dto.stops ?? [],
      estimated_duration_minutes: dto.estimated_duration_minutes,
      type: dto.type,
      min_drivers: dto.min_drivers ?? 1,
      rest_between_legs_hours: dto.rest_between_legs_hours ?? null,
      allows_roundtrip: dto.allows_roundtrip ?? false,
      municipality_id: municipalityId,
      authorized_by_id: user.id,
      status: RouteStatus.ACTIVA,
    });

    const saved = await this.routeRepo.save(route);
    await this.audit(user, 'CREATE', saved.id, { origin: saved.origin, destination: saved.destination });
    return saved;
  }

  // ──────────────────────────────────────────────
  // UPDATE
  // ──────────────────────────────────────────────
  async update(id: string, dto: UpdateRouteDto, user: User): Promise<Route> {
    const route = await this.findOne(id, user.municipality_id);

    const changes: Record<string, any> = {};
    const fields: (keyof UpdateRouteDto)[] = [
      'origin', 'destination', 'stops', 'estimated_duration_minutes',
      'type', 'min_drivers', 'rest_between_legs_hours', 'allows_roundtrip', 'status',
    ];

    for (const field of fields) {
      if (dto[field] !== undefined) {
        (route as any)[field] = dto[field];
        changes[field] = dto[field];
      }
    }

    const saved = await this.routeRepo.save(route);
    await this.audit(user, 'UPDATE', id, changes);
    return saved;
  }

  // ──────────────────────────────────────────────
  // DELETE
  // ──────────────────────────────────────────────
  async remove(id: string, user: User): Promise<{ message: string }> {
    const route = await this.findOne(id, user.municipality_id);

    const tripCount = await this.tripRepo.count({ where: { route_id: id } });
    if (tripCount > 0) {
      throw new ConflictException(
        `No se puede eliminar la ruta porque tiene ${tripCount} viaje(s) asociado(s). Desactívela en su lugar.`,
      );
    }

    await this.routeRepo.remove(route);
    await this.audit(user, 'DELETE', id, { origin: route.origin, destination: route.destination });
    return { message: `Ruta ${route.origin} → ${route.destination} eliminada` };
  }

  // ──────────────────────────────────────────────
  // AUDIT HELPER
  // ──────────────────────────────────────────────
  private async audit(
    user: User,
    action: string,
    entityId: string,
    details: Record<string, any>,
  ): Promise<void> {
    const log = this.auditRepo.create({
      user_id: user.id,
      action,
      entity_type: 'Route',
      entity_id: entityId,
      details_json: details,
    });
    await this.auditRepo.save(log).catch(() => undefined);
  }
}
