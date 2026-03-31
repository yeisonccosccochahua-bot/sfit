import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ParseUUIDPipe, Res, Req,
  BadRequestException, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response, Request } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { ChangeVehicleStatusDto } from './dto/change-vehicle-status.dto';
import { NormalizeVehiclePipe } from './dto/normalize-vehicle.pipe';
import { VehicleStatus } from '../../entities/vehicle.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole } from '../../entities/user.entity';
import { UploadsService } from '../uploads/uploads.service';
import { normalizeSpanishFields } from '../../shared/normalize-fields';

@ApiTags('Vehículos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/vehicles')
export class VehiclesController {
  constructor(
    private readonly service: VehiclesService,
    private readonly uploads: UploadsService,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN_MUNICIPAL, UserRole.FISCAL, UserRole.OPERADOR_EMPRESA, UserRole.INSPECTOR)
  @ApiQuery({ name: 'company_id', required: false })
  @ApiQuery({ name: 'status',     required: false, enum: VehicleStatus })
  @ApiQuery({ name: 'search',     required: false })
  @ApiQuery({ name: 'page',       required: false, type: Number })
  @ApiQuery({ name: 'limit',      required: false, type: Number })
  findAll(
    @CurrentUser() user: User,
    @Query('company_id') company_id?: string,
    @Query('status')     status?: VehicleStatus,
    @Query('search')     search?: string,
    @Query('page')       page  = 1,
    @Query('limit')      limit = 20,
  ) {
    // Operators with an assigned company only see that company's vehicles
    const operator_company_id =
      user.role === UserRole.OPERADOR_EMPRESA && user.company_id
        ? user.company_id
        : undefined;
    return this.service.findAll(user.municipality_id!, {
      company_id: company_id ?? operator_company_id,
      status, search, page: +page, limit: +limit,
    });
  }

  @Get(':id')
  @Roles(UserRole.ADMIN_MUNICIPAL, UserRole.FISCAL, UserRole.OPERADOR_EMPRESA, UserRole.INSPECTOR)
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.findOne(id, user.municipality_id!);
  }

  @Post()
  @Roles(UserRole.ADMIN_MUNICIPAL, UserRole.OPERADOR_EMPRESA)
  @ApiOperation({ summary: 'Crear vehículo y generar QR (acepta JSON o multipart con foto)' })
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

    // Convert numeric strings from form data
    if (typeof body.year === 'string') body.year = +body.year;
    if (typeof body.capacity === 'string') body.capacity = +body.capacity;

    // Upload photo if provided
    if (file) {
      const { url } = await this.uploads.saveFile(file, 'vehicles');
      body.photo_url = url;
    }

    if (!body.plate) throw new BadRequestException('plate es requerido');
    if (!body.company_id) throw new BadRequestException('company_id es requerido');

    const dto: CreateVehicleDto = body as CreateVehicleDto;
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
    if (typeof body.year === 'string') body.year = +body.year;
    if (typeof body.capacity === 'string') body.capacity = +body.capacity;
    if (file) {
      const { url } = await this.uploads.saveFile(file, 'vehicles');
      body.photo_url = url;
    }
    return this.service.update(id, body as UpdateVehicleDto, user.municipality_id!);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN_MUNICIPAL, UserRole.OPERADOR_EMPRESA)
  @ApiOperation({ summary: 'Cambiar estado del vehículo (con auditoría)' })
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeVehicleStatusDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.socket.remoteAddress;
    return this.service.changeStatus(id, dto.status, dto.reason, user.municipality_id!, user.id, ip);
  }

  @Get('verify-qr/:qrCode')
  @Roles(UserRole.ADMIN_MUNICIPAL, UserRole.FISCAL, UserRole.OPERADOR_EMPRESA, UserRole.INSPECTOR)
  @ApiOperation({ summary: 'Verificar autenticidad de QR (valida HMAC)' })
  verifyQr(@Param('qrCode') qrCode: string) {
    return this.service.verifyQr(qrCode);
  }

  @Get(':id/qr')
  @Roles(UserRole.ADMIN_MUNICIPAL, UserRole.FISCAL, UserRole.OPERADOR_EMPRESA, UserRole.INSPECTOR)
  @ApiOperation({ summary: 'Obtener imagen QR del vehículo (data URL PNG)' })
  async getQrImage(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Res() res: Response,
  ) {
    const dataUrl = await this.service.getQrImage(id, user.municipality_id!);
    const base64 = dataUrl.split(',')[1];
    const img = Buffer.from(base64, 'base64');
    res.setHeader('Content-Type', 'image/png');
    res.send(img);
  }

  @Post(':id/regenerate-qr')
  @Roles(UserRole.ADMIN_MUNICIPAL, UserRole.OPERADOR_EMPRESA)
  @ApiOperation({ summary: 'Regenerar QR code del vehículo' })
  regenerateQr(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.regenerateQr(id, user.municipality_id!);
  }

  /** Alias: same as regenerate-qr */
  @Post(':id/qr/regenerate')
  @Roles(UserRole.ADMIN_MUNICIPAL, UserRole.OPERADOR_EMPRESA)
  @ApiOperation({ summary: 'Alias: Regenerar QR code del vehículo' })
  regenerateQrAlias(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.regenerateQr(id, user.municipality_id!);
  }

  /** Alias: same as PATCH :id/status — accepts Spanish field names */
  @Patch(':id/estado')
  @Roles(UserRole.ADMIN_MUNICIPAL, UserRole.OPERADOR_EMPRESA)
  @ApiOperation({ summary: 'Alias: Cambiar estado del vehículo (campos en español)' })
  changeStatusAlias(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, string>,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    const statusValue = (body.status ?? body.estado) as VehicleStatus;
    if (!Object.values(VehicleStatus).includes(statusValue)) {
      throw new BadRequestException(`estado debe ser uno de: ${Object.values(VehicleStatus).join(', ')}`);
    }
    const reason = body.reason ?? body.motivo_estado ?? body.motivo_inactividad;
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.socket.remoteAddress;
    return this.service.changeStatus(id, statusValue, reason, user.municipality_id!, user.id, ip);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN_MUNICIPAL)
  @ApiOperation({ summary: 'Eliminar vehículo' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.remove(id, user.municipality_id!);
  }
}
