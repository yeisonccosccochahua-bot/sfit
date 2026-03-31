import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { VehicleStatus } from '../../../entities/vehicle.entity';

export class ChangeVehicleStatusDto {
  @ApiProperty({ enum: VehicleStatus, description: 'Nuevo estado / estado' })
  @Transform(({ value, obj }) => value ?? (obj as any).estado)
  @IsEnum(VehicleStatus)
  status: VehicleStatus;

  /** @deprecated alias: use `status` */
  @ApiPropertyOptional({ description: 'Alias de status (estado)' })
  @IsString() @IsOptional()
  estado?: string;

  @ApiPropertyOptional({ description: 'Motivo del cambio / motivo_estado / motivo_inactividad', maxLength: 500 })
  @Transform(({ value, obj }) => value ?? (obj as any).motivo_estado ?? (obj as any).motivo_inactividad)
  @IsString() @IsOptional() @MaxLength(500)
  reason?: string;

  /** @deprecated alias: use `reason` */
  @ApiPropertyOptional()
  @IsString() @IsOptional()
  motivo_estado?: string;
}
