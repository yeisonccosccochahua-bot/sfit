import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';

import { QrService } from './qr.service';
import { ValidateQrDto } from './dto/validate-qr.dto';
import { RegenerateQrDto } from './dto/regenerate-qr.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MunicipalityGuard } from '../auth/guards/municipality.guard';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole } from '../../entities/user.entity';

@ApiTags('QR')
@UseGuards(JwtAuthGuard, RolesGuard, MunicipalityGuard)
@Controller('api/qr')
export class QrController {
  constructor(private qrService: QrService) {}

  // ─────────────────────────────────────────────────
  // GET /api/qr/scan/:qr_code  — PÚBLICO
  // ─────────────────────────────────────────────────
  @Get('scan/:qr_code')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Escanear QR de vehículo (público)',
    description:
      'Valida el HMAC del QR. Si es válido, retorna datos del vehículo, viaje activo y conductores. ' +
      'Rate limit: 30 escaneos/minuto por IP.',
  })
  @ApiParam({ name: 'qr_code', description: 'UUID codificado en el QR del vehículo' })
  @ApiResponse({
    status: 200,
    description: 'QR válido',
    schema: {
      example: {
        vehicle: { plate: 'ABC-123', company_name: 'Trans Cotabambas SAC', qr_valid: true },
        active_trip: {
          id: 'uuid',
          route: { origin: 'Cusco', destination: 'Tambobamba' },
          drivers: [{ name: 'Juan Quispe', dni_last_4: '5678', role: 'PRINCIPAL', fatigue_status: 'APTO' }],
          start_time: '2026-03-26T06:00:00Z',
          estimated_arrival: '2026-03-26T11:00:00Z',
          status: 'EN_CURSO',
        },
        can_report: true,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'QR no válido o falsificado' })
  scan(@Param('qr_code') qrCode: string) {
    return this.qrService.scan(qrCode);
  }

  // ─────────────────────────────────────────────────
  // POST /api/qr/validate  — PÚBLICO (verifica QR content)
  // ─────────────────────────────────────────────────
  @Post('validate')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validar QR content (público)',
    description:
      'Recibe qr_content (URL o código directo), valida el HMAC y retorna datos del vehículo. ' +
      'Retorna { valid: true, vehicle } o { valid: false, reason }.',
  })
  @ApiResponse({
    status: 200,
    schema: { example: { valid: true, vehicle: { plate: 'ABC-123', company_name: 'Trans SAC', qr_valid: true } } },
  })
  async validatePublic(@Body() body: { qr_content: string }) {
    if (!body.qr_content) throw new BadRequestException('qr_content es requerido');
    // Extract QR code: if URL like https://*/scan/{code}, take last segment; otherwise use as-is
    let qrCode = body.qr_content.trim();
    const urlMatch = qrCode.match(/\/scan\/([^/?#]+)/);
    if (urlMatch) {
      qrCode = urlMatch[1];
    }
    try {
      const result = await this.qrService.scan(qrCode);
      return { valid: true, vehicle: result.vehicle };
    } catch {
      return { valid: false, reason: 'QR no válido o falsificado' };
    }
  }

  // ─────────────────────────────────────────────────
  // POST /api/qr/validate-driver  — CIUDADANO
  // ─────────────────────────────────────────────────
  @Post('validate-driver')
  @Roles(UserRole.CIUDADANO)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Validar si el conductor coincide (ciudadano)',
    description:
      'El ciudadano confirma si el conductor en el vehículo es el mismo que muestra el sistema. ' +
      'Si is_same_driver=false → se crea alerta automática de CONDUCTOR_DIFERENTE.',
  })
  @ApiResponse({
    status: 200,
    schema: { example: { recorded: true, alert_created: false } },
  })
  validate(@Body() dto: ValidateQrDto, @CurrentUser() user: User) {
    return this.qrService.validate(dto, user);
  }

  // ─────────────────────────────────────────────────
  // GET /api/qr/generate/:vehicleId  — OPERADOR
  // ─────────────────────────────────────────────────
  @Get('generate/:vehicleId')
  @Roles(UserRole.OPERADOR_EMPRESA, UserRole.ADMIN_MUNICIPAL, UserRole.FISCAL)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Generar imagen QR de un vehículo',
    description:
      'Retorna el QR como base64 PNG y SVG con la placa embebida. ' +
      'URL codificada: https://sfit.gob.pe/scan/{qr_code}',
  })
  @ApiParam({ name: 'vehicleId', type: String })
  @ApiResponse({ status: 200, description: 'QR generado (base64 + SVG)' })
  @ApiResponse({ status: 404, description: 'Vehículo no encontrado' })
  generate(@Param('vehicleId') vehicleId: string, @CurrentUser() user: User) {
    return this.qrService.generate(vehicleId, user);
  }

  // ─────────────────────────────────────────────────
  // POST /api/qr/regenerate/:vehicleId  — ADMIN
  // ─────────────────────────────────────────────────
  @Post('regenerate/:vehicleId')
  @Roles(UserRole.ADMIN_MUNICIPAL)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Regenerar QR de vehículo (invalida el anterior)',
    description:
      'Genera nuevo qr_code y qr_hmac. Invalida el QR anterior. ' +
      'Usos: QR dañado o comprometido. Requiere motivo.',
  })
  @ApiParam({ name: 'vehicleId', type: String })
  @ApiResponse({ status: 201, description: 'Nuevo QR generado' })
  @ApiResponse({ status: 404, description: 'Vehículo no encontrado' })
  regenerate(
    @Param('vehicleId') vehicleId: string,
    @Body() dto: RegenerateQrDto,
    @CurrentUser() user: User,
  ) {
    return this.qrService.regenerate(vehicleId, dto.reason, user);
  }
}
