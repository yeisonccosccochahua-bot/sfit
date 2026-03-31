import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';

import {
  Sanction, AppealStatus,
  Appeal, AppealDecisionStatus,
  Driver, DriverStatus,
  User, UserRole, UserStatus,
  Report, ReportStatus,
  Trip, TripStatus,
  FatigueLog, FatigueLogResult,
  AuditLog,
  Notification, NotificationChannel, NotificationStatus,
  Municipality,
} from '../../entities';
import { CreateAppealDto } from './dto/create-appeal.dto';
import { ResolveAppealDto } from './dto/resolve-appeal.dto';
import { SanctionQueryDto } from './dto/sanction-query.dto';

// ─── Thresholds (configurable per municipality via config_json) ───────────────
interface SanctionThresholds {
  level1_min_minor: number;   // ≥ this → level 1
  level2_min_minor: number;   // ≥ this → level 2
  level2_min_grave: number;   // ≥ this grave → level 2
  level3_min_minor: number;   // ≥ this → level 3
  level3_min_grave: number;   // ≥ this grave → level 3
  fine_level3:      number;   // fine in soles for level 3
  fine_level4:      number;   // fine in soles for level 4
}

const DEFAULT_THRESHOLDS: SanctionThresholds = {
  level1_min_minor: 1,
  level2_min_minor: 3,
  level2_min_grave: 1,
  level3_min_minor: 6,
  level3_min_grave: 2,
  fine_level3:      500,
  fine_level4:      2_000,
};

// Reputation impact per level
const REP_PENALTY: Record<number, number> = { 1: 5, 2: 15, 3: 30, 4: 50 };

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class SanctionEngineService {
  private readonly logger = new Logger(SanctionEngineService.name);

  constructor(
    @InjectRepository(Sanction)     private sanctionRepo:    Repository<Sanction>,
    @InjectRepository(Appeal)       private appealRepo:      Repository<Appeal>,
    @InjectRepository(Driver)       private driverRepo:      Repository<Driver>,
    @InjectRepository(User)         private userRepo:        Repository<User>,
    @InjectRepository(Report)       private reportRepo:      Repository<Report>,
    @InjectRepository(Trip)         private tripRepo:        Repository<Trip>,
    @InjectRepository(FatigueLog)   private fatigueLogRepo:  Repository<FatigueLog>,
    @InjectRepository(AuditLog)     private auditRepo:       Repository<AuditLog>,
    @InjectRepository(Notification) private notifRepo:       Repository<Notification>,
    @InjectRepository(Municipality) private municipalityRepo: Repository<Municipality>,
  ) {}

  // ── EVALUATE DRIVER ─────────────────────────────────────────────────────────
  /**
   * Evaluates all incidents for a driver in the last 30 days and,
   * if a new or escalated sanction level is warranted, creates it.
   */
  async evaluateDriver(driverId: string, issuedBy?: User): Promise<Sanction | null> {
    const driver = await this.driverRepo.findOne({
      where: { id: driverId },
      relations: ['company', 'company.municipality'],
    });
    if (!driver) throw new NotFoundException(`Conductor ${driverId} no encontrado`);

    const municipality: Municipality = (driver.company as any).municipality;
    const municipalityId             = driver.company.municipality_id;
    const thresholds                 = this.getThresholds(municipality.config_json);
    const thirtyDaysAgo              = new Date(Date.now() - 30 * 24 * 60 * 60 * 1_000);

    // ── Count incidents ──────────────────────────────────────────────────────
    const { minor, grave } = await this.countIncidents(driverId, thirtyDaysAgo);

    // ── Check for active Level 3 sanction (triggers Level 4 on reincidence) ─
    const activeLevel3 = await this.sanctionRepo.findOne({
      where: [
        { driver_id: driverId, level: 3, appeal_status: AppealStatus.SIN_APELACION },
        { driver_id: driverId, level: 3, appeal_status: AppealStatus.EN_APELACION },
        { driver_id: driverId, level: 3, appeal_status: AppealStatus.APELACION_RECHAZADA },
      ],
      order: { created_at: 'DESC' },
    });

    // ── Compute target level ────────────────────────────────────────────────
    const level = this.computeLevel(minor, grave, thresholds, !!activeLevel3);
    if (level === 0) return null;

    // ── Idempotency: skip if same level already active ──────────────────────
    const alreadyActive = await this.sanctionRepo.findOne({
      where: [
        { driver_id: driverId, level, appeal_status: AppealStatus.SIN_APELACION },
        { driver_id: driverId, level, appeal_status: AppealStatus.EN_APELACION },
      ],
      order: { created_at: 'DESC' },
    });
    if (alreadyActive) {
      this.logger.debug(`Conductor ${driverId} ya tiene sanción nivel ${level} activa — omitido`);
      return null;
    }

    // ── Apply sanction ──────────────────────────────────────────────────────
    return this.applyLevel(driver, municipality, municipalityId, level, minor, grave, thresholds, issuedBy);
  }

  // ── APPLY LEVEL ─────────────────────────────────────────────────────────────
  async applyLevel(
    driver:         Driver,
    municipality:   Municipality,
    municipalityId: string,
    level:          number,
    minor:          number,
    grave:          number,
    thresholds:     SanctionThresholds,
    issuedBy?:      User,
  ): Promise<Sanction> {
    const appealDeadline = this.addBusinessDays(new Date(), 3);

    let fine: number | null = null;
    if (level === 3) fine = thresholds.fine_level3;
    if (level === 4) fine = thresholds.fine_level4;

    const reason = this.buildReason(level, minor, grave, municipality.name);

    const sanction = await this.sanctionRepo.save(
      this.sanctionRepo.create({
        driver_id:       driver.id,
        level,
        reason,
        evidence_ids:    [],
        appeal_status:   AppealStatus.SIN_APELACION,
        appeal_deadline: appealDeadline,
        fine_amount:     fine ?? undefined,
        municipality_id: municipalityId,
        issued_by_id:    issuedBy?.id,
      }),
    );

    // ── Reputation deduction ──────────────────────────────────────────────
    const penalty = REP_PENALTY[level] ?? 0;
    driver.reputation_score = Math.max(0, driver.reputation_score - penalty);

    // ── Level-specific effects ────────────────────────────────────────────
    switch (level) {
      case 1:
        await this.notifyFiscals(
          municipalityId,
          `Alerta Nivel 1 — ${driver.name}`,
          `El conductor ${driver.name} (DNI ${driver.dni}) acumuló ${minor} incidencia(s) menor(es) en 30 días.`,
          'SANCION_NIVEL_1',
        );
        break;

      case 2:
        await this.notifyFiscals(
          municipalityId,
          `Observación Nivel 2 — ${driver.name}`,
          `El conductor ${driver.name} acumuló ${minor} incidencias menores y ${grave} grave(s) en 30 días.`,
          'SANCION_NIVEL_2',
        );
        break;

      case 3:
        driver.status = DriverStatus.NO_APTO;
        await this.notifyFiscals(
          municipalityId,
          `⚠️ Sanción Nivel 3 — ${driver.name} BLOQUEADO`,
          `El conductor ${driver.name} fue bloqueado del sistema. Multa: S/ ${fine}. Incidencias: ${minor} menor(es), ${grave} grave(s).`,
          'SANCION_NIVEL_3',
        );
        break;

      case 4:
        // Legal escalation: detailed audit log
        await this.auditRepo.save(
          this.auditRepo.create({
            user_id:      issuedBy?.id,
            action:       'ESCALAMIENTO_LEGAL',
            entity_type:  'Sanction',
            entity_id:    sanction.id,
            details_json: {
              driver_id:   driver.id,
              driver_name: driver.name,
              minor,
              grave,
              municipality: municipality.name,
              fine,
              message: 'Reincidencia post-Nivel 3. Caso derivado a autoridad legal.',
            },
          }),
        );
        await this.notifyFiscals(
          municipalityId,
          `🚨 ESCALAMIENTO LEGAL — ${driver.name}`,
          `El conductor ${driver.name} ha reincidido tras una sanción Nivel 3. Se requiere acción legal inmediata. Multa acumulada: S/ ${fine}.`,
          'SANCION_NIVEL_4_LEGAL',
        );
        break;
    }

    await this.driverRepo.save(driver);

    // General audit log for all levels
    await this.auditRepo.save(
      this.auditRepo.create({
        user_id:      issuedBy?.id,
        action:       `SANCION_NIVEL_${level}`,
        entity_type:  'Sanction',
        entity_id:    sanction.id,
        details_json: { driver_id: driver.id, minor, grave, fine, level },
      }),
    );

    this.logger.log(
      `Sanción Nivel ${level} creada para conductor ${driver.id} — incidencias: ${minor}m/${grave}g`,
    );
    return sanction;
  }

  // ── CREATE APPEAL ────────────────────────────────────────────────────────────
  async createAppeal(sanctionId: string, dto: CreateAppealDto, user: User): Promise<Appeal> {
    const sanction = await this.sanctionRepo.findOne({
      where: { id: sanctionId },
      relations: ['driver'],
    });
    if (!sanction) throw new NotFoundException(`Sanción ${sanctionId} no encontrada`);

    // Municipality access check
    if (sanction.municipality_id !== user.municipality_id) {
      throw new ForbiddenException('No tiene permisos para apelar esta sanción');
    }

    // Already appealed or resolved?
    if (sanction.appeal_status !== AppealStatus.SIN_APELACION) {
      throw new ConflictException('Esta sanción ya tiene una apelación activa o resuelta');
    }

    // Deadline check
    if (sanction.appeal_deadline && new Date() > sanction.appeal_deadline) {
      throw new BadRequestException(
        `El plazo de apelación venció el ${sanction.appeal_deadline.toLocaleDateString('es-PE')}`,
      );
    }

    // Create appeal
    const appeal = await this.appealRepo.save(
      this.appealRepo.create({
        sanction_id:   sanctionId,
        description:   dto.description,
        evidence_urls: dto.evidence_urls,
        status:        AppealDecisionStatus.PENDIENTE,
      }),
    );

    // Update sanction status (Level 3 stays active during appeal per spec)
    sanction.appeal_status = AppealStatus.EN_APELACION;
    await this.sanctionRepo.save(sanction);

    // Notify fiscals
    await this.notifyFiscals(
      sanction.municipality_id,
      `Apelación recibida — Sanción Nivel ${sanction.level}`,
      `El operador apela la sanción del conductor ${sanction.driver?.name ?? sanction.driver_id}. Apelación: ${appeal.id}`,
      'APELACION_ENVIADA',
    );

    await this.auditRepo.save(
      this.auditRepo.create({
        user_id:      user.id,
        action:       'CREATE_APPEAL',
        entity_type:  'Sanction',
        entity_id:    sanctionId,
        details_json: { appeal_id: appeal.id },
      }),
    );

    return appeal;
  }

  // ── RESOLVE APPEAL ───────────────────────────────────────────────────────────
  async resolveAppeal(sanctionId: string, dto: ResolveAppealDto, user: User): Promise<Appeal> {
    const sanction = await this.sanctionRepo.findOne({
      where: { id: sanctionId },
      relations: ['driver'],
    });
    if (!sanction) throw new NotFoundException(`Sanción ${sanctionId} no encontrada`);

    if (sanction.municipality_id !== user.municipality_id) {
      throw new ForbiddenException('No tiene permisos para resolver esta apelación');
    }

    if (sanction.appeal_status !== AppealStatus.EN_APELACION) {
      throw new BadRequestException('Esta sanción no tiene una apelación pendiente de resolución');
    }

    const appeal = await this.appealRepo.findOne({
      where: { sanction_id: sanctionId, status: AppealDecisionStatus.PENDIENTE },
      order: { submitted_at: 'DESC' },
    });
    if (!appeal) throw new NotFoundException('Apelación pendiente no encontrada');

    // Resolve the appeal
    appeal.status         = dto.status as AppealDecisionStatus;
    appeal.resolved_at    = new Date();
    appeal.resolved_by_id = user.id;
    await this.appealRepo.save(appeal);

    if (dto.status === AppealDecisionStatus.ACEPTADA) {
      sanction.appeal_status = AppealStatus.APELACION_ACEPTADA;
      sanction.resolved_date = new Date().toISOString().split('T')[0];
      await this.sanctionRepo.save(sanction);  // persist before querying other sanctions

      // Restore driver status and reputation
      const driver         = sanction.driver ?? await this.driverRepo.findOneOrFail({ where: { id: sanction.driver_id } });
      const penalty        = REP_PENALTY[sanction.level] ?? 0;
      driver.reputation_score = Math.min(100, driver.reputation_score + penalty);

      if (sanction.level === 3) {
        // Only restore to APTO if no other active Level 3+ sanctions exist
        const otherLevel3 = await this.sanctionRepo.findOne({
          where: [
            { driver_id: driver.id, level: 3, appeal_status: AppealStatus.SIN_APELACION },
            { driver_id: driver.id, level: 3, appeal_status: AppealStatus.EN_APELACION },
          ],
        });
        if (!otherLevel3) driver.status = DriverStatus.APTO;
      }
      await this.driverRepo.save(driver);

      await this.notifyFiscals(
        sanction.municipality_id,
        `Apelación ACEPTADA — Conductor ${driver.name}`,
        `La apelación de la sanción Nivel ${sanction.level} fue aceptada. La sanción ha sido levantada.`,
        'APELACION_ACEPTADA',
      );
    } else {
      sanction.appeal_status = AppealStatus.APELACION_RECHAZADA;
      await this.notifyFiscals(
        sanction.municipality_id,
        `Apelación RECHAZADA — Sanción Nivel ${sanction.level}`,
        `La apelación fue rechazada. La sanción se mantiene vigente. Motivo: ${dto.reason}`,
        'APELACION_RECHAZADA',
      );
    }

    await this.sanctionRepo.save(sanction);

    await this.auditRepo.save(
      this.auditRepo.create({
        user_id:      user.id,
        action:       `RESOLVE_APPEAL_${dto.status}`,
        entity_type:  'Sanction',
        entity_id:    sanctionId,
        details_json: { appeal_id: appeal.id, reason: dto.reason },
      }),
    );

    return appeal;
  }

  // ── FIND ALL ─────────────────────────────────────────────────────────────────
  async findAll(query: SanctionQueryDto, user: User) {
    const qb = this.sanctionRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.driver', 'driver')
      .leftJoinAndSelect('driver.company', 'company')
      .where('s.municipality_id = :mId', { mId: user.municipality_id })
      .orderBy('s.created_at', 'DESC');

    if (query.level)         qb.andWhere('s.level = :level',               { level:         query.level });
    if (query.appeal_status) qb.andWhere('s.appeal_status = :appealStatus',{ appealStatus:   query.appeal_status });
    if (query.driver_id)     qb.andWhere('s.driver_id = :driverId',        { driverId:       query.driver_id });
    if (query.date_from)     qb.andWhere('s.created_at >= :from',          { from:           query.date_from });
    if (query.date_to)       qb.andWhere('s.created_at <= :to',            { to:             query.date_to });

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

  // ── FIND ONE ─────────────────────────────────────────────────────────────────
  async findOne(id: string, user: User): Promise<Sanction & { appeal?: Appeal }> {
    const sanction = await this.sanctionRepo.findOne({
      where: { id },
      relations: ['driver', 'driver.company', 'issued_by'],
    }) as Sanction & { appeal?: Appeal };

    if (!sanction) throw new NotFoundException(`Sanción ${id} no encontrada`);

    if (sanction.municipality_id !== user.municipality_id) {
      throw new ForbiddenException('No tiene permisos para ver esta sanción');
    }

    // Attach latest appeal
    const appeal = await this.appealRepo.findOne({
      where: { sanction_id: id },
      order: { submitted_at: 'DESC' },
      relations: ['resolved_by'],
    });
    if (appeal) sanction.appeal = appeal;

    return sanction;
  }

  // ── STATS ─────────────────────────────────────────────────────────────────────
  async getStats(municipalityId: string) {
    const base = () =>
      this.sanctionRepo
        .createQueryBuilder('s')
        .where('s.municipality_id = :mId', { mId: municipalityId });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [total, today, level1, level2, level3, level4, pending_appeals] = await Promise.all([
      base().getCount(),
      base().andWhere('s.created_at >= :ts', { ts: todayStart }).getCount(),
      base().andWhere('s.level = 1').getCount(),
      base().andWhere('s.level = 2').getCount(),
      base().andWhere('s.level = 3').getCount(),
      base().andWhere('s.level = 4').getCount(),
      base().andWhere('s.appeal_status = :ap', { ap: AppealStatus.EN_APELACION }).getCount(),
    ]);

    return {
      total,
      today,
      by_level: { 1: level1, 2: level2, 3: level3, 4: level4 },
      pending_appeals,
    };
  }

  // ── Find drivers with recent incidents (for cron) ────────────────────────────
  async findDriversWithRecentIncidents(): Promise<string[]> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1_000);

    const [fromReports, fromFatigue] = await Promise.all([
      this.reportRepo
        .createQueryBuilder('r')
        .select('DISTINCT td.driver_id', 'driver_id')
        .innerJoin('trips', 't', 't.id = r.trip_id')
        .innerJoin('trip_drivers', 'td', 'td.trip_id = t.id')
        .where('r.status = :status', { status: ReportStatus.VALIDO })
        .andWhere('r.created_at > :since', { since: thirtyDaysAgo })
        .getRawMany<{ driver_id: string }>(),

      this.fatigueLogRepo
        .createQueryBuilder('fl')
        .select('DISTINCT fl.driver_id', 'driver_id')
        .where('fl.result = :result', { result: FatigueLogResult.NO_APTO })
        .andWhere('fl.created_at > :since', { since: thirtyDaysAgo })
        .getRawMany<{ driver_id: string }>(),
    ]);

    const ids = new Set([
      ...fromReports.map((r) => r.driver_id),
      ...fromFatigue.map((r) => r.driver_id),
    ]);
    return [...ids];
  }

  // ── PRIVATE HELPERS ──────────────────────────────────────────────────────────

  async countIncidents(
    driverId: string,
    since: Date,
  ): Promise<{ minor: number; grave: number }> {
    const [minorFromReports, minorFromTrips, grave] = await Promise.all([
      // VALIDO reports for trips this driver was part of
      this.reportRepo
        .createQueryBuilder('r')
        .innerJoin('trips', 't', 't.id = r.trip_id')
        .innerJoin('trip_drivers', 'td', 'td.trip_id = t.id AND td.driver_id = :driverId', { driverId })
        .where('r.status = :status', { status: ReportStatus.VALIDO })
        .andWhere('r.created_at > :since', { since })
        .getCount(),

      // Auto-closed trips (driver neglected to close)
      this.tripRepo
        .createQueryBuilder('t')
        .innerJoin('trip_drivers', 'td', 'td.trip_id = t.id AND td.driver_id = :driverId', { driverId })
        .where('t.status = :status', { status: TripStatus.CERRADO_AUTO })
        .andWhere('t.created_at > :since', { since })
        .getCount(),

      // NO_APTO fatigue evaluations (grave incidents)
      this.fatigueLogRepo.count({
        where: { driver_id: driverId, result: FatigueLogResult.NO_APTO, created_at: MoreThan(since) },
      }),
    ]);

    return { minor: minorFromReports + minorFromTrips, grave };
  }

  private computeLevel(
    minor: number,
    grave: number,
    t: SanctionThresholds,
    hasActiveLevel3: boolean,
  ): number {
    // Level 4 — reincidence after Level 3 + new incidents
    if (hasActiveLevel3 && (minor > 0 || grave > 0)) return 4;
    // Level 3 — 6+ minor OR 2+ grave
    if (minor >= t.level3_min_minor || grave >= t.level3_min_grave) return 3;
    // Level 2 — 3-5 minor OR 1 grave
    if (minor >= t.level2_min_minor || grave >= t.level2_min_grave) return 2;
    // Level 1 — 1-2 minor
    if (minor >= t.level1_min_minor) return 1;
    return 0;
  }

  private getThresholds(configJson?: Record<string, any>): SanctionThresholds {
    const override = configJson?.sanction_thresholds ?? {};
    return { ...DEFAULT_THRESHOLDS, ...override };
  }

  private addBusinessDays(date: Date, days: number): Date {
    const result = new Date(date);
    let added = 0;
    while (added < days) {
      result.setDate(result.getDate() + 1);
      const dow = result.getDay();
      if (dow !== 0 && dow !== 6) added++; // skip Saturday (6) and Sunday (0)
    }
    return result;
  }

  private buildReason(level: number, minor: number, grave: number, municipalityName: string): string {
    const labels = [
      '', 'Alerta', 'Observación', 'Sanción con multa', 'Escalamiento legal',
    ];
    return `[${labels[level]}] ${municipalityName} — ${minor} incidencia(s) menor(es) y ${grave} grave(s) en los últimos 30 días.`;
  }

  private async notifyFiscals(
    municipalityId: string,
    title:          string,
    content:        string,
    type:           string,
  ): Promise<void> {
    try {
      const fiscals = await this.userRepo.find({
        where: [
          { municipality_id: municipalityId, role: UserRole.FISCAL,          status: UserStatus.ACTIVO },
          { municipality_id: municipalityId, role: UserRole.ADMIN_MUNICIPAL,  status: UserStatus.ACTIVO },
        ],
      });
      if (fiscals.length === 0) return;

      await this.notifRepo.save(
        fiscals.map((u) =>
          this.notifRepo.create({
            user_id: u.id,
            channel: NotificationChannel.WEB,
            type,
            title,
            content,
            status:  NotificationStatus.PENDIENTE,
          }),
        ),
      );
    } catch (err) {
      this.logger.error('Error al enviar notificaciones de sanción', err);
    }
  }
}
