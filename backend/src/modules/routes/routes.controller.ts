import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Request } from 'express';

import { RoutesService } from './routes.service';
import { RouteValidationService } from './route-validation.service';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { RouteQueryDto } from './dto/route-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MunicipalityGuard } from '../auth/guards/municipality.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole } from '../../entities/user.entity';

@ApiTags('Routes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, MunicipalityGuard)
@Controller('api/routes')
export class RoutesController {
  constructor(
    private routesService: RoutesService,
    private validationService: RouteValidationService,
  ) {}

  // ──────────────────────────────────────────────
  // GET /api/routes
  // ──────────────────────────────────────────────
  @Get()
  @ApiOperation({
    summary: 'Listar rutas de la municipalidad',
    description: 'Paginado. Filtra automáticamente por municipality_id del JWT.',
  })
  @ApiResponse({ status: 200, description: 'Lista paginada de rutas' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  findAll(@Query() query: RouteQueryDto, @Req() req: Request) {
    const municipalityId = (req as any).municipalityFilter;
    return this.routesService.findAll(query, municipalityId);
  }

  // ──────────────────────────────────────────────
  // GET /api/routes/:id
  // ──────────────────────────────────────────────
  @Get(':id')
  @ApiOperation({ summary: 'Detalle de ruta con sus reglas' })
  @ApiParam({ name: 'id', type: String, description: 'UUID de la ruta' })
  @ApiResponse({ status: 200, description: 'Detalle de la ruta' })
  @ApiResponse({ status: 404, description: 'Ruta no encontrada' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const municipalityId = (req as any).municipalityFilter;
    return this.routesService.findOne(id, municipalityId);
  }

  // ──────────────────────────────────────────────
  // GET /api/routes/:id/rules
  // ──────────────────────────────────────────────
  @Get(':id/rules')
  @ApiOperation({
    summary: 'Obtener reglas de validación de una ruta',
    description:
      'Retorna min_drivers, rest_between_legs_hours, allows_roundtrip, estimated_duration_minutes.',
  })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Reglas de la ruta' })
  @ApiResponse({ status: 404, description: 'Ruta no encontrada' })
  getRouteRules(@Param('id', ParseUUIDPipe) id: string) {
    return this.validationService.getRouteRules(id);
  }

  // ──────────────────────────────────────────────
  // POST /api/routes
  // ──────────────────────────────────────────────
  @Post()
  @Roles(UserRole.ADMIN_MUNICIPAL, UserRole.FISCAL)
  @ApiOperation({ summary: 'Crear nueva ruta (ADMIN_MUNICIPAL / FISCAL)' })
  @ApiResponse({ status: 201, description: 'Ruta creada' })
  @ApiResponse({ status: 403, description: 'Sin permiso' })
  create(@Body() dto: CreateRouteDto, @CurrentUser() user: User) {
    return this.routesService.create(dto, user);
  }

  // ──────────────────────────────────────────────
  // PATCH /api/routes/:id
  // ──────────────────────────────────────────────
  @Patch(':id')
  @Roles(UserRole.ADMIN_MUNICIPAL, UserRole.FISCAL)
  @ApiOperation({ summary: 'Editar ruta (ADMIN_MUNICIPAL / FISCAL)' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Ruta actualizada' })
  @ApiResponse({ status: 404, description: 'Ruta no encontrada' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRouteDto,
    @CurrentUser() user: User,
  ) {
    return this.routesService.update(id, dto, user);
  }

  // ──────────────────────────────────────────────
  // DELETE /api/routes/:id
  // ──────────────────────────────────────────────
  @Delete(':id')
  @Roles(UserRole.ADMIN_MUNICIPAL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminar ruta (solo ADMIN_MUNICIPAL)',
    description: 'Solo se puede eliminar si no tiene viajes asociados. Si tiene viajes, desactivar en su lugar.',
  })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Ruta eliminada' })
  @ApiResponse({ status: 409, description: 'Ruta tiene viajes asociados' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.routesService.remove(id, user);
  }

  // ──────────────────────────────────────────────
  // POST /api/routes/:id/validate-drivers
  // ──────────────────────────────────────────────
  @Post(':id/validate-drivers')
  @Roles(UserRole.ADMIN_MUNICIPAL, UserRole.FISCAL, UserRole.OPERADOR_EMPRESA)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validar conductores para una ruta',
    description:
      'Verifica que los conductores provistos cumplen con min_drivers y tienen estado APTO.',
  })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Resultado de validación' })
  validateDrivers(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('driver_ids') driverIds: string[],
  ) {
    return this.validationService.validateDriverRequirements(id, driverIds);
  }

  // ──────────────────────────────────────────────
  // POST /api/routes/:id/validate-return-leg
  // ──────────────────────────────────────────────
  @Post(':id/validate-return-leg')
  @Roles(UserRole.ADMIN_MUNICIPAL, UserRole.FISCAL, UserRole.OPERADOR_EMPRESA)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validar si puede iniciarse el viaje de retorno',
    description:
      'Verifica allows_roundtrip, estado del viaje de ida y tiempo de descanso mínimo.',
  })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Resultado de validación del retorno' })
  validateReturnLeg(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('parent_trip_id') parentTripId: string,
  ) {
    return this.validationService.validateReturnLeg(id, parentTripId);
  }
}
