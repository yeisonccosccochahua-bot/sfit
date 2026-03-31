import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';

import { Vehicle } from '../../entities/vehicle.entity';
import { Trip, TripStatus } from '../../entities/trip.entity';
import { TripDriver } from '../../entities/trip-driver.entity';
import { Driver } from '../../entities/driver.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { Report, ReportType, ReportStatus } from '../../entities/report.entity';
import { User } from '../../entities/user.entity';
import { ValidateQrDto } from './dto/validate-qr.dto';

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────
export interface DriverInfo {
  name: string;
  dni_last_4: string;
  photo_url: string | null;
  role: string;
  fatigue_status: string;
}

export interface ActiveTripInfo {
  id: string;
  route: { origin: string; destination: string };
  drivers: DriverInfo[];
  start_time: Date;
  estimated_arrival: Date;
  status: string;
}

export interface QrScanResult {
  vehicle: { plate: string; company_name: string; qr_valid: true };
  active_trip: ActiveTripInfo | null;
  can_report: boolean;
}

export interface QrGenerateResult {
  vehicle_id: string;
  plate: string;
  qr_url: string;
  qr_data_url: string;    // base64 PNG
  qr_svg: string;         // SVG con placa embebida
}

@Injectable()
export class QrService {
  private readonly logger = new Logger(QrService.name);

  constructor(
    @InjectRepository(Vehicle)
    private vehicleRepo: Repository<Vehicle>,
    @InjectRepository(Trip)
    private tripRepo: Repository<Trip>,
    @InjectRepository(TripDriver)
    private tripDriverRepo: Repository<TripDriver>,
    @InjectRepository(Driver)
    private driverRepo: Repository<Driver>,
    @InjectRepository(AuditLog)
    private auditRepo: Repository<AuditLog>,
    @InjectRepository(Report)
    private reportRepo: Repository<Report>,
    private config: ConfigService,
  ) {}

  // ─────────────────────────────────────────────────
  // SCAN QR  (público)
  // ─────────────────────────────────────────────────
  async scan(qrCode: string): Promise<QrScanResult> {
    const vehicle = await this.vehicleRepo.findOne({
      where: { qr_code: qrCode },
      relations: ['company'],
    });

    if (!vehicle) {
      throw new UnauthorizedException('QR no válido o falsificado');
    }

    // Validar HMAC
    if (!this.validateHmac(vehicle.qr_code, vehicle.qr_hmac)) {
      this.logger.warn(`HMAC inválido para qr_code: ${qrCode} (vehicle: ${vehicle.id})`);
      throw new UnauthorizedException('QR no válido o falsificado');
    }

    // Buscar viaje activo
    const activeTrip = await this.tripRepo.findOne({
      where: { vehicle_id: vehicle.id, status: TripStatus.EN_CURSO },
      relations: ['route'],
    });

    if (!activeTrip) {
      return {
        vehicle: { plate: vehicle.plate, company_name: vehicle.company.name, qr_valid: true },
        active_trip: null,
        can_report: false,
      };
    }

    // Obtener conductores del viaje con estado de fatiga
    const tripDrivers = await this.tripDriverRepo.find({
      where: { trip_id: activeTrip.id },
      relations: ['driver'],
    });

    const drivers: DriverInfo[] = tripDrivers.map((td) => ({
      name: td.driver.name,
      dni_last_4: td.driver.dni?.slice(-4) ?? '****',
      photo_url: td.driver.license_photo_url ?? null,
      role: td.role,
      fatigue_status: td.fatigue_check_result ?? td.driver.status,
    }));

    const estimatedMinutes = (activeTrip.route as any)?.estimated_duration_minutes ?? 0;
    const estimated_arrival = new Date(
      activeTrip.start_time.getTime() + estimatedMinutes * 60 * 1000,
    );

    return {
      vehicle: { plate: vehicle.plate, company_name: vehicle.company.name, qr_valid: true },
      active_trip: {
        id: activeTrip.id,
        route: {
          origin: (activeTrip.route as any).origin,
          destination: (activeTrip.route as any).destination,
        },
        drivers,
        start_time: activeTrip.start_time,
        estimated_arrival,
        status: activeTrip.status,
      },
      can_report: true,
    };
  }

  // ─────────────────────────────────────────────────
  // VALIDATE (ciudadano confirma conductor)
  // ─────────────────────────────────────────────────
  async validate(dto: ValidateQrDto, user: User): Promise<{ recorded: boolean; alert_created: boolean }> {
    const vehicle = await this.vehicleRepo.findOne({ where: { qr_code: dto.qr_code } });
    if (!vehicle || !this.validateHmac(vehicle.qr_code, vehicle.qr_hmac)) {
      throw new UnauthorizedException('QR no válido');
    }

    const trip = await this.tripRepo.findOne({
      where: { id: dto.trip_id, vehicle_id: vehicle.id },
    });
    if (!trip) throw new NotFoundException('Viaje no encontrado para este vehículo');

    await this.audit(user.id, 'QR_VALIDATE', vehicle.id, {
      trip_id: dto.trip_id,
      is_same_driver: dto.is_same_driver,
      citizen_id: user.id,
    });

    let alert_created = false;

    if (!dto.is_same_driver) {
      // Crear reporte automático de conductor diferente
      const report = this.reportRepo.create({
        trip_id: dto.trip_id,
        citizen_id: user.id,
        type: ReportType.CONDUCTOR_DIFERENTE,
        description: 'El ciudadano reportó que el conductor en el vehículo no coincide con el registrado en el sistema.',
        status: ReportStatus.PENDIENTE,
        validation_score: null,
      });
      await this.reportRepo.save(report);

      this.logger.warn(
        `Alerta: conductor diferente en viaje ${dto.trip_id} (vehículo ${vehicle.plate}), reportado por ciudadano ${user.id}`,
      );
      alert_created = true;
    }

    return { recorded: true, alert_created };
  }

  // ─────────────────────────────────────────────────
  // GENERATE  (operador ve el QR en imagen)
  // ─────────────────────────────────────────────────
  async generate(vehicleId: string, user: User): Promise<QrGenerateResult> {
    const vehicle = await this.vehicleRepo.findOne({
      where: { id: vehicleId },
      relations: ['company'],
    });
    if (!vehicle) throw new NotFoundException(`Vehículo ${vehicleId} no encontrado`);

    // Solo operadores de la misma municipalidad
    if (vehicle.company.municipality_id !== user.municipality_id) {
      throw new ForbiddenException('Sin permiso para ver el QR de este vehículo');
    }

    const qrUrl = this.buildQrUrl(vehicle.qr_code);
    const qr_data_url = await QRCode.toDataURL(qrUrl, {
      width: 300,
      margin: 2,
      color: { dark: '#1B4F72', light: '#FFFFFF' },
    });

    // SVG con placa embebida debajo del QR
    const qrSvgString = await QRCode.toString(qrUrl, {
      type: 'svg',
      width: 300,
      margin: 2,
      color: { dark: '#1B4F72', light: '#FFFFFF' },
    });
    const qr_svg = this.embedPlateInSvg(qrSvgString, vehicle.plate, qrUrl);

    return {
      vehicle_id: vehicle.id,
      plate: vehicle.plate,
      qr_url: qrUrl,
      qr_data_url,
      qr_svg,
    };
  }

  // ─────────────────────────────────────────────────
  // REGENERATE  (admin invalida QR anterior)
  // ─────────────────────────────────────────────────
  async regenerate(
    vehicleId: string,
    reason: string,
    user: User,
  ): Promise<{ vehicle_id: string; plate: string; new_qr_url: string; qr_data_url: string }> {
    const vehicle = await this.vehicleRepo.findOne({ where: { id: vehicleId } });
    if (!vehicle) throw new NotFoundException(`Vehículo ${vehicleId} no encontrado`);

    const old_qr_code = vehicle.qr_code;
    const new_qr_code = uuidv4();
    const new_qr_hmac = this.computeHmac(new_qr_code);

    vehicle.qr_code = new_qr_code;
    vehicle.qr_hmac = new_qr_hmac;
    await this.vehicleRepo.save(vehicle);

    await this.audit(user.id, 'QR_REGENERATE', vehicleId, {
      old_qr_code,
      new_qr_code,
      reason,
      admin_id: user.id,
    });

    const qrUrl = this.buildQrUrl(new_qr_code);
    const qr_data_url = await QRCode.toDataURL(qrUrl, {
      width: 300,
      margin: 2,
      color: { dark: '#1B4F72', light: '#FFFFFF' },
    });

    this.logger.log(`QR regenerado para vehículo ${vehicle.plate} (motivo: ${reason})`);
    return { vehicle_id: vehicle.id, plate: vehicle.plate, new_qr_url: qrUrl, qr_data_url };
  }

  // ─────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────
  computeHmac(qrCode: string): string {
    const secret = this.config.get<string>('QR_HMAC_SECRET', 'sfit_qr_hmac_secret_change_in_prod');
    return crypto.createHmac('sha256', secret).update(qrCode).digest('hex');
  }

  validateHmac(qrCode: string, storedHmac: string): boolean {
    const expected = this.computeHmac(qrCode);
    // timingSafeEqual para prevenir timing attacks
    try {
      return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(storedHmac, 'hex'));
    } catch {
      return false;
    }
  }

  private buildQrUrl(qrCode: string): string {
    const base = this.config.get<string>('QR_BASE_URL', 'https://sfit.gob.pe/scan');
    return `${base}/${qrCode}`;
  }

  private embedPlateInSvg(svgString: string, plate: string, url: string): string {
    // Ampliar el SVG para incluir texto de placa y URL debajo
    const heightMatch = svgString.match(/height="(\d+)"/);
    const widthMatch = svgString.match(/width="(\d+)"/);
    const originalHeight = parseInt(heightMatch?.[1] ?? '300');
    const width = parseInt(widthMatch?.[1] ?? '300');
    const newHeight = originalHeight + 48;

    const textBlock = `
  <rect x="0" y="${originalHeight}" width="${width}" height="48" fill="#1B4F72"/>
  <text x="${width / 2}" y="${originalHeight + 18}" text-anchor="middle"
        font-family="monospace" font-size="14" font-weight="bold" fill="#FFFFFF">${plate}</text>
  <text x="${width / 2}" y="${originalHeight + 36}" text-anchor="middle"
        font-family="sans-serif" font-size="9" fill="#BDC3C7">Escanea para verificar</text>`;

    return svgString
      .replace(`height="${originalHeight}"`, `height="${newHeight}"`)
      .replace('</svg>', `${textBlock}</svg>`);
  }

  private async audit(userId: string, action: string, entityId: string, details: Record<string, any>) {
    const log = this.auditRepo.create({
      user_id: userId,
      action,
      entity_type: 'Vehicle',
      entity_id: entityId,
      details_json: details,
    });
    await this.auditRepo.save(log).catch(() => undefined);
  }
}
