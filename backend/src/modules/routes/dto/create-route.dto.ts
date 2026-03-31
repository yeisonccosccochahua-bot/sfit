import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsString,
  IsBoolean,
  IsUUID,
  Min,
  Max,
  IsNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RouteType } from '../../../entities/route.entity';

export class CreateRouteDto {
  @ApiProperty({ example: 'Arequipa', description: 'Ciudad/punto de origen' })
  @IsString()
  @IsNotEmpty()
  origin: string;

  @ApiProperty({ example: 'Challhuahuacho', description: 'Ciudad/punto de destino' })
  @IsString()
  @IsNotEmpty()
  destination: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['Cailloma', 'Imata'],
    description: 'Paradas intermedias (array JSON)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  stops: string[];

  @ApiProperty({ example: 660, description: 'Duración estimada del tramo en minutos' })
  @IsInt()
  @Min(1)
  @Max(2880)
  estimated_duration_minutes: number;

  @ApiProperty({ enum: RouteType, example: RouteType.PREDEFINIDA })
  @IsEnum(RouteType)
  type: RouteType;

  @ApiPropertyOptional({ example: 2, description: 'Conductores mínimos requeridos (default 1)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  min_drivers: number;

  @ApiPropertyOptional({
    example: 4,
    description: 'Horas de descanso mínimo entre tramo de ida y retorno (null = sin restricción)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(24)
  rest_between_legs_hours: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Si permite ida y vuelta con el mismo conductor/vehículo',
  })
  @IsOptional()
  @IsBoolean()
  allows_roundtrip: boolean;

  @ApiPropertyOptional({ description: 'UUID de la municipalidad (se inyecta automáticamente del JWT si no se envía)' })
  @IsOptional()
  @IsUUID()
  municipality_id: string;
}
