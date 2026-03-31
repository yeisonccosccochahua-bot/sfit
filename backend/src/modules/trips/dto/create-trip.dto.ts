import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  ValidateIf,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TripDriverRole } from '../../../entities/trip-driver.entity';

export class TripDriverAssignmentDto {
  @ApiProperty({ description: 'UUID del conductor' })
  @IsUUID()
  @IsNotEmpty()
  driver_id: string;

  @ApiProperty({ enum: TripDriverRole, example: TripDriverRole.PRINCIPAL })
  @IsEnum(TripDriverRole)
  role: TripDriverRole;
}

export class CreateTripDto {
  @ApiProperty({ description: 'UUID del vehículo' })
  @IsUUID()
  @IsNotEmpty()
  vehicle_id: string;

  @ApiProperty({ description: 'UUID de la ruta' })
  @IsUUID()
  @IsNotEmpty()
  route_id: string;

  @ApiProperty({
    type: [TripDriverAssignmentDto],
    description: 'Conductores asignados con su rol (mínimo 1)',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Debe asignar al menos un conductor' })
  @ValidateNested({ each: true })
  @Type(() => TripDriverAssignmentDto)
  drivers: TripDriverAssignmentDto[];

  @ApiPropertyOptional({
    example: '2026-03-26T06:00:00Z',
    description: 'Fecha/hora programada de salida (ISO 8601). Por defecto: ahora',
  })
  @IsOptional()
  @IsISO8601()
  scheduled_start: string;

  @ApiPropertyOptional({ default: false, description: 'Si es viaje de retorno' })
  @IsOptional()
  @IsBoolean()
  is_return_leg: boolean = false;

  @ApiPropertyOptional({ description: 'UUID del viaje de ida (requerido si is_return_leg=true)' })
  @ValidateIf((o) => o.is_return_leg === true)
  @IsUUID()
  parent_trip_id: string;
}
