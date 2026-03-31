import { IsString, IsNotEmpty, IsUUID, IsOptional, IsInt, Min, Max, IsDateString, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateVehicleDto {
  @ApiProperty({ example: 'ABC-123', description: 'Placa del vehículo / placa' })
  @IsString() @IsNotEmpty()
  @Matches(/^[A-Z0-9]{3}-[0-9]{3}$/, { message: 'Formato de placa inválido (Ej: ABC-123)' })
  plate: string;

  @ApiPropertyOptional({ example: 'Toyota', description: 'Marca / marca' })
  @IsString() @IsOptional()
  brand?: string;

  @ApiPropertyOptional({ example: 'Coaster', description: 'Modelo / modelo' })
  @IsString() @IsOptional()
  model?: string;

  @ApiPropertyOptional({ example: 2020, description: 'Año / anio' })
  @IsInt() @Min(1990) @Max(new Date().getFullYear() + 1) @IsOptional() @Type(() => Number)
  year?: number;

  @ApiPropertyOptional({ example: 'Blanco' })
  @IsString() @IsOptional()
  color?: string;

  @ApiPropertyOptional({ example: 20, description: 'Capacidad de pasajeros / capacidad_pasajeros' })
  @IsInt() @Min(1) @Max(100) @IsOptional() @Type(() => Number)
  capacity?: number;

  @ApiPropertyOptional({ description: 'URL foto del vehículo / foto_url' })
  @IsString() @IsOptional()
  photo_url?: string;

  @ApiPropertyOptional({ description: 'Fecha vencimiento SOAT (YYYY-MM-DD) / fecha_vencimiento_soat' })
  @IsDateString() @IsOptional()
  soat_expires_at?: string;

  @ApiPropertyOptional({ description: 'Fecha vencimiento revisión técnica (YYYY-MM-DD)' })
  @IsDateString() @IsOptional()
  inspection_expires_at?: string;

  @ApiProperty({ description: 'UUID de la empresa propietaria' })
  @IsUUID()
  company_id: string;
}
