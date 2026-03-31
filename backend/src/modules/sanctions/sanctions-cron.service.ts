import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SanctionEngineService } from './sanction-engine.service';

@Injectable()
export class SanctionsCronService {
  private readonly logger = new Logger(SanctionsCronService.name);

  constructor(private readonly engine: SanctionEngineService) {}

  /**
   * Every 6 hours: evaluate all drivers with recent incidents.
   * Idempotent — engine skips drivers already at the correct level.
   */
  @Cron('0 0 */6 * * *')
  async evaluateAllDriversWithIncidents(): Promise<void> {
    this.logger.log('Iniciando evaluación periódica de sanciones…');

    let driverIds: string[];
    try {
      driverIds = await this.engine.findDriversWithRecentIncidents();
    } catch (err) {
      this.logger.error('Error al obtener conductores con incidencias', err);
      return;
    }

    if (driverIds.length === 0) {
      this.logger.log('No hay conductores con incidencias recientes — nada que evaluar');
      return;
    }

    this.logger.log(`Evaluando ${driverIds.length} conductor(es)…`);
    let created = 0;
    let errors  = 0;

    for (const driverId of driverIds) {
      try {
        const sanction = await this.engine.evaluateDriver(driverId);
        if (sanction) created++;
      } catch (err) {
        errors++;
        this.logger.warn(`Error al evaluar conductor ${driverId}: ${(err as Error).message}`);
      }
    }

    this.logger.log(
      `Evaluación finalizada — nuevas sanciones: ${created}, errores: ${errors}`,
    );
  }
}
