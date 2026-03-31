import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class VerifyDriverDto {
  @IsUUID()
  inspection_id: string;

  @IsUUID()
  driver_id: string;

  @IsBoolean()
  conductor_coincide: boolean;

  @IsBoolean()
  licencia_vigente: boolean;

  @IsBoolean()
  licencia_categoria_correcta: boolean;

  @IsEnum(['NORMAL', 'CANSADO', 'MUY_CANSADO'])
  estado_fatiga_visual: 'NORMAL' | 'CANSADO' | 'MUY_CANSADO';

  @IsOptional()
  @IsString()
  observaciones_conductor?: string;
}
