import { IsOptional, IsString, Length, MinLength, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Juan Pérez López' })
  @IsOptional()
  @IsString()
  @Length(2, 200)
  name: string;

  @ApiPropertyOptional({ example: '+51987654321' })
  @IsOptional()
  @IsString()
  @Length(7, 20)
  phone: string;

  @ApiPropertyOptional({ description: 'Nueva contraseña (mínimo 8 caracteres)' })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'La contraseña debe contener mayúsculas, minúsculas y números',
  })
  password: string;
}
