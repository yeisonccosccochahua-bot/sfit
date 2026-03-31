import { IsEnum, IsInt, IsISO8601, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TripStatus } from '../../../entities/trip.entity';

export class TripQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({ enum: TripStatus })
  @IsOptional()
  @IsEnum(TripStatus)
  status: TripStatus;

  @ApiPropertyOptional({ description: 'Filtrar por UUID de ruta' })
  @IsOptional()
  @IsUUID()
  route_id: string;

  @ApiPropertyOptional({ description: 'Filtrar por UUID de vehículo' })
  @IsOptional()
  @IsUUID()
  vehicle_id: string;

  @ApiPropertyOptional({ description: 'Filtrar por UUID de conductor asignado' })
  @IsOptional()
  @IsUUID()
  driver_id: string;

  @ApiPropertyOptional({ example: '2026-03-01', description: 'Fecha inicio del rango (YYYY-MM-DD)' })
  @IsOptional()
  @IsISO8601()
  @Transform(({ value }) => value?.split('T')[0])
  date_from: string;

  @ApiPropertyOptional({ example: '2026-03-31', description: 'Fecha fin del rango (YYYY-MM-DD)' })
  @IsOptional()
  @IsISO8601()
  @Transform(({ value }) => value?.split('T')[0])
  date_to: string;
}
