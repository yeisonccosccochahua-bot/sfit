import {
  Controller, Get, Patch, Param, Body, Query,
  ParseUUIDPipe, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../entities';
import { User } from '../../entities';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  @Roles(UserRole.ADMIN_MUNICIPAL, UserRole.FISCAL)
  @ApiOperation({ summary: 'Listar usuarios de la municipalidad' })
  findAll(
    @CurrentUser() user: User,
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.service.findAll(user.municipality_id!, {
      role, status, search, page: +page, limit: +limit,
    });
  }

  @Patch(':id/company')
  @Roles(UserRole.ADMIN_MUNICIPAL)
  @ApiOperation({ summary: 'Asignar empresa a operador' })
  updateCompany(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { company_id: string | null },
    @CurrentUser() user: User,
  ) {
    return this.service.updateCompany(id, body.company_id, user.municipality_id!);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN_MUNICIPAL)
  @ApiOperation({ summary: 'Cambiar estado de usuario (ACTIVO/BLOQUEADO)' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { status: string },
    @CurrentUser() user: User,
  ) {
    return this.service.updateStatus(id, body.status, user.municipality_id!);
  }
}
