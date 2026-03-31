import * as crypto from 'crypto';
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';

import {
  Report,
  ReportType,
  ReportStatus,
  User,
  UserRole,
  UserStatus,
  Vehicle,
  Trip,
  TripStatus,
  AuditLog,
  IncentivePoint,
  IncentiveActionType,
  Notification,
  NotificationChannel,
  NotificationStatus,
} from '../../entities';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportQueryDto } from './dto/report-query.dto';
import { ValidateReportDto } from './dto/validate-report.dto';

export interface PaginatedReports {
  data: Report[];
  total: number;
  page: number;
  lastPage: number;
}

export interface ReportStats {
  total: number;
  today: number;
  by_status: Record<ReportStatus, number>;
  by_type:   Record<ReportType, number>;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectRepository(Report)       private reportRepo:       Repository<Report>,
    @InjectRepository(User)         private userRepo:         Repository<User>,
    @InjectRepository(Vehicle)      private vehicleRepo:      Repository<Vehicle>,
    @InjectRepository(Trip)         private tripRepo:         Repository<Trip>,
    @InjectRepository(AuditLog)     private auditRepo:        Repository<AuditLog>,
    @InjectRepository(IncentivePoint) private incentiveRepo:  Repository<IncentivePoint>,
    @InjectRepository(Notification) private notifRepo:        Repository<Notification>,
    private readonly config:         ConfigService,
  ) {}

  // ── HMAC helper (no dependency on QrService to keep modules decoupled) ─────
  private validateQrHmac(qrCode: string, storedHmac: string): boolean {
    const secret = this.config.get<string>('QR_HMAC_SECRET', 'sfit_qr_hmac_secret_change_in_prod');
    const expected = crypto.createHmac('sha256', secret).update(qrCode).digest('hex');
    try {
      return crypto.timingSafeEqual(
        Buffer.from(expected, 'hex'),
        Buffer.from(storedHmac, 'hex'),
      );
    } catch {
      return false;
    }
  }

  // ── CREATE — 5-layer anti-fraud ──────────────────────────────────────────────
  async create(dto: CreateReportDto, citizen: User, ip: string): Promise<Report> {

    // ── CAPA 1: Identidad real ─────────────────────────────────────────────────
    if (!citizen.dni) {
      throw new ForbiddenException('Se requiere DNI verificado para enviar reportes');
    }

    // Reload for fresh counters (another request might have incremented reports_today)
    const freshCitizen = await this.userRepo.findOneOrFail({ where: { id: citizen.id } });

    if (freshCitizen.status === UserStatus.BLOQUEADO) {
      throw new ForbiddenException('Su cuenta está bloqueada. No puede enviar reportes.');
    }

    // ── CAPA 3: Límite y reputación (checked early to avoid expensive DB ops) ──
    if (freshCitizen.reports_today >= 3) {
      throw new HttpException(
        'Ha alcanzado el límite de 3 reportes por día',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (freshCitizen.reputation_score < 30) {
      throw new ForbiddenException(
        'Su puntuación de reputación es insuficiente para enviar reportes (mínimo 30)',
      );
    }

    // ── CAPA 2: Contexto válido ────────────────────────────────────────────────
    const vehicle = await this.vehicleRepo.findOne({ where: { qr_code: dto.qr_code } });
    if (!vehicle) {
      throw new UnprocessableEntityException('QR inválido: vehículo no encontrado');
    }
    if (!this.validateQrHmac(vehicle.qr_code, vehicle.qr_hmac)) {
      this.logger.warn(
        `HMAC inválido en reporte. QR: ${dto.qr_code}, Ciudadano: ${citizen.id}`,
      );
      throw new UnprocessableEntityException('QR inválido o falsificado');
    }

    const trip = await this.tripRepo.findOne({
      where: { id: dto.trip_id, status: TripStatus.EN_CURSO },
    });
    if (!trip) {
      throw new UnprocessableEntityException('El viaje no existe o no está en curso');
    }
    if (trip.vehicle_id !== vehicle.id) {
      throw new UnprocessableEntityException('El QR escaneado no corresponde al vehículo del viaje');
    }

    // ── CAPA 4: Verificación cruzada ───────────────────────────────────────────
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1_000);

    const similarCount = await this.reportRepo
      .createQueryBuilder('r')
      .where('r.trip_id = :tripId',     { tripId: dto.trip_id })
      .andWhere('r.type = :type',        { type: dto.type })
      .andWhere('r.created_at > :since', { since: thirtyMinAgo })
      .getCount();

    const hasSimilar  = similarCount >= 2;
    const reportStatus = hasSimilar ? ReportStatus.VALIDO : ReportStatus.EN_REVISION;

    let score = 50;
    if (freshCitizen.reputation_score > 80) score += 20;   // high-trust citizen
    if (dto.photo_url)                       score += 15;   // evidence attached
    if (hasSimilar)                          score += 15;   // corroborated
    score = Math.min(100, score);

    // ── Persist report ─────────────────────────────────────────────────────────
    const report = this.reportRepo.create({
      trip_id:          dto.trip_id,
      citizen_id:       citizen.id,
      type:             dto.type,
      description:      dto.description,
      photo_url:        dto.photo_url,
      status:           reportStatus,
      validation_score: score,
    });
    await this.reportRepo.save(report);

    // ── CAPA 5: Post-procesamiento ─────────────────────────────────────────────

    // 5a — Alerta prioritaria si conductor diferente
    if (!dto.is_same_driver) {
      await this.sendMunicipalityAlert(trip, vehicle.plate, report.id);
    }

    // 5b — AuditLog
    await this.auditRepo.save(
      this.auditRepo.create({
        user_id:      citizen.id,
        action:       'CREATE_REPORT',
        entity_type:  'Report',
        entity_id:    report.id,
        details_json: {
          type:           dto.type,
          status:         reportStatus,
          score,
          is_same_driver: dto.is_same_driver,
          vehicle_id:     vehicle.id,
        },
        ip,
      }),
    );

    // 5c — Incentive points (10 pts por reporte aceptado en el sistema)
    await this.incentiveRepo.save(
      this.incentiveRepo.create({
        citizen_id:  citizen.id,
        points:      10,
        action_type: IncentiveActionType.REPORTE_VALIDO,
        report_id:   report.id,
        date:        new Date().toISOString().split('T')[0],
      }),
    );

    // 5d — Actualizar contadores del ciudadano (atomic to avoid race conditions)
    await this.userRepo
      .createQueryBuilder()
      .update()
      .set({ total_points: () => 'total_points + 10', reports_today: () => 'reports_today + 1' })
      .where('id = :id', { id: freshCitizen.id })
      .execute();

    return report;
  }

  // ── FIND ALL ──────────────────────────────────────────────────────────────────
  async findAll(query: ReportQueryDto, user: User): Promise<PaginatedReports> {
    const qb = this.reportRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.citizen', 'citizen')
      .leftJoinAndSelect('r.trip',    'trip')
      .leftJoinAndSelect('trip.route',   'route')
      .leftJoinAndSelect('trip.vehicle', 'vehicle')
      .orderBy('r.created_at', 'DESC');

    // Role-based scoping
    if (user.role === UserRole.CIUDADANO) {
      qb.where('r.citizen_id = :citizenId', { citizenId: user.id });
    } else {
      // FISCAL / ADMIN_MUNICIPAL — scope to municipality via trip join
      qb.where('trip.municipality_id = :municipalityId', {
        municipalityId: user.municipality_id,
      });
    }

    if (query.status)    qb.andWhere('r.status = :status',     { status:    query.status });
    if (query.type)      qb.andWhere('r.type = :type',         { type:      query.type });
    if (query.trip_id)   qb.andWhere('r.trip_id = :tripId',    { tripId:    query.trip_id });
    if (query.date_from) qb.andWhere('r.created_at >= :from',  { from:      query.date_from });
    if (query.date_to)   qb.andWhere('r.created_at <= :to',    { to:        query.date_to });

    const [data, total] = await qb
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();

    return {
      data,
      total,
      page:     query.page,
      lastPage: Math.ceil(total / query.limit) || 1,
    };
  }

  // ── FIND ONE ──────────────────────────────────────────────────────────────────
  async findOne(id: string, user: User): Promise<Report> {
    const report = await this.reportRepo.findOne({
      where: { id },
      relations: ['citizen', 'trip', 'trip.route', 'trip.vehicle'],
    });
    if (!report) throw new NotFoundException(`Reporte ${id} no encontrado`);

    this.assertAccess(report, user);
    return report;
  }

  // ── VALIDATE (FISCAL / ADMIN) ─────────────────────────────────────────────────
  async validate(id: string, dto: ValidateReportDto, user: User): Promise<Report> {
    const report = await this.reportRepo.findOne({
      where: { id },
      relations: ['citizen', 'trip'],
    });
    if (!report) throw new NotFoundException(`Reporte ${id} no encontrado`);

    if (report.trip.municipality_id !== user.municipality_id) {
      throw new ForbiddenException('No tiene permisos para validar este reporte');
    }

    const wasStatus = report.status;
    report.status   = dto.status;
    await this.reportRepo.save(report);

    // Reputation effects
    const citizen = await this.userRepo.findOneOrFail({ where: { id: report.citizen_id } });

    if (dto.status === ReportStatus.INVALIDO) {
      // Penalizar
      citizen.reputation_score = Math.max(0, citizen.reputation_score - 10);
      if (citizen.reputation_score < 30) {
        citizen.status = UserStatus.BLOQUEADO;
        this.logger.warn(`Ciudadano ${citizen.id} bloqueado por baja reputación`);
      }
      await this.userRepo.save(citizen);
    } else if (dto.status === ReportStatus.VALIDO && wasStatus !== ReportStatus.VALIDO) {
      // Bonus de reputación
      citizen.reputation_score = Math.min(100, citizen.reputation_score + 2);
      await this.userRepo.save(citizen);

      // Puntos bonus por validación positiva
      await this.incentiveRepo.save(
        this.incentiveRepo.create({
          citizen_id:  citizen.id,
          points:      5,
          action_type: IncentiveActionType.REPORTE_CON_SANCION,
          report_id:   report.id,
          date:        new Date().toISOString().split('T')[0],
        }),
      );
      await this.userRepo
        .createQueryBuilder()
        .update()
        .set({ total_points: () => 'total_points + 5' })
        .where('id = :id', { id: citizen.id })
        .execute();
    }

    // AuditLog
    await this.auditRepo.save(
      this.auditRepo.create({
        user_id:      user.id,
        action:       `VALIDATE_REPORT_${dto.status}`,
        entity_type:  'Report',
        entity_id:    report.id,
        details_json: { status: dto.status, citizen_id: citizen.id },
      }),
    );

    return report;
  }

  // ── STATS ─────────────────────────────────────────────────────────────────────
  async getStats(municipalityId: string): Promise<ReportStats> {
    const baseQb = () =>
      this.reportRepo
        .createQueryBuilder('r')
        .innerJoin('r.trip', 'trip')
        .where('trip.municipality_id = :mId', { mId: municipalityId });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Run all counts in parallel
    const [total, todayCount, ...statusCounts] = await Promise.all([
      baseQb().getCount(),
      baseQb().andWhere('r.created_at >= :todayStart', { todayStart }).getCount(),
      ...Object.values(ReportStatus).map((s) =>
        baseQb().andWhere('r.status = :status', { status: s }).getCount(),
      ),
    ]);

    const statusValues = Object.values(ReportStatus);
    const by_status = Object.fromEntries(
      statusValues.map((s, i) => [s, statusCounts[i]]),
    ) as Record<ReportStatus, number>;

    // Type breakdown
    const typeCountsRaw = await Promise.all(
      Object.values(ReportType).map(async (t) => [
        t,
        await baseQb().andWhere('r.type = :type', { type: t }).getCount(),
      ] as const),
    );
    const by_type = Object.fromEntries(typeCountsRaw) as Record<ReportType, number>;

    return { total, today: todayCount, by_status, by_type };
  }

  // ── Reset daily counter (called by cron) ──────────────────────────────────────
  async resetDailyCounters(): Promise<void> {
    await this.userRepo.update(
      { role: UserRole.CIUDADANO },
      { reports_today: 0 },
    );
    this.logger.log('reports_today reseteado para todos los ciudadanos');
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private assertAccess(report: Report, user: User): void {
    if (user.role === UserRole.CIUDADANO && report.citizen_id !== user.id) {
      throw new ForbiddenException('No tiene permisos para ver este reporte');
    }
    if (
      user.role === UserRole.FISCAL ||
      user.role === UserRole.ADMIN_MUNICIPAL
    ) {
      if (report.trip.municipality_id !== user.municipality_id) {
        throw new ForbiddenException('Este reporte no pertenece a su municipalidad');
      }
    }
  }

  private async sendMunicipalityAlert(
    trip: Trip,
    vehiclePlate: string,
    reportId: string,
  ): Promise<void> {
    try {
      const alertees = await this.userRepo.find({
        where: [
          { municipality_id: trip.municipality_id, role: UserRole.FISCAL,          status: UserStatus.ACTIVO },
          { municipality_id: trip.municipality_id, role: UserRole.ADMIN_MUNICIPAL,  status: UserStatus.ACTIVO },
        ],
      });

      if (alertees.length === 0) return;

      await this.notifRepo.save(
        alertees.map((u) =>
          this.notifRepo.create({
            user_id:  u.id,
            channel:  NotificationChannel.WEB,
            type:     'CONDUCTOR_DIFERENTE_ALERTA',
            title:    'Alerta: Conductor diferente detectado',
            content:  `Se reportó conductor diferente en el vehículo ${vehiclePlate} (viaje ${trip.id}). Reporte: ${reportId}`,
            status:   NotificationStatus.PENDIENTE,
          }),
        ),
      );
    } catch (err) {
      // Non-critical — log but don't fail the report creation
      this.logger.error('Error al enviar alerta de municipalidad', err);
    }
  }
}

// Re-export for convenience
export { ReportType, ReportStatus };
