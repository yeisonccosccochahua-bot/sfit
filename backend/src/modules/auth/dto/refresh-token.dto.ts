import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token JWT obtenido al hacer login' })
  @IsString()
  @IsNotEmpty()
  refresh_token: string;
}
