import {
  IsUUID, IsArray, IsDateString, IsEnum, IsOptional,
  IsString, Matches, ValidateNested, IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

class AssignedDriverDto {
  @IsUUID()
  driver_id: string;

  @IsIn(['PRINCIPAL', 'SUPLENTE', 'COPILOTO'])
  role: 'PRINCIPAL' | 'SUPLENTE' | 'COPILOTO';
}

export class CreateScheduledTripDto {
  @IsUUID()
  vehicle_id: string;

  @IsUUID()
  route_id: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssignedDriverDto)
  assigned_drivers: AssignedDriverDto[];

  @IsDateString()
  fecha_programada: string;

  @Matches(/^\d{2}:\d{2}$/)
  hora_salida: string;

  @IsEnum(['UNICO', 'DIARIO_LUN_VIE', 'DIARIO_LUN_SAB', 'PERSONALIZADO'])
  recurrencia: string;

  @IsOptional()
  @IsArray()
  dias_semana?: number[];

  @IsOptional()
  @IsDateString()
  recurrencia_hasta?: string;

  @IsOptional()
  @IsString()
  notas?: string;
}
