import { IsIn, IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import type { ReportPeriodType } from '../municipal-reports.service';

export class ReportQueryDto {
  @ApiProperty({ enum: ['SEMANAL', 'MENSUAL'], description: 'Tipo de reporte' })
  @IsIn(['SEMANAL', 'MENSUAL'])
  type: ReportPeriodType;

  @ApiPropertyOptional({ description: 'Inicio del período (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Fin del período (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class ExportQueryDto extends ReportQueryDto {
  @ApiPropertyOptional({ enum: ['csv'], default: 'csv' })
  @IsOptional()
  @IsIn(['csv'])
  format?: 'csv' = 'csv';
}
