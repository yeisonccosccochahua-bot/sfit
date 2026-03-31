import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { FatigueEngineService } from './fatigue-engine.service';
import { Trip, TripStatus } from '../../entities/trip.entity';
import { TripDriver } from '../../entities/trip-driver.entity';

@Injectable()
export class FatigueCronService {
  private readonly logger = new Logger(FatigueCronService.name);

  constructor(
    private fatigueEngine: FatigueEngineService,
    @InjectRepository(Trip)
    private tripRepo: Repository<Trip>,
    @InjectRepository(TripDriver)
    private tripDriverRepo: Repository<TripDriver>,
  ) {}

  /**
   * Cada 30 minutos: re-evalúa todos los conductores con viajes EN_CURSO.
   * Detecta si alguno debe cambiar de APTO → RIESGO → NO_APTO.
   */
  @Cron('0 */30 * * * *', { name: 'fatigue-reevaluation' })
  async reevaluateActiveDrivers(): Promise<void> {
    this.logger.log('[CRON] Iniciando re-evaluación de conductores activos...');

    const activeTrips = await this.tripRepo.find({
      where: { status: TripStatus.EN_CURSO },
      select: ['id'],
    });

    if (!activeTrips.length) {
      this.logger.log('[CRON] Sin viajes activos. Nada que evaluar.');
      return;
    }

    const tripIds = activeTrips.map((t) => t.id);
    const tripDrivers = await this.tripDriverRepo
      .createQueryBuilder('td')
      .select('DISTINCT td.driver_id', 'driver_id')
      .where('td.trip_id IN (:...tripIds)', { tripIds })
      .getRawMany<{ driver_id: string }>();

    const driverIds = [...new Set(tripDrivers.map((td) => td.driver_id))];
    this.logger.log(`[CRON] Evaluando ${driverIds.length} conductor(es) activo(s)...`);

    let evaluated = 0;
    let errors = 0;
    for (const driverId of driverIds) {
      try {
        await this.fatigueEngine.evaluateDriver(driverId);
        evaluated++;
      } catch (err) {
        errors++;
        this.logger.error(`[CRON] Error evaluando conductor ${driverId}: ${err.message}`);
      }
    }

    this.logger.log(`[CRON] Re-evaluación completada: ${evaluated} OK, ${errors} errores`);
  }

  /**
   * Cada 4 horas: verifica conducción continua y envía alertas de pausa.
   */
  @Cron('0 0 */4 * * *', { name: 'continuous-driving-check' })
  async checkContinuousDriving(): Promise<void> {
    this.logger.log('[CRON] Verificando conducción continua...');

    const activeTrips = await this.tripRepo.find({
      where: { status: TripStatus.EN_CURSO },
      select: ['id'],
    });

    if (!activeTrips.length) return;

    const tripIds = activeTrips.map((t) => t.id);
    const tripDrivers = await this.tripDriverRepo
      .createQueryBuilder('td')
      .select('DISTINCT td.driver_id', 'driver_id')
      .where('td.trip_id IN (:...tripIds)', { tripIds })
      .getRawMany<{ driver_id: string }>();

    const driverIds = [...new Set(tripDrivers.map((td) => td.driver_id))];
    let alertsSent = 0;

    for (const driverId of driverIds) {
      try {
        const result = await this.fatigueEngine.checkContinuousDriving(driverId);
        if (result.alert_sent) alertsSent++;
      } catch (err) {
        this.logger.error(`[CRON] Error conducción continua ${driverId}: ${err.message}`);
      }
    }

    this.logger.log(`[CRON] Alertas de conducción continua enviadas: ${alertsSent}`);
  }
}
