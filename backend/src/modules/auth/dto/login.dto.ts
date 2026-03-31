import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'juan.perez@example.com' })
  @IsEmail({}, { message: 'Email inválido' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'P@ssw0rd123' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
