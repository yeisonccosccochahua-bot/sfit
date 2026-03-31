import { IsOptional, IsEnum, IsInt, Min, IsDateString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ReportType, ReportStatus } from '../../../entities';

export class ReportQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit = 15;

  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @IsOptional()
  @IsEnum(ReportType)
  type?: ReportType;

  @IsOptional()
  @IsUUID()
  trip_id?: string;

  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;
}
