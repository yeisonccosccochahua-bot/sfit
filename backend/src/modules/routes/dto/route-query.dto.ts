import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RouteStatus, RouteType } from '../../../entities/route.entity';

export class RouteQueryDto {
  @ApiPropertyOptional({ example: 1, description: 'Página (default 1)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ example: 20, description: 'Resultados por página (max 100, default 20)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({ enum: RouteType, description: 'Filtrar por tipo de ruta' })
  @IsOptional()
  @IsEnum(RouteType)
  type: RouteType;

  @ApiPropertyOptional({ enum: RouteStatus, description: 'Filtrar por estado (default ACTIVO)' })
  @IsOptional()
  @IsEnum(RouteStatus)
  status: RouteStatus;

  @ApiPropertyOptional({ example: 'Arequipa', description: 'Filtrar por origen (búsqueda parcial)' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  origin: string;

  @ApiPropertyOptional({ example: 'Challhuahuacho', description: 'Filtrar por destino (búsqueda parcial)' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  destination: string;

  @ApiPropertyOptional({ example: 'Arequipa', description: 'Búsqueda libre en origen O destino' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  search: string;
}
