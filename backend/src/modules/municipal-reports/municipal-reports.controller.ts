import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';

import { MunicipalReportsService } from './municipal-reports.service';
import { ReportQueryDto, ExportQueryDto } from './dto/report-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { User, UserRole } from '../../entities';

const STAFF = [UserRole.FISCAL, UserRole.ADMIN_MUNICIPAL];

@ApiTags('Reportes Municipales')
@ApiBearerAuth()
@Controller('api/municipal-reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MunicipalReportsController {
  constructor(private readonly service: MunicipalReportsService) {}

  // ── GET /api/municipal-reports/generate ─────────────────────────────────────
  @Get('generate')
  @Roles(...STAFF)
  @ApiOperation({ summary: 'Generar reporte bajo demanda y retornar JSON' })
  @ApiQuery({ name: 'type', enum: ['SEMANAL', 'MENSUAL'] })
  @ApiQuery({ name: 'from', required: false, type: String, example: '2025-01-01' })
  @ApiQuery({ name: 'to',   required: false, type: String, example: '2025-01-31' })
  @ApiResponse({ status: 200, description: 'Datos del reporte en formato JSON' })
  async generate(@Query() query: ReportQueryDto, @CurrentUser() user: User) {
    const { from, to } = this.resolvePeriod(query);
    return this.service.gatherData(user.municipality_id!, from, to, query.type);
  }

  // ── GET /api/municipal-reports/export ────────────────────────────────────────
  @Get('export')
  @Roles(...STAFF)
  @ApiOperation({ summary: 'Exportar reporte en CSV' })
  @ApiQuery({ name: 'type',   enum: ['SEMANAL', 'MENSUAL'] })
  @ApiQuery({ name: 'from',   required: false, type: String })
  @ApiQuery({ name: 'to',     required: false, type: String })
  @ApiQuery({ name: 'format', required: false, enum: ['csv'], example: 'csv' })
  async export(
    @Query() query: ExportQueryDto,
    @CurrentUser() user: User,
    @Res() res: Response,
  ) {
    const { from, to } = this.resolvePeriod(query);
    const data = await this.service.gatherData(user.municipality_id!, from, to, query.type);
    const csv  = this.service.toCsv(data);

    const filename = `sfit_${query.type.toLowerCase()}_${from.toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv); // BOM for Excel UTF-8
  }

  // ── Helper ────────────────────────────────────────────────────────────────────
  private resolvePeriod(query: ReportQueryDto): { from: Date; to: Date } {
    if (query.from && query.to) {
      return {
        from: new Date(`${query.from}T00:00:00`),
        to:   new Date(`${query.to}T23:59:59`),
      };
    }
    if (query.type === 'MENSUAL') return this.service.getPreviousMonthRange();
    return this.service.getPreviousWeekRange();
  }
}
