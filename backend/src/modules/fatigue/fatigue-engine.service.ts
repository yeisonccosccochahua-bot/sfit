import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';

import { Driver, DriverStatus } from '../../entities/driver.entity';
import { Trip, TripStatus } from '../../entities/trip.entity';
import { Route } from '../../entities/route.entity';
import { FatigueLog, FatigueLogResult } from '../../entities/fatigue-log.entity';
import { Notification, NotificationChannel, NotificationStatus } from '../../entities/notification.entity';
import { AuditLog } from '../../entities/audit-log.entity';

// ─────────────────────────────────────────────────────
// Umbrales globales
// ─────────────────────────────────────────────────────
const WINDOW_HOURS = 24;
const MIN_REST_HOURS = 8;          // descanso mínimo obligatorio
const ALERT_CONTINUOUS_HOURS = 4;  // alerta de pausa (no bloqueo)

interface FatigueThresholds {
  max_hours: number;       // NO_APTO si >= este valor
  warning_hours: number;   // RIESGO si >= este valor (< max)
  min_rest: number;        // descanso mínimo (NO_APTO si rest < warning_rest)
  warning_rest: number;    // RIESGO si rest en [warning_rest, min_rest)
}

const NORMAL_THRESHOLDS: FatigueThresholds = {
  max_hours: 8,
  warning_hours: 6,
  min_rest: MIN_REST_HOURS,
  warning_rest: 6,
};

/** Para rutas > 480 min el límite sube a 10h; el bloque de RIESGO solo aplica al descanso */
const LONG_ROUTE_THRESHOLDS: FatigueThresholds = {
  max_hours: 10,
  warning_hours: 10,   // sin franja RIESGO por horas (solo aplica rest)
  min_rest: MIN_REST_HOURS,
  warning_rest: 6,
};

const LONG_ROUTE_DURATION_MINUTES = 480;

// ─────────────────────────────────────────────────────
// Tipos de retorno
// ─────────────────────────────────────────────────────
export interface FatigueEvaluation {
  driverId: string;
  driverName: string;
  result: FatigueLogResult;
  hours_driven_24h: number;
  last_rest_hours: number;
  details: {
    trips_analyzed: number;
    has_active_trip: boolean;
    max_hours_limit: number;
    warning_hours_limit: number;
    previous_status: DriverStatus;
  };
  logId: string;
  evaluated_at: Date;
}

export interface CanOperateResult {
  canOperate: boolean;
  status: FatigueLogResult;
  evaluation: FatigueEvaluation;
  route_is_long: boolean;
  details: {
    hours_driven_24h: number;
    last_rest_hours: number;
    max_hours_limit: number;
  };
}

export interface ContinuousDrivingAlert {
  driverId: string;
  continuous_hours: number;
  alert_sent: boolean;
  requires_action: boolean;
}

@Injectable()
export class FatigueEngineService {
  private readonly logger = new Logger(FatigueEngineService.name);

  constructor(
    @InjectRepository(Driver)
    private driverRepo: Repository<Driver>,
    @InjectRepository(Trip)
    private tripRepo: Repository<Trip>,
    @InjectRepository(Route)
    private routeRepo: Repository<Route>,
    @InjectRepository(FatigueLog)
    private fatigueLogRepo: Repository<FatigueLog>,
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
    @InjectRepository(AuditLog)
    private auditRepo: Repository<AuditLog>,
  ) {}

  // ────────────────────────────────────────────────
  // MÉTODO PRINCIPAL: evaluateDriver
  // ────────────────────────────────────────────────
  async evaluateDriver(
    driverId: string,
    thresholds: FatigueThresholds = NORMAL_THRESHOLDS,
  ): Promise<FatigueEvaluation> {
    const driver = await this.driverRepo.findOne({
      where: { id: driverId },
      select: ['id', 'name', 'status', 'company_id'],
    });
    if (!driver) throw new NotFoundException(`Conductor ${driverId} no encontrado`);

    const now = new Date();
    const windowStart = new Date(now.getTime() - WINDOW_HOURS * 60 * 60 * 1000);

    // 1. Obtener todos los viajes del conductor en la ventana de 24h
    const trips = await this.getDriverTripsInWindow(driverId, windowStart);

    const completedTrips = trips.filter(
      (t) => t.status === TripStatus.FINALIZADO || t.status === TripStatus.CERRADO_AUTO,
    );
    const activeTrip = trips.find((t) => t.status === TripStatus.EN_CURSO) ?? null;

    // 2. Calcular horas conducidas en las últimas 24h
    let hours_driven_24h = 0;
    for (const trip of completedTrips) {
      if (!trip.end_time) continue;
      const start = trip.start_time < windowStart ? windowStart : trip.start_time;
      hours_driven_24h += (trip.end_time.getTime() - start.getTime()) / (60 * 60 * 1000);
    }
    if (activeTrip) {
      const start = activeTrip.start_time < windowStart ? windowStart : activeTrip.start_time;
      hours_driven_24h += (now.getTime() - start.getTime()) / (60 * 60 * 1000);
    }
    hours_driven_24h = Math.round(hours_driven_24h * 100) / 100;

    // 3. Calcular last_rest_hours
    let last_rest_hours: number;
    const lastCompleted = completedTrips.sort(
      (a, b) => b.end_time!.getTime() - a.end_time!.getTime(),
    )[0] ?? null;

    if (activeTrip) {
      if (lastCompleted?.end_time) {
        last_rest_hours =
          (activeTrip.start_time.getTime() - lastCompleted.end_time.getTime()) / (60 * 60 * 1000);
      } else {
        // No hay viaje completado previo — lleva descanso desde el inicio de la ventana
        last_rest_hours = (activeTrip.start_time.getTime() - windowStart.getTime()) / (60 * 60 * 1000);
      }
    } else if (lastCompleted?.end_time) {
      last_rest_hours = (now.getTime() - lastCompleted.end_time.getTime()) / (60 * 60 * 1000);
    } else {
      // Sin viajes en 24h — conductor totalmente descansado
      last_rest_hours = WINDOW_HOURS;
    }
    last_rest_hours = Math.round(last_rest_hours * 100) / 100;

    // 4. Determinar resultado
    const result = this.determineResult(hours_driven_24h, last_rest_hours, thresholds);

    // 5. Guardar FatigueLog
    const today = now.toISOString().split('T')[0];
    const fatigueLog = this.fatigueLogRepo.create({
      driver_id: driverId,
      evaluation_date: today,
      hours_driven_24h,
      last_rest_hours,
      result,
      details_json: {
        trips_analyzed: trips.length,
        has_active_trip: !!activeTrip,
        thresholds,
        window_start: windowStart.toISOString(),
      },
    });
    const savedLog = await this.fatigueLogRepo.save(fatigueLog);

    // 6. Actualizar driver.status y total_hours_driven_24h
    const previousStatus = driver.status;
    const newStatus = result as unknown as DriverStatus;
    if (driver.status !== newStatus) {
      driver.status = newStatus;
    }
    driver.total_hours_driven_24h = hours_driven_24h;
    if (!activeTrip && lastCompleted?.end_time) {
      driver.last_rest_start = lastCompleted.end_time;
    }
    await this.driverRepo.save(driver);

    // 7. Notificaciones
    await this.handleNotifications(driver, result, {
      hours_driven_24h,
      last_rest_hours,
      previousStatus,
    });

    const evaluation: FatigueEvaluation = {
      driverId,
      driverName: driver.name,
      result,
      hours_driven_24h,
      last_rest_hours,
      details: {
        trips_analyzed: trips.length,
        has_active_trip: !!activeTrip,
        max_hours_limit: thresholds.max_hours,
        warning_hours_limit: thresholds.warning_hours,
        previous_status: previousStatus,
      },
      logId: savedLog.id,
      evaluated_at: now,
    };

    this.logger.log(
      `Conductor ${driver.name} evaluado: ${result} (${hours_driven_24h}h conducidas, ${last_rest_hours}h descanso)`,
    );

    return evaluation;
  }

  // ────────────────────────────────────────────────
  // checkContinuousDriving
  // ────────────────────────────────────────────────
  async checkContinuousDriving(driverId: string): Promise<ContinuousDrivingAlert> {
    const driver = await this.driverRepo.findOne({
      where: { id: driverId },
      select: ['id', 'name', 'company_id'],
    });
    if (!driver) throw new NotFoundException(`Conductor ${driverId} no encontrado`);

    const now = new Date();
    const activeTrip = await this.getActiveTrip(driverId);

    if (!activeTrip) {
      return { driverId, continuous_hours: 0, alert_sent: false, requires_action: false };
    }

    const continuous_hours =
      (now.getTime() - activeTrip.start_time.getTime()) / (60 * 60 * 1000);

    if (continuous_hours >= ALERT_CONTINUOUS_HOURS) {
      // Solo notifica, NO bloquea
      await this.createNotification(
        null,
        NotificationChannel.WEB,
        'ALERTA_CONDUCCION_CONTINUA',
        'Pausa recomendada',
        `El conductor ${driver.name} lleva ${continuous_hours.toFixed(1)}h de conducción continua. Se recomienda una pausa inmediata.`,
        driver.company_id,
      );
      this.logger.warn(`Alerta conducción continua: ${driver.name} → ${continuous_hours.toFixed(1)}h`);
      return { driverId, continuous_hours, alert_sent: true, requires_action: true };
    }

    return { driverId, continuous_hours, alert_sent: false, requires_action: false };
  }

  // ────────────────────────────────────────────────
  // canDriverOperate
  // ────────────────────────────────────────────────
  async canDriverOperate(driverId: string, routeId: string): Promise<CanOperateResult> {
    const route = await this.routeRepo.findOne({
      where: { id: routeId },
      select: ['id', 'estimated_duration_minutes'],
    });
    if (!route) throw new NotFoundException(`Ruta ${routeId} no encontrada`);

    const isLongRoute = route.estimated_duration_minutes > LONG_ROUTE_DURATION_MINUTES;
    const thresholds = isLongRoute ? LONG_ROUTE_THRESHOLDS : NORMAL_THRESHOLDS;

    const evaluation = await this.evaluateDriver(driverId, thresholds);

    const canOperate = evaluation.result !== FatigueLogResult.NO_APTO;

    return {
      canOperate,
      status: evaluation.result,
      evaluation,
      route_is_long: isLongRoute,
      details: {
        hours_driven_24h: evaluation.hours_driven_24h,
        last_rest_hours: evaluation.last_rest_hours,
        max_hours_limit: thresholds.max_hours,
      },
    };
  }

  // ────────────────────────────────────────────────
  // getHistory (para endpoint de historial)
  // ────────────────────────────────────────────────
  async getHistory(
    driverId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: FatigueLog[]; total: number; page: number; lastPage: number }> {
    const driver = await this.driverRepo.findOne({ where: { id: driverId } });
    if (!driver) throw new NotFoundException(`Conductor ${driverId} no encontrado`);

    const [data, total] = await this.fatigueLogRepo.findAndCount({
      where: { driver_id: driverId },
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, lastPage: Math.ceil(total / limit) };
  }

  // ────────────────────────────────────────────────
  // getDashboard (para panel municipal)
  // ────────────────────────────────────────────────
  async getDashboard(municipalityId: string): Promise<{
    risk_drivers: Driver[];
    no_apt_drivers: Driver[];
    stats: {
      total_apto: number;
      total_riesgo: number;
      total_no_apto: number;
    };
  }> {
    const [aptCount, riesgoDrivers, noAptDrivers] = await Promise.all([
      this.driverRepo.count({
        where: { status: DriverStatus.APTO, company: { municipality_id: municipalityId } as any },
      }),
      this.driverRepo.find({
        where: { status: DriverStatus.RIESGO, company: { municipality_id: municipalityId } as any },
        relations: ['company'],
        order: { updated_at: 'DESC' },
        take: 50,
      }),
      this.driverRepo.find({
        where: { status: DriverStatus.NO_APTO, company: { municipality_id: municipalityId } as any },
        relations: ['company'],
        order: { updated_at: 'DESC' },
        take: 50,
      }),
    ]);

    return {
      risk_drivers: riesgoDrivers,
      no_apt_drivers: noAptDrivers,
      stats: {
        total_apto: aptCount,
        total_riesgo: riesgoDrivers.length,
        total_no_apto: noAptDrivers.length,
      },
    };
  }

  // ────────────────────────────────────────────────
  // HELPERS PRIVADOS
  // ────────────────────────────────────────────────

  private determineResult(
    hours_driven: number,
    last_rest_hours: number,
    t: FatigueThresholds,
  ): FatigueLogResult {
    // NO_APTO: horas exceden máximo O descanso insuficiente crítico
    if (hours_driven >= t.max_hours || last_rest_hours < t.warning_rest) {
      return FatigueLogResult.NO_APTO;
    }
    // RIESGO: horas en franja de advertencia O descanso borderline
    if (hours_driven >= t.warning_hours || last_rest_hours < t.min_rest) {
      return FatigueLogResult.RIESGO;
    }
    return FatigueLogResult.APTO;
  }

  private async getDriverTripsInWindow(driverId: string, windowStart: Date): Promise<Trip[]> {
    return this.tripRepo
      .createQueryBuilder('trip')
      .innerJoin('trip_drivers', 'td', 'td.trip_id = trip.id')
      .where('td.driver_id = :driverId', { driverId })
      .andWhere('trip.start_time >= :windowStart', { windowStart })
      .andWhere('trip.status IN (:...statuses)', {
        statuses: [TripStatus.FINALIZADO, TripStatus.EN_CURSO, TripStatus.CERRADO_AUTO],
      })
      .orderBy('trip.start_time', 'ASC')
      .getMany();
  }

  private async getActiveTrip(driverId: string): Promise<Trip | null> {
    return this.tripRepo
      .createQueryBuilder('trip')
      .innerJoin('trip_drivers', 'td', 'td.trip_id = trip.id')
      .where('td.driver_id = :driverId', { driverId })
      .andWhere('trip.status = :status', { status: TripStatus.EN_CURSO })
      .orderBy('trip.start_time', 'DESC')
      .getOne();
  }

  private async handleNotifications(
    driver: Driver,
    result: FatigueLogResult,
    context: { hours_driven_24h: number; last_rest_hours: number; previousStatus: DriverStatus },
  ): Promise<void> {
    if (result === FatigueLogResult.NO_APTO) {
      await this.createNotification(
        null,
        NotificationChannel.WEB,
        'CONDUCTOR_NO_APTO',
        `Conductor NO APTO: ${driver.name}`,
        `El conductor ${driver.name} ha sido marcado como NO APTO por fatiga. ` +
          `Horas conducidas: ${context.hours_driven_24h.toFixed(1)}h | ` +
          `Último descanso: ${context.last_rest_hours.toFixed(1)}h.`,
        driver.company_id,
      );
    } else if (result === FatigueLogResult.RIESGO && context.previousStatus === DriverStatus.APTO) {
      await this.createNotification(
        null,
        NotificationChannel.WEB,
        'CONDUCTOR_EN_RIESGO',
        `Alerta fatiga: ${driver.name}`,
        `El conductor ${driver.name} ha alcanzado estado de RIESGO por fatiga. ` +
          `Horas conducidas: ${context.hours_driven_24h.toFixed(1)}h | ` +
          `Último descanso: ${context.last_rest_hours.toFixed(1)}h. Considere asignar un relevo.`,
        driver.company_id,
      );
    }
  }

  private async createNotification(
    userId: string | null,
    channel: NotificationChannel,
    type: string,
    title: string,
    content: string,
    _companyId?: string,
  ): Promise<void> {
    if (!userId) return; // Notificación sin usuario destino directo — log solo
    const notif = this.notificationRepo.create({
      user_id: userId,
      channel,
      type,
      title,
      content,
      status: NotificationStatus.PENDIENTE,
    });
    await this.notificationRepo.save(notif).catch(() => undefined);
  }
}
