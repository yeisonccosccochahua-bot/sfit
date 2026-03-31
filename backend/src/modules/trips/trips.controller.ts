import {
  Controller,
  Get,
  Post,
  Patch,
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
  ApiBody,
} from '@nestjs/swagger';
import { Request } from 'express';

import { TripsService } from './trips.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { TripQueryDto } from './dto/trip-query.dto';
import { ReplaceDriverDto } from './dto/replace-driver.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MunicipalityGuard } from '../auth/guards/municipality.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole } from '../../entities/user.entity';

@ApiTags('Trips')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, MunicipalityGuard)
@Controller('api/trips')
export class TripsController {
  constructor(private tripsService: TripsService) {}

  // ─────────────────────────────────────────────────
  // GET /api/trips/active  (ANTES de :id para que no colisione)
  // ─────────────────────────────────────────────────
  @Get('active')
  @Roles(UserRole.ADMIN_MUNICIPAL, UserRole.FISCAL, UserRole.INSPECTOR, UserRole.OPERADOR_EMPRESA)
  @ApiOperation({
    summary: 'Viajes EN_CURSO de la municipalidad',
    description: 'Para el dashboard municipal. Requiere autorización.',
  })
  @ApiResponse({ status: 200, description: 'Lista de viajes activos' })
  findActive(@Req() req: Request) {
    return this.tripsService.findActive((req as any).municipalityFilter);
  }

  // ─────────────────────────────────────────────────
  // GET /api/trips
  // ─────────────────────────────────────────────────
  @Get()
  @ApiOperation({
    summary: 'Listar viajes',
    description: 'Paginado. Filtros: status, fecha, ruta, conductor, vehículo.',
  })
  @ApiResponse({ status: 200, description: 'Lista paginada de viajes' })
  findAll(@Query() query: TripQueryDto, @Req() req: Request) {
    return this.tripsService.findAll(query, (req as any).municipalityFilter);
  }

  // ─────────────────────────────────────────────────
  // GET /api/trips/vehicle/:vehicleId/active
  // ─────────────────────────────────────────────────
  @Get('vehicle/:vehicleId/active')
  @ApiOperation({
    summary: 'Viaje activo de un vehículo (escaneo QR)',
    description: 'Retorna el viaje EN_CURSO del vehículo, con conductores y ruta.',
  })
  @ApiParam({ name: 'vehicleId', type: String })
  @ApiResponse({ status: 200, description: 'Viaje activo del vehículo' })
  @ApiResponse({ status: 404, description: 'No hay viaje activo para este vehículo' })
  findActiveByVehicle(
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Req() req: Request,
  ) {
    return this.tripsService.findActiveByVehicle(vehicleId, (req as any).municipalityFilter);
  }

  // ─────────────────────────────────────────────────
  // GET /api/trips/:id
  // ─────────────────────────────────────────────────
  @Get(':id')
  @ApiOperation({ summary: 'Detalle de viaje con conductores y evaluaciones' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Detalle del viaje' })
  @ApiResponse({ status: 404, description: 'Viaje no encontrado' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.tripsService.findOne(id, (req as any).municipalityFilter);
  }

  // ─────────────────────────────────────────────────
  // GET /api/trips/:id/drivers
  // ─────────────────────────────────────────────────
  @Get(':id/drivers')
  @ApiOperation({ summary: 'Conductores asignados a un viaje con resultado de fatiga' })
  @ApiParam({ name: 'id', type: String })
  getTripDrivers(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.tripsService.getTripDrivers(id, (req as any).municipalityFilter);
  }

  // ─────────────────────────────────────────────────
  // POST /api/trips
  // ─────────────────────────────────────────────────
  @Post()
  @Roles(UserRole.ADMIN_MUNICIPAL, UserRole.FISCAL, UserRole.OPERADOR_EMPRESA)
  @ApiOperation({
    summary: 'Registrar nuevo viaje (pre-salida)',
    description:
      'Valida vehículo, ruta, conductores, fatiga y requisitos antes de crear el viaje. ' +
      'Retorna 409 con `reasons[]` si algún bloqueo impide el registro.',
  })
  @ApiResponse({ status: 201, description: 'Viaje registrado' })
  @ApiResponse({
    status: 409,
    description: 'Viaje bloqueado',
    schema: {
      example: {
        statusCode: 409,
        message: 'Viaje bloqueado: no se cumplen los requisitos previos',
        blocked: true,
        reasons: [
          { type: 'FATIGUE', driver_id: 'uuid', driver_name: 'Juan', message: 'No apto por fatiga' },
        ],
      },
    },
  })
  create(@Body() dto: CreateTripDto, @CurrentUser() user: User) {
    return this.tripsService.register(dto, user);
  }

  // ─────────────────────────────────────────────────
  // PATCH /api/trips/:id/start
  // ─────────────────────────────────────────────────
  @Patch(':id/start')
  @Roles(UserRole.ADMIN_MUNICIPAL, UserRole.FISCAL, UserRole.OPERADOR_EMPRESA)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Iniciar viaje (REGISTRADO → EN_CURSO)',
    description: 'Re-evalúa fatiga de conductores antes de iniciar. Si alguno cambió a NO_APTO → 409.',
  })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Viaje iniciado' })
  @ApiResponse({ status: 409, description: 'Conductor no apto en el momento de inicio' })
  start(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.tripsService.start(id, user);
  }

  // ─────────────────────────────────────────────────
  // PATCH /api/trips/:id/end
  // ─────────────────────────────────────────────────
  @Patch(':id/end')
  @Roles(UserRole.ADMIN_MUNICIPAL, UserRole.FISCAL, UserRole.OPERADOR_EMPRESA, UserRole.INSPECTOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Finalizar viaje (EN_CURSO → FINALIZADO)',
    description: 'Registra end_time, recalcula fatiga de los conductores.',
  })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Viaje finalizado' })
  @ApiResponse({ status: 409, description: 'El viaje no está EN_CURSO' })
  end(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.tripsService.end(id, user);
  }

  // ─────────────────────────────────────────────────
  // PATCH /api/trips/:id/replace-driver
  // ─────────────────────────────────────────────────
  @Patch(':id/replace-driver')
  @Roles(UserRole.ADMIN_MUNICIPAL, UserRole.FISCAL, UserRole.OPERADOR_EMPRESA)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reemplazar conductor en un viaje activo',
    description:
      'Valida que el nuevo conductor esté APTO y pertenezca a la misma empresa. Registra en auditoría.',
  })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: ReplaceDriverDto })
  @ApiResponse({ status: 200, description: 'Conductor reemplazado exitosamente' })
  @ApiResponse({ status: 409, description: 'Nuevo conductor no apto' })
  replaceDriver(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplaceDriverDto,
    @CurrentUser() user: User,
  ) {
    return this.tripsService.replaceDriver(id, dto, user);
  }
}
