import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MunicipalReportsService } from './municipal-reports.service';

@Injectable()
export class MunicipalReportsCronService {
  private readonly logger = new Logger(MunicipalReportsCronService.name);

  constructor(private readonly service: MunicipalReportsService) {}

  /**
   * Every Monday at 06:00 AM — generate and email weekly report for all municipalities.
   */
  @Cron('0 0 6 * * 1')
  async generateWeeklyReports(): Promise<void> {
    this.logger.log('Generando reportes SEMANALES para todas las municipalidades…');
    const { from, to } = this.service.getPreviousWeekRange();
    try {
      await this.service.generateForAll('SEMANAL', from, to);
      this.logger.log(`Reportes semanales completados. Período: ${from.toISOString()} — ${to.toISOString()}`);
    } catch (err) {
      this.logger.error('Error en generación de reportes semanales', err);
    }
  }

  /**
   * 1st of every month at 06:00 AM — generate and email monthly report.
   */
  @Cron('0 0 6 1 * *')
  async generateMonthlyReports(): Promise<void> {
    this.logger.log('Generando reportes MENSUALES para todas las municipalidades…');
    const { from, to } = this.service.getPreviousMonthRange();
    try {
      await this.service.generateForAll('MENSUAL', from, to);
      this.logger.log(`Reportes mensuales completados. Período: ${from.toISOString()} — ${to.toISOString()}`);
    } catch (err) {
      this.logger.error('Error en generación de reportes mensuales', err);
    }
  }
}
