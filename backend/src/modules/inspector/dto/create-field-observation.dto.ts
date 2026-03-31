import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateFieldObservationDto {
  @IsString()
  descripcion: string;

  @IsEnum(['DOCUMENTOS', 'ESTADO_VEHICULO', 'CONDUCTOR', 'RUTA', 'PASAJEROS', 'OTRO'])
  tipo: string;

  @IsEnum(['LEVE', 'MODERADA', 'GRAVE'])
  gravedad: 'LEVE' | 'MODERADA' | 'GRAVE';

  @IsOptional()
  @IsString()
  foto_url?: string;
}
