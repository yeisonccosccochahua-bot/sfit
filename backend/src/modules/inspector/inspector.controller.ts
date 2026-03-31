import {
  Controller, Get, Post, Patch, Body, Param, Query,
  ParseUUIDPipe, UseGuards, UseInterceptors, UploadedFile, Req,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';

import { InspectorService } from './inspector.service';
import { CreateInspectionDto } from './dto/create-inspection.dto';
import { CreateFieldObservationDto } from './dto/create-field-observation.dto';
import { VerifyDriverDto } from './dto/verify-driver.dto';
import { VerifyVehicleDto } from './dto/verify-vehicle.dto';
import { FinalizeInspectionDto } from './dto/finalize-inspection.dto';
import { InspectorFiltersDto } from './dto/inspector-filters.dto';

import { JwtAuthGuard }   from '../auth/guards/jwt-auth.guard';
import { RolesGuard }     from '../auth/guards/roles.guard';
import { Roles }          from '../auth/decorators/roles.decorator';
import { CurrentUser }    from '../auth/decorators/current-user.decorator';
import { User, UserRole } from '../../entities/user.entity';
import { UploadsService } from '../uploads/uploads.service';

@ApiTags('Inspector')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.INSPECTOR)
@Controller('api/inspector')
export class InspectorController {
  constructor(
    private readonly service: InspectorService,
    private readonly uploads: UploadsService,
  ) {}

  // ── DASHBOARD ──────────────────────────────────────────────────────────────
  @Get('dashboard')
  @ApiOperation({ summary: 'KPIs del inspector autenticado' })
  getDashboard(@CurrentUser() user: User) {
    return this.service.getDashboard(user);
  }

  @Get('dashboard/viajes-activos')
  @ApiOperation({ summary: 'Viajes EN_CURSO de la municipalidad' })
  getActiveTrips(@CurrentUser() user: User) {
    return this.service.getActiveTrips(user);
  }

  @Get('dashboard/alertas')
  @ApiOperation({ summary: 'Feed de alertas (notificaciones del inspector)' })
  @ApiQuery({ name: 'page',  required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getAlertas(
    @CurrentUser() user: User,
    @Query('page')  page  = '1',
    @Query('limit') limit = '50',
  ) {
    return this.service.getAlertas(user, +page, +limit);
  }

  // ── SCAN QR ────────────────────────────────────────────────────────────────
  @Post('scan-qr')
  @ApiOperation({ summary: 'Escanear QR en campo — retorna vehículo, viaje y conductores' })
  scanQr(@Body() body: { qr_content: string }, @CurrentUser() user: User) {
    if (!body?.qr_content) throw new BadRequestException('qr_content es requerido');
    return this.service.scanQr(body.qr_content, user);
  }

  // ── VERIFY DRIVER ──────────────────────────────────────────────────────────
  @Post('verify-driver')
  @ApiOperation({ summary: 'Registrar verificación de conductor' })
  verifyDriver(@Body() dto: VerifyDriverDto, @CurrentUser() user: User) {
    return this.service.verifyDriver(dto, user);
  }

  // ── VERIFY VEHICLE ─────────────────────────────────────────────────────────
  @Post('verify-vehicle')
  @ApiOperation({ summary: 'Registrar inspección de vehículo' })
  verifyVehicle(@Body() dto: VerifyVehicleDto, @CurrentUser() user: User) {
    return this.service.verifyVehicle(dto, user);
  }

  // ── INSPECTIONS CRUD ───────────────────────────────────────────────────────
  @Post('inspections')
  @ApiOperation({ summary: 'Crear nueva inspección manual' })
  create(@Body() dto: CreateInspectionDto, @CurrentUser() user: User) {
    return this.service.createInspection(dto, user);
  }

  @Get('inspections')
  @ApiOperation({ summary: 'Listar mis inspecciones con filtros' })
  findAll(@CurrentUser() user: User, @Query() filters: InspectorFiltersDto) {
    return this.service.findAll(user, filters);
  }

  @Get('inspections/:id')
  @ApiOperation({ summary: 'Detalle de una inspección' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.findOne(id, user);
  }

  @Post('inspections/:id/observaciones')
  @ApiOperation({ summary: 'Agregar observación a una inspección' })
  addObservacion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateFieldObservationDto,
    @CurrentUser() user: User,
  ) {
    return this.service.addObservacion(id, dto, user);
  }

  @Post('inspections/:id/fotos')
  @ApiOperation({ summary: 'Subir foto de evidencia a una inspección' })
  @UseInterceptors(FileInterceptor('foto', { storage: memoryStorage() }))
  async addFoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: User,
  ) {
    if (!file) throw new BadRequestException('foto es requerida');
    const { url } = await this.uploads.saveFile(file, `inspections/${id}`);
    return this.service.addFoto(id, url, user);
  }

  @Patch('inspections/:id/finalizar')
  @ApiOperation({ summary: 'Finalizar inspección con resultado' })
  finalizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FinalizeInspectionDto,
    @CurrentUser() user: User,
  ) {
    return this.service.finalizeInspection(id, dto, user);
  }

  // ── STATS ──────────────────────────────────────────────────────────────────
  @Get('stats')
  @ApiOperation({ summary: 'Estadísticas personales del inspector' })
  getStats(@CurrentUser() user: User) {
    return this.service.getStats(user);
  }

  // ── LOOKUP ─────────────────────────────────────────────────────────────────
  @Get('lookup/driver/:dni')
  @ApiOperation({ summary: 'Búsqueda rápida de conductor por DNI' })
  lookupDriver(@Param('dni') dni: string, @CurrentUser() user: User) {
    return this.service.lookupDriver(dni, user);
  }

  @Get('lookup/vehicle/:placa')
  @ApiOperation({ summary: 'Búsqueda rápida de vehículo por placa' })
  lookupVehicle(@Param('placa') placa: string, @CurrentUser() user: User) {
    return this.service.lookupVehicle(placa, user);
  }
}
