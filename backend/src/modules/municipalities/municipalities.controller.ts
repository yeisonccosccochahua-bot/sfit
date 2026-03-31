import { Controller, Get, Patch, Param, Body, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MunicipalitiesService } from './municipalities.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole, User } from '../../entities';

@ApiTags('municipalities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/municipalities')
export class MunicipalitiesController {
  constructor(private readonly service: MunicipalitiesService) {}

  @Get(':id/config')
  @Roles(UserRole.ADMIN_MUNICIPAL, UserRole.FISCAL)
  @ApiOperation({ summary: 'Obtener configuración de la municipalidad' })
  getConfig(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.service.getConfig(id, user.municipality_id!);
  }

  @Patch(':id/config')
  @Roles(UserRole.ADMIN_MUNICIPAL)
  @ApiOperation({ summary: 'Actualizar configuración de la municipalidad' })
  updateConfig(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, any>,
    @CurrentUser() user: User,
  ) {
    return this.service.updateConfig(id, body, user.municipality_id!);
  }
}
