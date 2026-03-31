import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { DriverStatus } from '../../../entities/driver.entity';

export class ChangeDriverStatusDto {
  @ApiProperty({ enum: DriverStatus, description: 'Nuevo estado / estado' })
  @Transform(({ value, obj }) => value ?? (obj as any).estado)
  @IsEnum(DriverStatus)
  status: DriverStatus;

  /** @deprecated alias: use `status` */
  @ApiPropertyOptional({ description: 'Alias de status (estado)' })
  @IsString() @IsOptional()
  estado?: string;

  @ApiPropertyOptional({ description: 'Motivo / motivo_inactividad', maxLength: 500 })
  @Transform(({ value, obj }) => value ?? (obj as any).motivo_inactividad ?? (obj as any).motivo_estado)
  @IsString() @IsOptional() @MaxLength(500)
  reason?: string;

  /** @deprecated alias: use `reason` */
  @ApiPropertyOptional()
  @IsString() @IsOptional()
  motivo_inactividad?: string;
}
