import { PartialType, OmitType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateRouteDto } from './create-route.dto';
import { RouteStatus } from '../../../entities/route.entity';

export class UpdateRouteDto extends PartialType(
  OmitType(CreateRouteDto, ['municipality_id'] as const),
) {
  @ApiPropertyOptional({ enum: RouteStatus, description: 'Estado de la ruta' })
  @IsOptional()
  @IsEnum(RouteStatus)
  status?: RouteStatus;
}
