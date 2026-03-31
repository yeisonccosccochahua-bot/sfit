import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

import { IncentivesService } from './incentives.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { User, UserRole } from '../../entities';

class HistoryQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page  = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit = 20;
}

@ApiTags('Incentivos')
@ApiBearerAuth()
@Controller('api/incentives')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IncentivesController {
  constructor(private readonly service: IncentivesService) {}

  // ── GET /api/incentives/my-points ────────────────────────────────────────────
  @Get('my-points')
  @Roles(UserRole.CIUDADANO)
  @ApiOperation({ summary: 'Puntos actuales del ciudadano con desglose por tipo' })
  getMyPoints(@CurrentUser() user: User) {
    return this.service.getMyPoints(user.id);
  }

  // ── GET /api/incentives/history ───────────────────────────────────────────────
  @Get('history')
  @Roles(UserRole.CIUDADANO)
  @ApiOperation({ summary: 'Historial paginado de puntos ganados' })
  @ApiQuery({ name: 'page',  required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getHistory(@Query() query: HistoryQueryDto, @CurrentUser() user: User) {
    return this.service.getHistory(user.id, query.page, query.limit);
  }

  // ── GET /api/incentives/ranking ───────────────────────────────────────────────
  @Get('ranking')
  @Roles(UserRole.CIUDADANO, UserRole.FISCAL, UserRole.ADMIN_MUNICIPAL)
  @ApiOperation({ summary: 'Top 20 ciudadanos por puntos en la municipalidad' })
  @ApiResponse({ status: 200, description: 'Array ordenado con posición, nombre y puntos' })
  getRanking(@CurrentUser() user: User) {
    return this.service.getRanking(user.municipality_id!);
  }
}
