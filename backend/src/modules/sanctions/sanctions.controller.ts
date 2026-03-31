import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';

import { SanctionEngineService } from './sanction-engine.service';
import { SanctionQueryDto } from './dto/sanction-query.dto';
import { CreateAppealDto } from './dto/create-appeal.dto';
import { ResolveAppealDto } from './dto/resolve-appeal.dto';

import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { User, UserRole } from '../../entities';

@ApiTags('Sanciones')
@ApiBearerAuth()
@Controller('api/sanctions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SanctionsController {
  constructor(private readonly engine: SanctionEngineService) {}

  // ── GET /api/sanctions/stats ─────────────────────────────────────────────
  // Declared BEFORE /:id to prevent route conflict
  @Get('stats')
  @Roles(UserRole.FISCAL, UserRole.ADMIN_MUNICIPAL)
  @ApiOperation({ summary: 'Estadísticas de sanciones por municipalidad' })
  @ApiResponse({ status: 200, description: 'Totales agrupados por nivel y estado' })
  getStats(@CurrentUser() user: User) {
    return this.engine.getStats(user.municipality_id!);
  }

  // ── GET /api/sanctions ───────────────────────────────────────────────────
  @Get()
  @Roles(UserRole.FISCAL, UserRole.ADMIN_MUNICIPAL)
  @ApiOperation({ summary: 'Listar sanciones con filtros y paginación' })
  findAll(@Query() query: SanctionQueryDto, @CurrentUser() user: User) {
    return this.engine.findAll(query, user);
  }

  // ── GET /api/sanctions/:id ───────────────────────────────────────────────
  @Get(':id')
  @Roles(UserRole.FISCAL, UserRole.ADMIN_MUNICIPAL)
  @ApiOperation({ summary: 'Detalle de una sanción (incluye apelación si existe)' })
  @ApiParam({ name: 'id', description: 'UUID de la sanción' })
  @ApiResponse({ status: 404, description: 'Sanción no encontrada' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.engine.findOne(id, user);
  }

  // ── POST /api/sanctions/:id/appeal ──────────────────────────────────────
  @Post(':id/appeal')
  @Roles(UserRole.ADMIN_MUNICIPAL)
  @ApiOperation({ summary: 'Presentar apelación ante una sanción (operadora / municipio)' })
  @ApiParam({ name: 'id', description: 'UUID de la sanción' })
  @ApiResponse({ status: 201, description: 'Apelación creada' })
  @ApiResponse({ status: 400, description: 'Plazo vencido' })
  @ApiResponse({ status: 409, description: 'Ya existe una apelación activa' })
  createAppeal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateAppealDto,
    @CurrentUser() user: User,
  ) {
    return this.engine.createAppeal(id, dto, user);
  }

  // ── PATCH /api/sanctions/:id/appeal/resolve ──────────────────────────────
  @Patch(':id/appeal/resolve')
  @Roles(UserRole.FISCAL, UserRole.ADMIN_MUNICIPAL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolver una apelación (ACEPTADA / RECHAZADA)' })
  @ApiParam({ name: 'id', description: 'UUID de la sanción' })
  @ApiResponse({ status: 200, description: 'Apelación resuelta' })
  @ApiResponse({ status: 400, description: 'No hay apelación pendiente' })
  resolveAppeal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveAppealDto,
    @CurrentUser() user: User,
  ) {
    return this.engine.resolveAppeal(id, dto, user);
  }

  // ── POST /api/sanctions/evaluate/:driverId ──────────────────────────────
  // Manual trigger for fiscal inspection (separate from cron)
  @Post('evaluate/:driverId')
  @Roles(UserRole.FISCAL, UserRole.ADMIN_MUNICIPAL)
  @ApiOperation({ summary: 'Evaluar manualmente los incidentes de un conductor' })
  @ApiParam({ name: 'driverId', description: 'UUID del conductor' })
  @ApiResponse({ status: 201, description: 'Sanción creada o null si no corresponde' })
  evaluateDriver(
    @Param('driverId', ParseUUIDPipe) driverId: string,
    @CurrentUser() user: User,
  ) {
    return this.engine.evaluateDriver(driverId, user);
  }
}
