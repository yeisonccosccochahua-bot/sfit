import { IsEnum, IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TripDriverRole } from '../../../entities/trip-driver.entity';

export class ReplaceDriverDto {
  @ApiProperty({ description: 'UUID del conductor a reemplazar' })
  @IsUUID()
  @IsNotEmpty()
  old_driver_id: string;

  @ApiProperty({ description: 'UUID del nuevo conductor' })
  @IsUUID()
  @IsNotEmpty()
  new_driver_id: string;

  @ApiProperty({ enum: TripDriverRole, description: 'Rol asignado al nuevo conductor' })
  @IsEnum(TripDriverRole)
  role: TripDriverRole;
}
