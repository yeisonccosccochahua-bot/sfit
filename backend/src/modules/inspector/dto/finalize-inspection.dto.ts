import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { InspectionResultado } from '../entities/inspection.entity';

export class FinalizeInspectionDto {
  @IsEnum([
    InspectionResultado.CONFORME,
    InspectionResultado.CON_OBSERVACIONES,
    InspectionResultado.INFRACCION_DETECTADA,
  ])
  resultado: InspectionResultado;

  @IsOptional()
  @IsString()
  notas_adicionales?: string;

  @IsOptional()
  @IsBoolean()
  derivar_sancion?: boolean;
}
