import { IsString, IsNotEmpty, IsUUID, IsOptional, Length, Matches, IsEmail, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDriverDto {
  @ApiProperty({ example: 'Juan Pérez García', description: 'Nombre completo (o enviar nombres + apellidos)' })
  @IsString() @IsNotEmpty() @Length(3, 200)
  name: string;

  @ApiProperty({ example: '12345678', description: 'DNI (8-15 dígitos)' })
  @IsString() @Length(8, 15) @Matches(/^\d+$/, { message: 'DNI debe ser numérico' })
  dni: string;

  @ApiPropertyOptional({ example: 'B-IIa-12345', description: 'Número de licencia / numero_licencia' })
  @IsString() @IsOptional()
  license_number?: string;

  @ApiPropertyOptional({ description: 'Categoría de licencia / categoria_licencia' })
  @IsString() @IsOptional() @Length(0, 20)
  license_category?: string;

  @ApiPropertyOptional({ description: 'Fecha vencimiento licencia YYYY-MM-DD / fecha_vencimiento_licencia' })
  @IsDateString() @IsOptional()
  license_expires_at?: string;

  @ApiPropertyOptional({ example: '+51 999 999 999', description: 'Teléfono / telefono' })
  @IsString() @IsOptional() @Length(0, 20)
  phone?: string;

  @ApiPropertyOptional({ example: 'conductor@empresa.com' })
  @IsEmail() @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: 'URL foto conductor / foto_url' })
  @IsString() @IsOptional()
  photo_url?: string;

  @ApiPropertyOptional({ description: 'URL foto/scan de la licencia' })
  @IsString() @IsOptional()
  license_photo_url?: string;

  @ApiProperty({ description: 'UUID de la empresa' })
  @IsUUID()
  company_id: string;
}
