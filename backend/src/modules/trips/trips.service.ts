import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';

import { Trip, TripStatus } from '../../entities/trip.entity';
import { TripDriver, TripDriverRole } from '../../entities/trip-driver.entity';
import { Vehicle, VehicleStatus } from '../../entities/vehicle.entity';
import { Driver, DriverStatus } from '../../entities/driver.entity';
import { Route } from '../../entities/route.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { Notification, NotificationChannel, NotificationStatus } from '../../entities/notification.entity';
import { User, UserRole } from '../../entities/user.entity';
import { FatigueLogResult } from '../../entities/fatigue-log.entity';

import { FatigueEngineService } from '../fatigue/fatigue-engine.service';
import { RouteValidationService } from '../routes/route-validation.service';

import { CreateTripDto } from './dto/create-trip.dto';
import { TripQueryDto } from './dto/trip-query.dto';
import { ReplaceDriverDto } from './dto/replace-driver.dto';

export interface BlockedReason {
  type: 'FATIGUE' | 'MIN_DRIVERS' | 'RETURN_LEG' | 'VEHICLE' | 'DRIVER' | 'ROUTE';
  driver_id?: string;
  driver_name?: string;
  message: string;
  details?: Record<string, any>;
}

export interface PaginatedTrips {
  data: Trip[];
  total: number;
  page: number;
  lastPage: number;
}

@Injectable()
export class TripsService {
  private readonly logger = new Logger(TripsService.name);

  constructor(
    @InjectRepository(Trip)
    private tripRepo: Repository<Trip>,
    @InjectRepository(TripDriver)
    private tripDriverRepo: Repository<TripDriver>,
    @InjectRepository(Vehicle)
    private vehicleRepo: Repository<Vehicle>,
    @InjectRepository(Driver)
    private driverRepo: Repository<Driver>,
    @InjectRepository(Route)
    private routeRepo: Repository<Route>,
    @InjectRepository(AuditLog)
    private auditRepo: Repository<AuditLog>,
    @InjectRepository(Notification)
    private notifRepo: Repository<Notification>,
    private fatigueEngine: FatigueEngineService,
    private routeValidation: RouteValidationService,
  ) {}

  // ─────────────────────────────────────────────────
  // REGISTER TRIP (pre-salida)
  // ─────────────────────────────────────────────────
  async register(dto: CreateTripDto, user: User): Promise<Trip> {
    const blockedReasons: BlockedReason[] = [];

    // 1. Validar vehículo
    const vehicle = await this.vehicleRepo.findOne({
      where: { id: dto.vehicle_id },
      relations: ['company'],
    });
    if (!vehicle) {
      throw new NotFoundException(`Vehículo ${dto.vehicle_id} no encontrado`);
    }
    if (vehicle.status !== VehicleStatus.ACTIVO) {
      blockedReasons.push({
        type: 'VEHICLE',
        message: `Vehículo ${vehicle.plate} no está ACTIVO (estado: ${vehicle.status})`,
      });
    }
    if (vehicle.company.municipality_id !== user.municipality_id) {
      throw new ForbiddenException('El vehículo no pertenece a tu municipalidad');
    }

    // 2. Validar ruta
    const route = await this.routeRepo.findOne({ where: { id: dto.route_id } });
    if (!route) throw new NotFoundException(`Ruta ${dto.route_id} no encontrada`);
    if (route.municipality_id !== user.municipality_id) {
      throw new ForbiddenException('La ruta no pertenece a tu municipalidad');
    }

    // 3. Validar conductores pertenecen a la misma empresa que el vehículo
    const driverIds = dto.drivers.map((d) => d.driver_id);
    const drivers = await this.driverRepo.find({
      where: { id: In(driverIds) },
      select: ['id', 'name', 'status', 'company_id'],
    });
    if (drivers.length !== driverIds.length) {
      const found = drivers.map((d) => d.id);
      const missing = driverIds.filter((id) => !found.includes(id));
      throw new NotFoundException(`Conductor(es) no encontrado(s): ${missing.join(', ')}`);
    }
    for (const driver of drivers) {
      if (driver.company_id !== vehicle.company_id) {
        blockedReasons.push({
          type: 'DRIVER',
          driver_id: driver.id,
          driver_name: driver.name,
          message: `El conductor ${driver.name} no pertenece a la empresa del vehículo`,
        });
      }
    }

    // 4. Validar requisitos de conductores de la ruta
    const driverValidation = await this.routeValidation.validateDriverRequirements(
      dto.route_id,
      driverIds,
    );
    if (!driverValidation.valid) {
      blockedReasons.push({
        type: 'MIN_DRIVERS',
        message: driverValidation.reason,
        details: { required: driverValidation.requiredDrivers, found: driverValidation.aptDriversFound },
      });
    }

    // 5. Evaluar fatiga de cada conductor
    const fatigueResults: Record<string, FatigueLogResult> = {};
    for (const driver of drivers) {
      try {
        const eval_ = await this.fatigueEngine.evaluateDriver(driver.id);
        fatigueResults[driver.id] = eval_.result;
        if (eval_.result === FatigueLogResult.NO_APTO) {
          blockedReasons.push({
            type: 'FATIGUE',
            driver_id: driver.id,
            driver_name: driver.name,
            message: `Conductor ${driver.name} no apto por fatiga`,
            details: {
              hours_driven_24h: eval_.hours_driven_24h,
              last_rest_hours: eval_.last_rest_hours,
              status: eval_.result,
            },
          });
        }
      } catch (err) {
        blockedReasons.push({
          type: 'FATIGUE',
          driver_id: driver.id,
          driver_name: driver.name,
          message: `Error evaluando fatiga del conductor ${driver.name}: ${err.message}`,
        });
      }
    }

    // 6. Validar viaje de retorno
    if (dto.is_return_leg) {
      if (!dto.parent_trip_id) {
        throw new BadRequestException('parent_trip_id es requerido para viajes de retorno');
      }
      const returnValidation = await this.routeValidation.validateReturnLeg(
        dto.route_id,
        dto.parent_trip_id,
      );
      if (!returnValidation.allowed) {
        blockedReasons.push({
          type: 'RETURN_LEG',
          message: returnValidation.reason,
          details: { wait_hours: returnValidation.waitHours },
        });
      }
    }

    // 7. Si hay razones de bloqueo → 409
    if (blockedReasons.length > 0) {
      throw new HttpException(
        {
          statusCode: HttpStatus.CONFLICT,
          message: 'Viaje bloqueado: no se cumplen los requisitos previos',
          blocked: true,
          reasons: blockedReasons,
        },
        HttpStatus.CONFLICT,
      );
    }

    // 8. Crear Trip
    const startTime = dto.scheduled_start ? new Date(dto.scheduled_start) : new Date();
    const trip = this.tripRepo.create({
      vehicle_id: dto.vehicle_id,
      route_id: dto.route_id,
      start_time: startTime,
      status: TripStatus.REGISTRADO,
      is_return_leg: dto.is_return_leg ?? false,
      parent_trip_id: dto.parent_trip_id ?? null,
      municipality_id: user.municipality_id,
      registered_by_id: user.id,
      auto_closed: false,
    });
    const savedTrip = await this.tripRepo.save(trip);

    // 9. Crear TripDrivers
    const tripDrivers = dto.drivers.map((d) =>
      this.tripDriverRepo.create({
        trip_id: savedTrip.id,
        driver_id: d.driver_id,
        role: d.role,
        fatigue_check_result: fatigueResults[d.driver_id] as any,
      }),
    );
    await this.tripDriverRepo.save(tripDrivers);

    await this.audit(user, 'TRIP_REGISTER', savedTrip.id, {
      vehicle_plate: vehicle.plate,
      route: `${route.origin} → ${route.destination}`,
      drivers: dto.drivers.length,
      is_return_leg: dto.is_return_leg,
    });

    this.logger.log(`Viaje ${savedTrip.id} registrado por ${user.name}`);
    return this.findOne(savedTrip.id, user.municipality_id);
  }

  // ─────────────────────────────────────────────────
  // START TRIP
  // ─────────────────────────────────────────────────
  async start(id: string, user: User): Promise<Trip> {
    const trip = await this.findOne(id, user.municipality_id);

    if (trip.status !== TripStatus.REGISTRADO) {
      throw new ConflictException(`Solo se puede iniciar un viaje REGISTRADO (estado actual: ${trip.status})`);
    }

    // Re-evaluar fatiga (pudo cambiar desde el registro)
    const tripDrivers = await this.tripDriverRepo.find({ where: { trip_id: id } });
    const blockedReasons: BlockedReason[] = [];

    for (const td of tripDrivers) {
      const eval_ = await this.fatigueEngine.evaluateDriver(td.driver_id);
      td.fatigue_check_result = eval_.result as any;
      await this.tripDriverRepo.save(td);

      if (eval_.result === FatigueLogResult.NO_APTO) {
        const driver = await this.driverRepo.findOne({
          where: { id: td.driver_id },
          select: ['name'],
        });
        blockedReasons.push({
          type: 'FATIGUE',
          driver_id: td.driver_id,
          driver_name: driver?.name,
          message: `Conductor ${driver?.name} ya no está APTO al momento de iniciar`,
          details: { hours_driven_24h: eval_.hours_driven_24h, last_rest_hours: eval_.last_rest_hours },
        });
      }
    }

    if (blockedReasons.length > 0) {
      throw new HttpException(
        { statusCode: HttpStatus.CONFLICT, message: 'No se puede iniciar el viaje', blocked: true, reasons: blockedReasons },
        HttpStatus.CONFLICT,
      );
    }

    trip.start_time = new Date();
    trip.status = TripStatus.EN_CURSO;
    await this.tripRepo.save(trip);

    await this.audit(user, 'TRIP_START', id, { start_time: trip.start_time });
    return this.findOne(id, user.municipality_id);
  }

  // ─────────────────────────────────────────────────
  // END TRIP
  // ─────────────────────────────────────────────────
  async end(id: string, user: User): Promise<Trip> {
    const trip = await this.findOne(id, user.municipality_id);

    if (trip.status !== TripStatus.EN_CURSO) {
      throw new ConflictException(`Solo se puede finalizar un viaje EN_CURSO (estado actual: ${trip.status})`);
    }

    trip.end_time = new Date();
    trip.status = TripStatus.FINALIZADO;
    await this.tripRepo.save(trip);

    // Recalcular fatiga de los conductores
    const tripDrivers = await this.tripDriverRepo.find({ where: { trip_id: id } });
    for (const td of tripDrivers) {
      const eval_ = await this.fatigueEngine.evaluateDriver(td.driver_id);
      td.fatigue_check_result = eval_.result as any;
      await this.tripDriverRepo.save(td);
    }

    trip.fatigue_result = tripDrivers.some((td) => td.fatigue_check_result === 'NO_APTO' as any)
      ? 'NO_APTO' as any
      : tripDrivers.some((td) => td.fatigue_check_result === 'RIESGO' as any)
      ? 'RIESGO' as any
      : 'APTO' as any;
    await this.tripRepo.save(trip);

    await this.audit(user, 'TRIP_END', id, { end_time: trip.end_time });
    return this.findOne(id, user.municipality_id);
  }

  // ─────────────────────────────────────────────────
  // LIST
  // ─────────────────────────────────────────────────
  async findAll(query: TripQueryDto, municipalityId: string): Promise<PaginatedTrips> {
    const { page, limit, status, route_id, vehicle_id, driver_id, date_from, date_to } = query;

    const qb = this.tripRepo
      .createQueryBuilder('trip')
      .leftJoinAndSelect('trip.vehicle', 'vehicle')
      .leftJoinAndSelect('trip.route', 'route')
      .leftJoinAndSelect('trip.registered_by', 'registered_by')
      .where('trip.municipality_id = :municipalityId', { municipalityId })
      .orderBy('trip.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status) qb.andWhere('trip.status = :status', { status });
    if (route_id) qb.andWhere('trip.route_id = :route_id', { route_id });
    if (vehicle_id) qb.andWhere('trip.vehicle_id = :vehicle_id', { vehicle_id });
    if (date_from) qb.andWhere('trip.created_at >= :date_from', { date_from: new Date(date_from) });
    if (date_to) {
      const end = new Date(date_to);
      end.setHours(23, 59, 59);
      qb.andWhere('trip.created_at <= :date_to', { date_to: end });
    }
    if (driver_id) {
      qb.andWhere((sub) => {
        const sq = sub
          .subQuery()
          .select('td.trip_id')
          .from(TripDriver, 'td')
          .where('td.driver_id = :driver_id')
          .getQuery();
        return `trip.id IN ${sq}`;
      }).setParameter('driver_id', driver_id);
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, lastPage: Math.ceil(total / limit) };
  }

  // ─────────────────────────────────────────────────
  // FIND ONE
  // ─────────────────────────────────────────────────
  async findOne(id: string, municipalityId: string): Promise<Trip> {
    const trip = await this.tripRepo.findOne({
      where: { id, municipality_id: municipalityId },
      relations: ['vehicle', 'vehicle.company', 'route', 'registered_by', 'parent_trip'],
    });
    if (!trip) throw new NotFoundException(`Viaje ${id} no encontrado`);
    return trip;
  }

  // ─────────────────────────────────────────────────
  // ACTIVE TRIPS (dashboard municipal)
  // ─────────────────────────────────────────────────
  async findActive(municipalityId: string): Promise<Trip[]> {
    return this.tripRepo.find({
      where: { status: TripStatus.EN_CURSO, municipality_id: municipalityId },
      relations: ['vehicle', 'route'],
      order: { start_time: 'ASC' },
    });
  }

  // ─────────────────────────────────────────────────
  // ACTIVE TRIP BY VEHICLE (escaneo QR)
  // ─────────────────────────────────────────────────
  async findActiveByVehicle(vehicleId: string, municipalityId: string): Promise<Trip | null> {
    const trip = await this.tripRepo.findOne({
      where: {
        vehicle_id: vehicleId,
        status: In([TripStatus.REGISTRADO, TripStatus.EN_CURSO]),
        municipality_id: municipalityId,
      },
      relations: ['vehicle', 'route', 'registered_by'],
      order: { created_at: 'DESC' },
    });
    return trip ?? null;
  }

  // ─────────────────────────────────────────────────
  // GET TRIP DRIVERS
  // ─────────────────────────────────────────────────
  async getTripDrivers(tripId: string, municipalityId: string): Promise<TripDriver[]> {
    await this.findOne(tripId, municipalityId); // valida municipalidad
    return this.tripDriverRepo.find({
      where: { trip_id: tripId },
      relations: ['driver', 'driver.company'],
    });
  }

  // ─────────────────────────────────────────────────
  // REPLACE DRIVER
  // ─────────────────────────────────────────────────
  async replaceDriver(id: string, dto: ReplaceDriverDto, user: User): Promise<Trip> {
    const trip = await this.findOne(id, user.municipality_id);

    if (![TripStatus.REGISTRADO, TripStatus.EN_CURSO].includes(trip.status)) {
      throw new ConflictException(`No se puede reemplazar conductor en viaje con estado ${trip.status}`);
    }

    const oldTd = await this.tripDriverRepo.findOne({
      where: { trip_id: id, driver_id: dto.old_driver_id },
    });
    if (!oldTd) {
      throw new NotFoundException(`El conductor ${dto.old_driver_id} no está asignado a este viaje`);
    }

    // Validar nuevo conductor
    const newDriver = await this.driverRepo.findOne({
      where: { id: dto.new_driver_id },
      select: ['id', 'name', 'status', 'company_id'],
    });
    if (!newDriver) throw new NotFoundException(`Conductor ${dto.new_driver_id} no encontrado`);

    // Verificar que pertenece a la misma empresa
    const vehicle = await this.vehicleRepo.findOne({
      where: { id: trip.vehicle_id },
      select: ['company_id'],
    });
    if (newDriver.company_id !== vehicle.company_id) {
      throw new ForbiddenException('El nuevo conductor no pertenece a la empresa del vehículo');
    }

    // Evaluar fatiga del nuevo conductor
    const eval_ = await this.fatigueEngine.evaluateDriver(dto.new_driver_id);
    if (eval_.result === FatigueLogResult.NO_APTO) {
      throw new ConflictException(
        `El conductor ${newDriver.name} no está APTO por fatiga ` +
          `(${eval_.hours_driven_24h.toFixed(1)}h conducidas, ${eval_.last_rest_hours.toFixed(1)}h descanso)`,
      );
    }

    // Reemplazar
    await this.tripDriverRepo.remove(oldTd);
    const newTd = this.tripDriverRepo.create({
      trip_id: id,
      driver_id: dto.new_driver_id,
      role: dto.role,
      fatigue_check_result: eval_.result as any,
    });
    await this.tripDriverRepo.save(newTd);

    await this.audit(user, 'TRIP_REPLACE_DRIVER', id, {
      old_driver_id: dto.old_driver_id,
      new_driver_id: dto.new_driver_id,
      new_driver_name: newDriver.name,
      role: dto.role,
    });

    this.logger.log(`Conductor reemplazado en viaje ${id}: ${dto.old_driver_id} → ${newDriver.name}`);
    return this.findOne(id, user.municipality_id);
  }

  // ─────────────────────────────────────────────────
  // AUTO-CLOSE OVERDUE TRIPS (llamado desde cron)
  // ─────────────────────────────────────────────────
  async autoCloseOverdue(): Promise<{ closed: number; trip_ids: string[] }> {
    const overdueTrips = await this.tripRepo
      .createQueryBuilder('trip')
      .innerJoinAndSelect('trip.route', 'route')
      .where('trip.status = :status', { status: TripStatus.EN_CURSO })
      .andWhere(
        `trip.start_time + (route.estimated_duration_minutes * 1.5 || ' minutes')::interval < NOW()`,
      )
      .getMany();

    if (!overdueTrips.length) return { closed: 0, trip_ids: [] };

    const closedIds: string[] = [];
    for (const trip of overdueTrips) {
      trip.status = TripStatus.CERRADO_AUTO;
      trip.auto_closed = true;
      trip.end_time = new Date();
      await this.tripRepo.save(trip);

      // Recalcular fatiga de los conductores
      const tripDrivers = await this.tripDriverRepo.find({ where: { trip_id: trip.id } });
      for (const td of tripDrivers) {
        const eval_ = await this.fatigueEngine.evaluateDriver(td.driver_id).catch(() => null);
        if (eval_) {
          td.fatigue_check_result = eval_.result as any;
          await this.tripDriverRepo.save(td);
        }
      }

      // Auditoría
      const auditEntry = this.auditRepo.create({
        user_id: null,
        action: 'TRIP_AUTO_CLOSE',
        entity_type: 'Trip',
        entity_id: trip.id,
        details_json: {
          reason: 'Excedió 1.5× duración estimada de la ruta',
          estimated_minutes: (trip.route as any)?.estimated_duration_minutes,
          start_time: trip.start_time,
          end_time: trip.end_time,
        },
      });
      await this.auditRepo.save(auditEntry);
      closedIds.push(trip.id);
    }

    this.logger.warn(`[AUTO-CLOSE] ${closedIds.length} viaje(s) cerrados automáticamente`);
    return { closed: closedIds.length, trip_ids: closedIds };
  }

  // ─────────────────────────────────────────────────
  // AUDIT HELPER
  // ─────────────────────────────────────────────────
  private async audit(user: User, action: string, entityId: string, details: Record<string, any>) {
    const log = this.auditRepo.create({
      user_id: user.id,
      action,
      entity_type: 'Trip',
      entity_id: entityId,
      details_json: details,
    });
    await this.auditRepo.save(log).catch(() => undefined);
  }
}
