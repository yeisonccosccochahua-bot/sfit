import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { IncentivesService } from './incentives.service';

@Injectable()
export class IncentivesCronService {
  private readonly logger = new Logger(IncentivesCronService.name);

  constructor(private readonly incentivesService: IncentivesService) {}

  /**
   * Daily at midnight — reset reports_today counter for all citizens.
   */
  @Cron('0 0 0 * * *')
  async resetDailyCounters(): Promise<void> {
    try {
      const updated = await this.incentivesService.resetDailyCounters();
      this.logger.log(`reports_today reseteado para ${updated} ciudadanos`);
    } catch (err) {
      this.logger.error('Error al resetear contadores diarios', err);
    }
  }
}
