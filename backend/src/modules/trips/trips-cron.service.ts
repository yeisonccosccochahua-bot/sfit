import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TripsService } from './trips.service';

@Injectable()
export class TripsCronService {
  private readonly logger = new Logger(TripsCronService.name);

  constructor(private tripsService: TripsService) {}

  /**
   * Cada 15 minutos: cierra automáticamente viajes EN_CURSO
   * que superaron 1.5× la duración estimada de la ruta.
   */
  @Cron('0 */15 * * * *', { name: 'trips-auto-close' })
  async handleAutoClose(): Promise<void> {
    this.logger.log('[CRON] Verificando viajes excedidos...');
    try {
      const result = await this.tripsService.autoCloseOverdue();
      if (result.closed > 0) {
        this.logger.warn(`[CRON] Viajes cerrados automáticamente: ${result.closed} → ${result.trip_ids.join(', ')}`);
      } else {
        this.logger.log('[CRON] Sin viajes excedidos.');
      }
    } catch (err) {
      this.logger.error(`[CRON] Error en cierre automático: ${err.message}`, err.stack);
    }
  }
}
