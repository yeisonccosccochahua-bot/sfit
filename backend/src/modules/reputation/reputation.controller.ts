import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';

import { ReputationService } from './reputation.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { User, UserRole } from '../../entities';

const STAFF = [UserRole.FISCAL, UserRole.ADMIN_MUNICIPAL];

@ApiTags('Reputación')
@ApiBearerAuth()
@Controller('api/reputation')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReputationController {
  constructor(private readonly service: ReputationService) {}

  // ── Rankings declared BEFORE /:id-style routes ─────────────────────────────

  @Get('ranking/drivers')
  @Roles(...STAFF)
  @ApiOperation({ summary: 'Top 20 conductores por reputación en la municipalidad' })
  rankingDrivers(@CurrentUser() user: User) {
    return this.service.rankingDrivers(user.municipality_id!);
  }

  @Get('ranking/companies')
  @Roles(...STAFF)
  @ApiOperation({ summary: 'Top empresas por reputación en la municipalidad' })
  rankingCompanies(@CurrentUser() user: User) {
    return this.service.rankingCompanies(user.municipality_id!);
  }

  // ── Detail endpoints ────────────────────────────────────────────────────────

  @Get('driver/:id')
  @Roles(...STAFF)
  @ApiOperation({ summary: 'Score de reputación de un conductor + desglose de factores' })
  @ApiParam({ name: 'id', description: 'UUID del conductor' })
  @ApiResponse({ status: 200, description: 'Desglose de reputación calculado y guardado' })
  @ApiResponse({ status: 404, description: 'Conductor no encontrado' })
  getDriverReputation(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.calculateDriverReputation(id);
  }

  @Get('vehicle/:id')
  @Roles(...STAFF)
  @ApiOperation({ summary: 'Score de reputación de un vehículo' })
  @ApiParam({ name: 'id', description: 'UUID del vehículo' })
  getVehicleReputation(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.calculateVehicleReputation(id);
  }

  @Get('company/:id')
  @Roles(...STAFF)
  @ApiOperation({ summary: 'Score de reputación de una empresa' })
  @ApiParam({ name: 'id', description: 'UUID de la empresa' })
  getCompanyReputation(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.calculateCompanyReputation(id);
  }
}
