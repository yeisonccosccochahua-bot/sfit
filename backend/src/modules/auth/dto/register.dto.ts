import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MinLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../entities/user.entity';

export class RegisterDto {
  @ApiProperty({ example: 'juan.perez@example.com' })
  @IsEmail({}, { message: 'Email inválido' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'P@ssw0rd123', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'La contraseña debe contener mayúsculas, minúsculas y números',
  })
  password: string;

  @ApiProperty({ example: 'Juan Pérez López' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 200)
  name: string;

  @ApiPropertyOptional({ example: '43215678' })
  @IsOptional()
  @IsString()
  @Length(8, 15)
  dni: string;

  @ApiPropertyOptional({ example: '+51987654321' })
  @IsOptional()
  @IsString()
  @Length(7, 20)
  phone: string;

  @ApiProperty({ enum: UserRole, example: UserRole.CIUDADANO })
  @IsEnum(UserRole, { message: 'Rol inválido' })
  role: UserRole;

  @ApiPropertyOptional({ example: 'uuid-municipalidad' })
  @IsOptional()
  @IsUUID()
  municipality_id: string;
}
