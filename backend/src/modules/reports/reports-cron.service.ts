import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ReportsService } from './reports.service';

@Injectable()
export class ReportsCronService {
  private readonly logger = new Logger(ReportsCronService.name);

  constructor(private readonly reportsService: ReportsService) {}

  /**
   * Reset daily report counters at midnight every day.
   * Cron: every day at 00:00:00
   */
  @Cron('0 0 0 * * *')
  async resetDailyCounters(): Promise<void> {
    this.logger.log('Ejecutando reset diario de reports_today…');
    await this.reportsService.resetDailyCounters();
  }
}
