import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class VerifyVehicleDto {
  @IsUUID()
  inspection_id: string;

  @IsUUID()
  vehicle_id: string;

  @IsEnum(['BUENO', 'REGULAR', 'MALO'])
  estado_general: 'BUENO' | 'REGULAR' | 'MALO';

  @IsBoolean()
  luces_funcionan: boolean;

  @IsEnum(['BUENO', 'REGULAR', 'MALO'])
  llantas_estado: 'BUENO' | 'REGULAR' | 'MALO';

  @IsBoolean()
  documentos_vigentes: boolean;

  @IsBoolean()
  soat_vigente: boolean;

  @IsBoolean()
  revision_tecnica_vigente: boolean;

  @IsBoolean()
  capacidad_excedida: boolean;

  @IsOptional()
  @IsString()
  observaciones_vehiculo?: string;
}
