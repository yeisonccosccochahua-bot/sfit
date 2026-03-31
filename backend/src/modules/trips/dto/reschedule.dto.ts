import { IsOptional, IsDateString, Matches, IsUUID, IsArray } from 'class-validator';

export class RescheduleDto {
  @IsOptional()
  @IsDateString()
  nueva_fecha?: string;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/)
  nueva_hora?: string;

  @IsOptional()
  @IsUUID()
  nuevo_vehicle_id?: string;

  @IsOptional()
  @IsArray()
  nuevos_drivers?: { driver_id: string; role: string }[];
}
