import { IsString, IsNotEmpty, IsOptional, Length, Matches, IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCompanyDto {
  @ApiProperty({ example: '20123456789', description: 'RUC de 11 dígitos' })
  @IsString() @Length(11, 11) @Matches(/^\d{11}$/, { message: 'RUC debe tener 11 dígitos numéricos' })
  ruc: string;

  @ApiProperty({ example: 'Transportes Cotabambas S.A.C.', description: 'Nombre / razon_social' })
  @IsString() @IsNotEmpty() @Length(3, 200)
  name: string;

  @ApiPropertyOptional({ description: 'Dirección / direccion' })
  @IsString() @IsOptional() @Length(0, 300)
  address?: string;

  @ApiPropertyOptional({ description: 'Número de licencia/habilitación' })
  @IsString() @IsOptional() @Length(0, 100)
  license?: string;

  @ApiPropertyOptional({ example: '+51 999 999 999', description: 'Teléfono / telefono' })
  @IsString() @IsOptional() @Length(0, 20)
  phone?: string;

  @ApiPropertyOptional({ example: 'contacto@empresa.com' })
  @IsEmail() @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: 'Juan Pérez García', description: 'Representante legal / representante_legal' })
  @IsString() @IsOptional() @Length(0, 200)
  representative?: string;

  @ApiPropertyOptional({ example: '12345678', description: 'DNI representante / dni_representante' })
  @IsString() @IsOptional() @Length(0, 15)
  representative_dni?: string;
}
