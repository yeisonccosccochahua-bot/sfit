import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ParseUUIDPipe, Req,
  BadRequestException, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Request } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { DriversService } from './drivers.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { ChangeDriverStatusDto } from './dto/change-driver-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole } from '../../entities/user.entity';
import { DriverStatus } from '../../entities/driver.entity';
import { UploadsService } from '../uploads/uploads.service';
import { normalizeSpanishFields } from '../../shared/normalize-fields';

@ApiTags('Conductores')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/drivers')
export class DriversController {
  constructor(
    private readonly service: DriversService,
    private readonly uploads: UploadsService,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN_MUNICIPAL, UserRole.FISCAL, UserRole.OPERADOR_EMPRESA, UserRole.INSPECTOR)
  @ApiQuery({ name: 'company_id', required: false })
  @ApiQuery({ name: 'status',     required: false, enum: DriverStatus })
  @ApiQuery({ name: 'search',     required: false })
  @ApiQuery({ name: 'page',       required: false, type: Number })
  @ApiQuery({ name: 'limit',      required: false, type: Number })
  findAll(
    @CurrentUser() user: User,
    @Query('company_id') company_id?: string,
    @Query('status')     status?: DriverStatus,
    @Query('search')     search?: string,
    @Query('page')       page  = 1,
    @Query('limit')      limit = 20,
  ) {
    // Operators with assigned company see only that company's drivers
    const effective_company_id =
      user.role === UserRole.OPERADOR_EMPRESA && user.company_id
        ? (company_id ?? user.company_id)
        : company_id;
    return this.service.findAll(user.municipality_id!, { company_id: effective_company_id, status, search, page: +page, limit: +limit });
  }

  @Get(':id')
  @Roles(UserRole.ADMIN_MUNICIPAL, UserRole.FISCAL, UserRole.OPERADOR_EMPRESA, UserRole.INSPECTOR)
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.findOne(id, user.municipality_id!);
  }

  @Post()
  @Roles(UserRole.ADMIN_MUNICIPAL, UserRole.OPERADOR_EMPRESA)
  @ApiOperation({ summary: 'Crear conductor (acepta JSON o multipart con foto)' })
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseInterceptors(FileInterceptor('foto', { storage: memoryStorage() }))
  async create(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: User,
  ) {
    // Use req.body directly to bypass global ValidationPipe for multipart requests
    const body: Record<string, any> = { ...(req.body || {}) };
    // Normalize Spanish fields (multipart bypasses our Express middleware)
    normalizeSpanishFields(body);

    // Upload photo if provided
    if (file) {
      const { url } = await this.uploads.saveFile(file, 'drivers');
      body.photo_url = url;
    }

    if (!body.name) throw new BadRequestException('name (o nombres+apellidos) es requerido');
    if (!body.dni)  throw new BadRequestException('dni es requerido');
    if (!body.company_id) throw new BadRequestException('company_id es requerido');

    const dto: CreateDriverDto = body as CreateDriverDto;
    return this.service.create(dto, user.municipality_id!);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN_MUNICIPAL, UserRole.OPERADOR_EMPRESA)
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseInterceptors(FileInterceptor('foto', { storage: memoryStorage() }))
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: User,
  ) {
    const body: Record<string, any> = { ...(req.body || {}) };
    normalizeSpanishFields(body);
    if (file) {
      const { url } = await this.uploads.saveFile(file, 'drivers');
      body.photo_url = url;
    }
    return this.service.update(id, body as UpdateDriverDto, user.municipality_id!);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN_MUNICIPAL, UserRole.OPERADOR_EMPRESA)
  @ApiOperation({ summary: 'Cambiar estado del conductor (con auditoría)' })
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeDriverStatusDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.socket.remoteAddress;
    return this.service.changeStatus(id, dto.status, dto.reason, user.municipality_id!, user.id, ip);
  }

  @Patch(':id/estado')
  @Roles(UserRole.ADMIN_MUNICIPAL, UserRole.OPERADOR_EMPRESA)
  @ApiOperation({ summary: 'Alias: Cambiar estado del conductor (campos en español)' })
  changeStatusAlias(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, string>,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    const statusValue = (body.status ?? body.estado) as DriverStatus;
    if (!Object.values(DriverStatus).includes(statusValue)) {
      throw new BadRequestException(`estado debe ser uno de: ${Object.values(DriverStatus).join(', ')}`);
    }
    const reason = body.reason ?? body.motivo_inactividad ?? body.motivo_estado;
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.socket.remoteAddress;
    return this.service.changeStatus(id, statusValue, reason, user.municipality_id!, user.id, ip);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN_MUNICIPAL)
  @ApiOperation({ summary: 'Eliminar conductor' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.remove(id, user.municipality_id!);
  }
}
