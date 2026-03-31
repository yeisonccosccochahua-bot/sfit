import {
  Controller, Get, Post, Patch, Param, Body, Query,
  UseGuards, ParseUUIDPipe, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

import { ScheduledTripsService } from './scheduled-trips.service';
import { CreateScheduledTripDto } from './dto/create-scheduled-trip.dto';
import { CancelScheduledTripDto } from './dto/cancel-scheduled-trip.dto';
import { RescheduleDto } from './dto/reschedule.dto';
import { CheckConflictsDto } from './dto/check-conflicts.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole } from '../../entities/user.entity';

@ApiTags('ScheduledTrips')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/scheduled-trips')
export class ScheduledTripsController {
  constructor(private readonly service: ScheduledTripsService) {}

  @Post()
  @Roles(UserRole.OPERADOR_EMPRESA, UserRole.ADMIN_MUNICIPAL)
  @ApiOperation({ summary: 'Crear viaje programado (con recurrencia opcional)' })
  create(@Body() dto: CreateScheduledTripDto, @CurrentUser() user: User) {
    return this.service.create(dto, user);
  }

  @Post('check-conflicts')
  @HttpCode(200)
  @Roles(UserRole.OPERADOR_EMPRESA, UserRole.ADMIN_MUNICIPAL)
  @ApiOperation({ summary: 'Verificar conflictos de horario antes de crear' })
  checkConflicts(@Body() dto: CheckConflictsDto) {
    return this.service.checkConflicts(dto);
  }

  @Get('week')
  @Roles(UserRole.OPERADOR_EMPRESA, UserRole.ADMIN_MUNICIPAL, UserRole.FISCAL, UserRole.INSPECTOR)
  @ApiOperation({ summary: 'Calendario semanal agrupado por día' })
  getWeekSchedule(
    @Query('start_date') startDate: string,
    @Query('end_date') endDate: string,
    @CurrentUser() user: User,
  ) {
    return this.service.getWeekSchedule(user, startDate, endDate);
  }

  @Get('day')
  @Roles(UserRole.OPERADOR_EMPRESA, UserRole.ADMIN_MUNICIPAL, UserRole.FISCAL, UserRole.INSPECTOR)
  @ApiOperation({ summary: 'Viajes programados para un día específico' })
  getDaySchedule(@Query('date') date: string, @CurrentUser() user: User) {
    return this.service.getDaySchedule(user, date);
  }

  @Get(':id')
  @Roles(UserRole.OPERADOR_EMPRESA, UserRole.ADMIN_MUNICIPAL, UserRole.FISCAL)
  @ApiOperation({ summary: 'Detalle de viaje programado' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.findOne(id, user);
  }

  @Patch(':id/confirm')
  @Roles(UserRole.OPERADOR_EMPRESA, UserRole.ADMIN_MUNICIPAL)
  @ApiOperation({ summary: 'Confirmar viaje programado (PROGRAMADO → CONFIRMADO)' })
  confirm(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.confirm(id, user);
  }

  @Post(':id/start')
  @Roles(UserRole.OPERADOR_EMPRESA, UserRole.ADMIN_MUNICIPAL)
  @ApiOperation({ summary: 'Iniciar viaje programado → crea Trip real' })
  startTrip(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.startTrip(id, user);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.OPERADOR_EMPRESA, UserRole.ADMIN_MUNICIPAL)
  @ApiOperation({ summary: 'Cancelar viaje programado (con opción de cancelar serie)' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelScheduledTripDto,
    @CurrentUser() user: User,
  ) {
    return this.service.cancel(id, dto, user);
  }

  @Patch(':id/reschedule')
  @Roles(UserRole.OPERADOR_EMPRESA, UserRole.ADMIN_MUNICIPAL)
  @ApiOperation({ summary: 'Reprogramar viaje (cambiar fecha/hora/vehículo/conductores)' })
  reschedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RescheduleDto,
    @CurrentUser() user: User,
  ) {
    return this.service.reschedule(id, dto, user);
  }
}
