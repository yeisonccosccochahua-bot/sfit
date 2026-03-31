import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Request } from 'express';

import { FatigueEngineService } from './fatigue-engine.service';
import { FatigueHistoryQueryDto } from './dto/fatigue-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MunicipalityGuard } from '../auth/guards/municipality.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../entities/user.entity';

@ApiTags('Fatigue')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, MunicipalityGuard)
@Controller('api/fatigue')
export class FatigueController {
  constructor(private fatigueEngine: FatigueEngineService) {}

  // ──────────────────────────────────────────────
  // GET /api/fatigue/dashboard
  // ──────────────────────────────────────────────
  @Get('dashboard')
  @Roles(UserRole.ADMIN_MUNICIPAL, UserRole.FISCAL, UserRole.INSPECTOR)
  @ApiOperation({
    summary: 'Panel de fatiga municipal',
    description: 'Lista conductores en RIESGO y NO_APTO de la municipalidad.',
  })
  @ApiResponse({ status: 200, description: 'Conductores en riesgo y no aptos con estadísticas' })
  @ApiResponse({ status: 403, description: 'Sin permiso' })
  getDashboard(@Req() req: Request) {
    const municipalityId = (req as any).municipalityFilter;
    return this.fatigueEngine.getDashboard(municipalityId);
  }

  // ──────────────────────────────────────────────
  // GET /api/fatigue/evaluate/:driverId
  // ──────────────────────────────────────────────
  @Get('evaluate/:driverId')
  @Roles(UserRole.ADMIN_MUNICIPAL, UserRole.FISCAL, UserRole.INSPECTOR, UserRole.OPERADOR_EMPRESA)
  @ApiOperation({
    summary: 'Evaluar fatiga de un conductor ahora',
    description:
      'Calcula horas conducidas en las últimas 24h, descanso y determina estado. ' +
      'Guarda FatigueLog y actualiza driver.status.',
  })
  @ApiParam({ name: 'driverId', type: String })
  @ApiResponse({ status: 200, description: 'Resultado de evaluación' })
  @ApiResponse({ status: 404, description: 'Conductor no encontrado' })
  evaluate(@Param('driverId', ParseUUIDPipe) driverId: string) {
    return this.fatigueEngine.evaluateDriver(driverId);
  }

  // ──────────────────────────────────────────────
  // GET /api/fatigue/continuous/:driverId
  // ──────────────────────────────────────────────
  @Get('continuous/:driverId')
  @Roles(UserRole.ADMIN_MUNICIPAL, UserRole.FISCAL, UserRole.INSPECTOR, UserRole.OPERADOR_EMPRESA)
  @ApiOperation({
    summary: 'Verificar conducción continua',
    description:
      'Si el conductor lleva ≥4h continuas → genera alerta (sin bloqueo).',
  })
  @ApiParam({ name: 'driverId', type: String })
  @ApiResponse({ status: 200, description: 'Estado de conducción continua' })
  checkContinuous(@Param('driverId', ParseUUIDPipe) driverId: string) {
    return this.fatigueEngine.checkContinuousDriving(driverId);
  }

  // ──────────────────────────────────────────────
  // GET /api/fatigue/history/:driverId
  // ──────────────────────────────────────────────
  @Get('history/:driverId')
  @Roles(UserRole.ADMIN_MUNICIPAL, UserRole.FISCAL, UserRole.INSPECTOR, UserRole.OPERADOR_EMPRESA)
  @ApiOperation({
    summary: 'Historial de evaluaciones de fatiga de un conductor',
    description: 'Paginado, orden cronológico inverso.',
  })
  @ApiParam({ name: 'driverId', type: String })
  @ApiResponse({ status: 200, description: 'Historial paginado de FatigueLogs' })
  @ApiResponse({ status: 404, description: 'Conductor no encontrado' })
  getHistory(
    @Param('driverId', ParseUUIDPipe) driverId: string,
    @Query() query: FatigueHistoryQueryDto,
  ) {
    return this.fatigueEngine.getHistory(driverId, query.page, query.limit);
  }
}
