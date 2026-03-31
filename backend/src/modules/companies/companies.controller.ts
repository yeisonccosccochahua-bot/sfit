import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ParseUUIDPipe, Req,
  BadRequestException,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { ChangeCompanyStatusDto } from './dto/change-company-status.dto';
import { NormalizeCompanyPipe } from './dto/normalize-company.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole } from '../../entities/user.entity';
import { CompanyStatus } from '../../entities/company.entity';

@ApiTags('Empresas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/companies')
export class CompaniesController {
  constructor(private readonly service: CompaniesService) {}

  @Get()
  @Roles(UserRole.ADMIN_MUNICIPAL, UserRole.FISCAL, UserRole.OPERADOR_EMPRESA)
  @ApiOperation({ summary: 'Listar empresas de la municipalidad' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page',   required: false, type: Number })
  @ApiQuery({ name: 'limit',  required: false, type: Number })
  findAll(
    @CurrentUser() user: User,
    @Query('search') search?: string,
    @Query('page')   page  = 1,
    @Query('limit')  limit = 20,
  ) {
    return this.service.findAll(user.municipality_id!, search, +page, +limit);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN_MUNICIPAL, UserRole.FISCAL, UserRole.OPERADOR_EMPRESA)
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.findOne(id, user.municipality_id!);
  }

  @Post()
  @Roles(UserRole.ADMIN_MUNICIPAL)
  @ApiOperation({ summary: 'Crear empresa (ADMIN_MUNICIPAL)' })
  create(@Body(NormalizeCompanyPipe) dto: CreateCompanyDto, @CurrentUser() user: User) {
    return this.service.create(dto, user.municipality_id!);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN_MUNICIPAL)
  update(@Param('id', ParseUUIDPipe) id: string, @Body(NormalizeCompanyPipe) dto: UpdateCompanyDto, @CurrentUser() user: User) {
    return this.service.update(id, dto, user.municipality_id!);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN_MUNICIPAL)
  @ApiOperation({ summary: 'Cambiar estado de empresa (con auditoría)' })
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeCompanyStatusDto,
    @CurrentUser() user: User,
    @Req() req: ExpressRequest,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.socket.remoteAddress;
    return this.service.changeStatus(id, dto.status, user.municipality_id!, user.id, ip);
  }

  /** Alias: same as PATCH :id/status — accepts Spanish field names */
  @Patch(':id/estado')
  @Roles(UserRole.ADMIN_MUNICIPAL)
  @ApiOperation({ summary: 'Alias: Cambiar estado de empresa (campos en español)' })
  changeStatusAlias(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, string>,
    @CurrentUser() user: User,
    @Req() req: ExpressRequest,
  ) {
    const statusValue = (body.status ?? body.estado) as CompanyStatus;
    if (!Object.values(CompanyStatus).includes(statusValue)) {
      throw new BadRequestException(`estado debe ser uno de: ${Object.values(CompanyStatus).join(', ')}`);
    }
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.socket.remoteAddress;
    return this.service.changeStatus(id, statusValue, user.municipality_id!, user.id, ip);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN_MUNICIPAL)
  @ApiOperation({ summary: 'Eliminar empresa (solo si no tiene conductores/vehículos activos)' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.remove(id, user.municipality_id!);
  }
}
