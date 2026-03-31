import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ReputationService } from './reputation.service';

@Injectable()
export class ReputationCronService {
  private readonly logger = new Logger(ReputationCronService.name);

  constructor(private readonly reputationService: ReputationService) {}

  /**
   * Daily at 03:00 AM — recalculate ALL driver, vehicle and company reputations.
   */
  @Cron('0 0 3 * * *')
  async recalculateAllReputations(): Promise<void> {
    this.logger.log('Iniciando recálculo diario de reputaciones…');
    try {
      const result = await this.reputationService.recalculateAll();
      this.logger.log(
        `Recálculo completado — conductores: ${result.drivers}, vehículos: ${result.vehicles}, empresas: ${result.companies}`,
      );
    } catch (err) {
      this.logger.error('Error en recálculo de reputaciones', err);
    }
  }
}
