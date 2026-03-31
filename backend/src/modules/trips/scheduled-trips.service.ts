import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Cron } from '@nestjs/schedule';

import { ScheduledTrip, ScheduledTripStatus, ScheduledTripRecurrencia } from './entities/scheduled-trip.entity';
import { Trip, TripStatus } from '../../entities/trip.entity';
import { TripDriver, TripDriverRole } from '../../entities/trip-driver.entity';
import { Route } from '../../entities/route.entity';
import { Vehicle } from '../../entities/vehicle.entity';
import { User } from '../../entities/user.entity';
import { AuditLog } from '../../entities/audit-log.entity';

import { CreateScheduledTripDto } from './dto/create-scheduled-trip.dto';
import { CancelScheduledTripDto } from './dto/cancel-scheduled-trip.dto';
import { RescheduleDto } from './dto/reschedule.dto';
import { CheckConflictsDto } from './dto/check-conflicts.dto';

@Injectable()
export class ScheduledTripsService {
  constructor(
    @InjectRepository(ScheduledTrip) private repo: Repository<ScheduledTrip>,
    @InjectRepository(Trip)          private tripRepo: Repository<Trip>,
    @InjectRepository(TripDriver)    private tripDriverRepo: Repository<TripDriver>,
    @InjectRepository(Route)         private routeRepo: Repository<Route>,
    @InjectRepository(Vehicle)       private vehicleRepo: Repository<Vehicle>,
    @InjectRepository(AuditLog)      private auditRepo: Repository<AuditLog>,
  ) {}

  private addMinutesToTime(time: string, minutes: number): string {
    const [h, m] = time.split(':').map(Number);
    const total = h * 60 + m + minutes;
    const nh = Math.floor(total / 60) % 24;
    const nm = total % 60;
    return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
  }

  private generateDatesForRecurrencia(
    startDate: string,
    recurrencia: string,
    diasSemana: number[] | undefined,
    hasta: string | undefined,
  ): string[] {
    const start = new Date(startDate + 'T00:00:00');
    const end = hasta ? new Date(hasta + 'T00:00:00') : new Date(start);
    if (!hasta) return [startDate];

    // Max 28 days
    const maxEnd = new Date(start);
    maxEnd.setDate(maxEnd.getDate() + 27);
    const effectiveEnd = end < maxEnd ? end : maxEnd;

    const allowedDays: number[] =
      recurrencia === 'DIARIO_LUN_VIE' ? [1, 2, 3, 4, 5]
      : recurrencia === 'DIARIO_LUN_SAB' ? [1, 2, 3, 4, 5, 6]
      : recurrencia === 'PERSONALIZADO' ? (diasSemana ?? [])
      : [];

    const dates: string[] = [];
    const cur = new Date(start);
    while (cur <= effectiveEnd) {
      const dow = cur.getDay() === 0 ? 7 : cur.getDay(); // 1=Mon..7=Sun
      if (allowedDays.includes(dow)) {
        dates.push(cur.toISOString().split('T')[0]);
      }
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  }

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  private timesOverlap(
    start1: string, end1: string,
    start2: string, end2: string,
  ): boolean {
    const s1 = this.timeToMinutes(start1);
    const e1 = this.timeToMinutes(end1);
    const s2 = this.timeToMinutes(start2);
    const e2 = this.timeToMinutes(end2);
    return s1 < e2 && s2 < e1;
  }

  private roleToTripDriverRole(role: string): TripDriverRole {
    switch (role) {
      case 'SUPLENTE': return TripDriverRole.SUPLENTE;
      case 'COPILOTO': return TripDriverRole.COPILOTO;
      default:         return TripDriverRole.PRINCIPAL;
    }
  }

  async create(dto: CreateScheduledTripDto, user: User): Promise<ScheduledTrip | ScheduledTrip[]> {
    const route = await this.routeRepo.findOne({ where: { id: dto.route_id } });
    if (!route) throw new NotFoundException('Ruta no encontrada');

    if (dto.assigned_drivers.length < route.min_drivers) {
      throw new BadRequestException(
        `Esta ruta requiere mínimo ${route.min_drivers} conductor(es). Solo asignaste ${dto.assigned_drivers.length}.`,
      );
    }

    // Derive company_id from the vehicle if user doesn't have one set
    const vehicle = await this.vehicleRepo.findOne({ where: { id: dto.vehicle_id }, relations: ['company'] });
    if (!vehicle) throw new NotFoundException('Vehículo no encontrado');
    const companyId     = user.company_id ?? (vehicle.company as any)?.id ?? vehicle.company_id;
    const municipalityId = user.municipality_id ?? route.municipality_id;

    const durationMin = route.estimated_duration_minutes ?? 60;
    const horaLlegada = this.addMinutesToTime(dto.hora_salida, durationMin);

    const dates =
      dto.recurrencia === ScheduledTripRecurrencia.UNICO
        ? [dto.fecha_programada]
        : this.generateDatesForRecurrencia(
            dto.fecha_programada,
            dto.recurrencia,
            dto.dias_semana,
            dto.recurrencia_hasta,
          );

    const created: ScheduledTrip[] = [];
    let serieId: string | null = null;

    for (const fecha of dates) {
      const conflicts = await this.checkConflictsInternal(
        dto.vehicle_id,
        dto.assigned_drivers.map(d => d.driver_id),
        fecha,
        dto.hora_salida,
        durationMin,
        undefined,
        dto.route_id,
      );
      if (conflicts.has_conflicts) continue; // skip conflicting dates silently

      const st = this.repo.create({
        vehicle_id:             dto.vehicle_id,
        route_id:               dto.route_id,
        company_id:             companyId,
        municipality_id:        municipalityId,
        assigned_drivers:       dto.assigned_drivers,
        fecha_programada:       fecha,
        hora_salida:            dto.hora_salida,
        hora_llegada_estimada:  horaLlegada,
        recurrencia:            dto.recurrencia as ScheduledTripRecurrencia,
        serie_id:               null,
        dias_semana:            dto.dias_semana ?? null,
        recurrencia_hasta:      dto.recurrencia_hasta ?? null,
        estado:                 ScheduledTripStatus.PROGRAMADO,
        notas:                  dto.notas ?? null,
        created_by:             user.id,
        trip_id:                null,
        motivo_cancelacion:     null,
      });

      const saved = await this.repo.save(st);
      if (!serieId) serieId = saved.id;
      if (dto.recurrencia !== ScheduledTripRecurrencia.UNICO) {
        saved.serie_id = serieId;
        await this.repo.save(saved);
      }
      created.push(saved);
    }

    if (created.length === 0) {
      throw new BadRequestException(
        'No se pudo crear ningún viaje programado. Todos los horarios tienen conflictos.',
      );
    }

    return created.length === 1 && dto.recurrencia === ScheduledTripRecurrencia.UNICO
      ? created[0]
      : created;
  }

  async getWeekSchedule(
    user: User,
    startDate: string,
    endDate: string,
  ): Promise<Record<string, ScheduledTrip[]>> {
    const where: any = { fecha_programada: Between(startDate, endDate) };
    if (user.company_id) {
      where.company_id = user.company_id;
    } else if (user.municipality_id) {
      where.municipality_id = user.municipality_id;
    }

    const trips = await this.repo.find({
      where,
      relations: ['vehicle', 'route', 'creator'],
      order: { fecha_programada: 'ASC', hora_salida: 'ASC' },
    });

    const grouped: Record<string, ScheduledTrip[]> = {};
    for (const t of trips) {
      if (!grouped[t.fecha_programada]) grouped[t.fecha_programada] = [];
      grouped[t.fecha_programada].push(t);
    }
    return grouped;
  }

  async getDaySchedule(user: User, date: string): Promise<ScheduledTrip[]> {
    const where: any = { fecha_programada: date };
    if (user.company_id) where.company_id = user.company_id;
    else if (user.municipality_id) where.municipality_id = user.municipality_id;
    return this.repo.find({
      where,
      relations: ['vehicle', 'route', 'creator'],
      order: { hora_salida: 'ASC' },
    });
  }

  async findOne(id: string, user: User): Promise<ScheduledTrip> {
    const where: any = { id };
    if (user.company_id) where.company_id = user.company_id;
    else if (user.municipality_id) where.municipality_id = user.municipality_id;
    const st = await this.repo.findOne({
      where,
      relations: ['vehicle', 'route', 'creator', 'trip'],
    });
    if (!st) throw new NotFoundException('Viaje programado no encontrado');
    return st;
  }

  async confirm(id: string, user: User): Promise<ScheduledTrip> {
    const st = await this.findOne(id, user);
    if (st.estado !== ScheduledTripStatus.PROGRAMADO) {
      throw new BadRequestException('Solo se pueden confirmar viajes en estado PROGRAMADO');
    }
    st.estado = ScheduledTripStatus.CONFIRMADO;
    return this.repo.save(st);
  }

  async startTrip(
    id: string,
    user: User,
  ): Promise<{ scheduledTrip: ScheduledTrip; trip: Trip }> {
    const st = await this.findOne(id, user);
    if (
      ![ScheduledTripStatus.PROGRAMADO, ScheduledTripStatus.CONFIRMADO].includes(st.estado)
    ) {
      throw new BadRequestException(
        'El viaje debe estar PROGRAMADO o CONFIRMADO para iniciarse',
      );
    }

    // Create real Trip (Trip entity has no company_id column)
    const trip = await this.tripRepo.save(
      this.tripRepo.create({
        vehicle_id:       st.vehicle_id,
        route_id:         st.route_id,
        municipality_id:  st.municipality_id,
        status:           TripStatus.REGISTRADO,
        registered_by_id: user.id,
        start_time:       new Date(),
        is_return_leg:    false,
      }),
    );

    // Create TripDrivers
    for (const d of st.assigned_drivers) {
      await this.tripDriverRepo.save(
        this.tripDriverRepo.create({
          trip_id:   trip.id,
          driver_id: d.driver_id,
          role:      this.roleToTripDriverRole(d.role),
        }),
      );
    }

    st.estado  = ScheduledTripStatus.EN_CURSO;
    st.trip_id = trip.id;
    await this.repo.save(st);
    // Re-fetch to ensure trip_id and all relations are populated in response
    const updatedSt = await this.repo.findOne({
      where: { id: st.id },
      relations: ['vehicle', 'route'],
    });

    return { scheduledTrip: updatedSt, trip };
  }

  async cancel(
    id: string,
    dto: CancelScheduledTripDto,
    user: User,
  ): Promise<ScheduledTrip | { cancelled: number }> {
    const st = await this.findOne(id, user);

    if (dto.cancelar_serie && st.serie_id) {
      const result = await this.repo.update(
        {
          serie_id: st.serie_id,
          estado:   In([ScheduledTripStatus.PROGRAMADO, ScheduledTripStatus.CONFIRMADO]),
        },
        {
          estado:              ScheduledTripStatus.CANCELADO,
          motivo_cancelacion:  dto.motivo_cancelacion,
        },
      );
      return { cancelled: result.affected ?? 0 };
    }

    st.estado              = ScheduledTripStatus.CANCELADO;
    st.motivo_cancelacion  = dto.motivo_cancelacion;
    return this.repo.save(st);
  }

  async reschedule(id: string, dto: RescheduleDto, user: User): Promise<ScheduledTrip> {
    const st = await this.findOne(id, user);
    if (
      [
        ScheduledTripStatus.COMPLETADO,
        ScheduledTripStatus.EN_CURSO,
        ScheduledTripStatus.CANCELADO,
      ].includes(st.estado)
    ) {
      throw new BadRequestException('No se puede reprogramar un viaje en este estado');
    }

    if (dto.nueva_fecha)      st.fecha_programada = dto.nueva_fecha;
    if (dto.nueva_hora)       st.hora_salida      = dto.nueva_hora;
    if (dto.nuevo_vehicle_id) st.vehicle_id       = dto.nuevo_vehicle_id;
    if (dto.nuevos_drivers)   st.assigned_drivers = dto.nuevos_drivers as any;

    if (dto.nueva_hora) {
      const route = await this.routeRepo.findOne({ where: { id: st.route_id } });
      if (route) {
        st.hora_llegada_estimada = this.addMinutesToTime(
          st.hora_salida,
          route.estimated_duration_minutes ?? 60,
        );
      }
    }

    await this.auditRepo.save(
      this.auditRepo.create({
        user_id:      user.id,
        action:       'SCHEDULED_TRIP_RESCHEDULED',
        entity_type:  'ScheduledTrip',
        entity_id:    st.id,
        details_json: { nueva_fecha: dto.nueva_fecha, nueva_hora: dto.nueva_hora },
      }),
    );

    return this.repo.save(st);
  }

  async checkConflicts(dto: CheckConflictsDto): Promise<{
    has_conflicts: boolean;
    conflicts: { type: string; message: string }[];
  }> {
    return this.checkConflictsInternal(
      dto.vehicle_id,
      dto.driver_ids,
      dto.fecha,
      dto.hora_salida,
      dto.duracion_minutos,
      dto.exclude_id,
      dto.route_id,
    );
  }

  private trimTime(t: string): string {
    // Normalize "HH:MM:SS" → "HH:MM"
    return t ? t.slice(0, 5) : t;
  }

  private async checkConflictsInternal(
    vehicleId: string,
    driverIds: string[],
    fecha: string,
    horaSalida: string,
    duracionMin: number,
    excludeId?: string,
    routeId?: string,
  ): Promise<{ has_conflicts: boolean; conflicts: { type: string; message: string }[] }> {
    const conflicts: { type: string; message: string }[] = [];
    const horaFin = this.addMinutesToTime(horaSalida, duracionMin);

    const existing = await this.repo.find({
      where: {
        fecha_programada: fecha as any,
        estado: Not(In([ScheduledTripStatus.CANCELADO, ScheduledTripStatus.NO_REALIZADO])),
      },
      relations: ['route'],
    });

    const relevant = existing.filter(t => t.id !== excludeId);

    // Check rest_between_legs_hours: if the same vehicle uses a route with a rest requirement,
    // the new trip must start at least (route.rest_between_legs_hours) after any previous trip ends.
    if (routeId) {
      const route = await this.routeRepo.findOne({ where: { id: routeId } });
      const restMinutes = route?.rest_between_legs_hours ? route.rest_between_legs_hours * 60 : 0;
      if (restMinutes > 0) {
        for (const t of relevant) {
          if (t.vehicle_id !== vehicleId) continue;
          const tFin = this.trimTime(t.hora_llegada_estimada ?? this.addMinutesToTime(t.hora_salida, 60));
          const tFinMin = this.timeToMinutes(tFin);
          const salidaMin = this.timeToMinutes(horaSalida);
          const tSalidaMin = this.timeToMinutes(this.trimTime(t.hora_salida));
          const horaFinMin = this.timeToMinutes(horaFin);
          // New trip starts before rest period after previous ends
          if (salidaMin >= tFinMin && salidaMin < tFinMin + restMinutes) {
            conflicts.push({
              type:    'DESCANSO_INSUFICIENTE',
              message: `Requiere ${route!.rest_between_legs_hours}h de descanso entre viajes. El vehículo termina a ${tFin} y necesita hasta ${this.addMinutesToTime(tFin, restMinutes)}.`,
            });
          }
          // Or previous trip starts before rest period after new one ends
          if (tSalidaMin >= horaFinMin && tSalidaMin < horaFinMin + restMinutes) {
            conflicts.push({
              type:    'DESCANSO_INSUFICIENTE',
              message: `Requiere ${route!.rest_between_legs_hours}h de descanso entre viajes. El viaje terminaría a ${horaFin} y hay otro programado a las ${this.trimTime(t.hora_salida)}.`,
            });
          }
        }
      }
    }

    for (const t of relevant) {
      const tSalida = this.trimTime(t.hora_salida);
      const tFin = this.trimTime(t.hora_llegada_estimada ?? this.addMinutesToTime(t.hora_salida, 60));
      const overlaps = this.timesOverlap(horaSalida, horaFin, tSalida, tFin);
      if (!overlaps) continue;

      if (t.vehicle_id === vehicleId) {
        conflicts.push({
          type:    'VEHICULO_OCUPADO',
          message: `Vehículo tiene otro viaje de ${tSalida} a ${tFin}`,
        });
      }

      for (const dId of driverIds) {
        if (t.assigned_drivers.some(d => d.driver_id === dId)) {
          conflicts.push({
            type:    'CONDUCTOR_OCUPADO',
            message: `Un conductor tiene otro viaje de ${tSalida} a ${tFin}`,
          });
        }
      }
    }

    return { has_conflicts: conflicts.length > 0, conflicts };
  }

  @Cron('0 * * * *')
  async markMissedTrips(): Promise<void> {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const missed = await this.repo.find({
      where: {
        estado: In([ScheduledTripStatus.PROGRAMADO, ScheduledTripStatus.CONFIRMADO]),
      },
      relations: ['route'],
    });

    for (const t of missed) {
      const isPast =
        t.fecha_programada < todayStr ||
        (t.fecha_programada === todayStr &&
          (t.hora_llegada_estimada ?? t.hora_salida) < nowTime);
      if (isPast) {
        t.estado = ScheduledTripStatus.NO_REALIZADO;
        await this.repo.save(t);
      }
    }
  }
}
