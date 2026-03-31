import { IsBoolean, IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ValidateQrDto {
  @ApiProperty({ description: 'UUID del QR escaneado' })
  @IsString()
  @IsNotEmpty()
  qr_code: string;

  @ApiProperty({ description: 'El ciudadano confirma si el conductor en el vehículo coincide con el sistema' })
  @IsBoolean()
  is_same_driver: boolean;

  @ApiProperty({ description: 'UUID del viaje activo que se está validando' })
  @IsUUID()
  @IsNotEmpty()
  trip_id: string;
}
