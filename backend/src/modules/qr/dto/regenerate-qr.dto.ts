import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegenerateQrDto {
  @ApiProperty({
    example: 'QR dañado físicamente',
    description: 'Motivo de la regeneración: QR dañado, comprometido, etc.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  reason: string;
}
