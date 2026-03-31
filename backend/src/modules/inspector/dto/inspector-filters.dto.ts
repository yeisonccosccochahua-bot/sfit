import { IsEnum, IsOptional, IsString, IsNumberString } from 'class-validator';
import { InspectionTipo, InspectionResultado } from '../entities/inspection.entity';

export class InspectorFiltersDto {
  @IsOptional()
  @IsEnum(InspectionTipo)
  tipo?: InspectionTipo;

  @IsOptional()
  @IsEnum(InspectionResultado)
  resultado?: InspectionResultado;

  @IsOptional()
  @IsString()
  fecha_desde?: string;

  @IsOptional()
  @IsString()
  fecha_hasta?: string;

  @IsOptional()
  @IsString()
  vehicle_plate?: string;

  @IsOptional()
  @IsString()
  driver_dni?: string;

  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;
}
