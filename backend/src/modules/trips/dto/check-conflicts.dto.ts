import { IsUUID, IsArray, IsDateString, Matches, IsInt, IsOptional } from 'class-validator';

export class CheckConflictsDto {
  @IsUUID()
  vehicle_id: string;

  @IsArray()
  driver_ids: string[];

  @IsDateString()
  fecha: string;

  @Matches(/^\d{2}:\d{2}$/)
  hora_salida: string;

  @IsInt()
  duracion_minutos: number;

  @IsOptional()
  @IsUUID()
  exclude_id?: string;

  @IsOptional()
  @IsUUID()
  route_id?: string;
}
