import { IsEnum, IsOptional, IsString, IsUUID, IsNumber } from 'class-validator';
import { InspectionTipo } from '../entities/inspection.entity';

export class CreateInspectionDto {
  @IsEnum(InspectionTipo)
  tipo: InspectionTipo;

  @IsString()
  ubicacion_descripcion: string;

  @IsOptional()
  @IsUUID()
  vehicle_id?: string;

  @IsOptional()
  @IsUUID()
  trip_id?: string;

  @IsOptional()
  @IsUUID()
  driver_id?: string;

  @IsOptional()
  @IsNumber()
  latitud?: number;

  @IsOptional()
  @IsNumber()
  longitud?: number;
}
