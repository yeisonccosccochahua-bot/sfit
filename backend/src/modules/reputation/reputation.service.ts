import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  Driver, DriverStatus,
  Vehicle,
  Company,
  FatigueLog, FatigueLogResult,
  Report, ReportStatus,
  Sanction, AppealStatus,
  Trip, TripStatus,
} from '../../entities';

// Reputation penalties per sanction level (must match SanctionEngineService)
const SANCTION_PENALTY: Record<number, number> = { 1: 5, 2: 15, 3: 30, 4: 50 };

export interface DriverReputationBreakdown {
  driver_id:        string;
  driver_name:      string;
  score:            number;
  fatigue_score:    number;  // 0-100, weight 40%
  report_score:     number;  // 0-100, weight 30%
  incident_score:   number;  // 0-100, weight 30%
  fatigue_total:    number;
  fatigue_apto:     number;
  reports_valido:   number;
  reports_invalido: number;
  active_sanctions: number;
}

export interface VehicleReputationBreakdown {
  vehicle_id:      string;
  plate:           string;
  score:           number;
  driver_avg:      number;
  auto_closed_cnt: number;
}

export interface CompanyReputationBreakdown {
  company_id:      string;
  company_name:    string;
  score:           number;
  driver_avg_rep:  number;
  drivers_total:   number;
  drivers_apto:    number;
  active_sanctions: number;
}

@Injectable()
export class ReputationService {
  private readonly logger = new Logger(ReputationService.name);

  constructor(
    @InjectRepository(Driver)     private driverRepo:     Repository<Driver>,
    @InjectRepository(Vehicle)    private vehicleRepo:    Repository<Vehicle>,
    @InjectRepository(Company)    private companyRepo:    Repository<Company>,
    @InjectRepository(FatigueLog) private fatigueRepo:    Repository<FatigueLog>,
    @InjectRepository(Report)     private reportRepo:     Repository<Report>,
    @InjectRepository(Sanction)   private sanctionRepo:   Repository<Sanction>,
    @InjectRepository(Trip)       private tripRepo:       Repository<Trip>,
  ) {}

  // ── DRIVER ─────────────────────────────────────────────────────────────────

  async calculateDriverReputation(driverId: string): Promise<DriverReputationBreakdown> {
    const driver = await this.driverRepo.findOne({ where: { id: driverId } });
    if (!driver) throw new NotFoundException(`Conductor ${driverId} no encontrado`);

    const since = new Date(Date.now() - 30 * 24 * 60 * 60_000);

    // ── Factor 1: Fatigue compliance (40%) ──────────────────────────────────
    const fatigueLogs = await this.fatigueRepo
      .createQueryBuilder('fl')
      .where('fl.driver_id = :id', { id: driverId })
      .andWhere('fl.created_at > :since', { since })
      .getMany();

    const fatigueTotal = fatigueLogs.length;
    const fatigueApto  = fatigueLogs.filter((l) => l.result === FatigueLogResult.APTO).length;
    const fatigue_score = fatigueTotal > 0 ? Math.round((fatigueApto / fatigueTotal) * 100) : 100;

    // ── Factor 2: Citizen reports (30%) ─────────────────────────────────────
    // Reports on trips where this driver was involved
    const [reportsValido, reportsInvalido] = await Promise.all([
      this.reportRepo
        .createQueryBuilder('r')
        .innerJoin('trips', 't', 't.id = r.trip_id')
        .innerJoin('trip_drivers', 'td', 'td.trip_id = t.id AND td.driver_id = :id', { id: driverId })
        .where('r.status = :s', { s: ReportStatus.VALIDO })
        .andWhere('r.created_at > :since', { since })
        .getCount(),

      this.reportRepo
        .createQueryBuilder('r')
        .innerJoin('trips', 't', 't.id = r.trip_id')
        .innerJoin('trip_drivers', 'td', 'td.trip_id = t.id AND td.driver_id = :id', { id: driverId })
        .where('r.status = :s', { s: ReportStatus.INVALIDO })
        .andWhere('r.created_at > :since', { since })
        .getCount(),
    ]);

    const reportsTotal = reportsValido + reportsInvalido;
    const report_score  = reportsTotal > 0
      ? Math.round(Math.max(0, (reportsValido - reportsInvalido) / reportsTotal) * 100)
      : 100;

    // ── Factor 3: Absence of incidents / sanctions (30%) ────────────────────
    const activeSanctions = await this.sanctionRepo
      .createQueryBuilder('s')
      .where('s.driver_id = :id', { id: driverId })
      .andWhere('s.appeal_status != :acc', { acc: AppealStatus.APELACION_ACEPTADA })
      .getMany();

    const totalPenalty = activeSanctions.reduce(
      (sum, s) => sum + (SANCTION_PENALTY[s.level] ?? 0), 0,
    );
    const incident_score = Math.max(0, 100 - totalPenalty);

    // ── Weighted score ────────────────────────────────────────────────────────
    const score = Math.round(
      fatigue_score * 0.40 +
      report_score  * 0.30 +
      incident_score * 0.30,
    );
    const finalScore = Math.min(100, Math.max(0, score));

    // Persist to driver record
    await this.driverRepo.update(driverId, { reputation_score: finalScore });

    return {
      driver_id:        driverId,
      driver_name:      driver.name,
      score:            finalScore,
      fatigue_score,
      report_score,
      incident_score,
      fatigue_total:    fatigueTotal,
      fatigue_apto:     fatigueApto,
      reports_valido:   reportsValido,
      reports_invalido: reportsInvalido,
      active_sanctions: activeSanctions.length,
    };
  }

  // ── VEHICLE ────────────────────────────────────────────────────────────────

  async calculateVehicleReputation(vehicleId: string): Promise<VehicleReputationBreakdown> {
    const vehicle = await this.vehicleRepo.findOne({ where: { id: vehicleId } });
    if (!vehicle) throw new NotFoundException(`Vehículo ${vehicleId} no encontrado`);

    const since = new Date(Date.now() - 30 * 24 * 60 * 60_000);

    // Average reputation of drivers who operated this vehicle in last 30 days
    const driverAvgRow = await this.driverRepo
      .createQueryBuilder('d')
      .select('AVG(d.reputation_score)', 'avg')
      .innerJoin('trip_drivers', 'td', 'td.driver_id = d.id')
      .innerJoin('trips', 't', 't.id = td.trip_id AND t.vehicle_id = :vid', { vid: vehicleId })
      .where('t.created_at > :since', { since })
      .getRawOne<{ avg: string }>();

    const driver_avg = Math.round(parseFloat(driverAvgRow?.avg ?? '100') || 100);

    // CERRADO_AUTO trips for this vehicle in last 30 days (penalty)
    const auto_closed_cnt = await this.tripRepo.count({
      where: {
        vehicle_id: vehicleId,
        status:     TripStatus.CERRADO_AUTO,
      },
    });

    const penalty = Math.min(50, auto_closed_cnt * 5); // -5 per auto-close, max -50
    const score   = Math.min(100, Math.max(0, driver_avg - penalty));

    await this.vehicleRepo.update(vehicleId, { reputation_score: score });

    return { vehicle_id: vehicleId, plate: vehicle.plate, score, driver_avg, auto_closed_cnt };
  }

  // ── COMPANY ────────────────────────────────────────────────────────────────

  async calculateCompanyReputation(companyId: string): Promise<CompanyReputationBreakdown> {
    const company = await this.companyRepo.findOne({ where: { id: companyId } });
    if (!company) throw new NotFoundException(`Empresa ${companyId} no encontrada`);

    const drivers = await this.driverRepo.find({ where: { company_id: companyId } });

    const driversTotal = drivers.length;
    const driversApto  = drivers.filter((d) => d.status === DriverStatus.APTO).length;
    const driverAvgRep = driversTotal > 0
      ? Math.round(drivers.reduce((s, d) => s + d.reputation_score, 0) / driversTotal)
      : 100;
    const ratioApto = driversTotal > 0 ? (driversApto / driversTotal) * 100 : 100;

    // Count active (non-accepted) sanctions for this company's drivers in last 30 days
    const since = new Date(Date.now() - 30 * 24 * 60 * 60_000);
    const activeSanctions = await this.sanctionRepo
      .createQueryBuilder('s')
      .innerJoin('drivers', 'd', 'd.id = s.driver_id AND d.company_id = :cid', { cid: companyId })
      .where('s.appeal_status != :acc', { acc: AppealStatus.APELACION_ACEPTADA })
      .andWhere('s.created_at > :since', { since })
      .getCount();

    const sanctionPenalty = Math.min(50, activeSanctions * 5);

    const score = Math.round(
      driverAvgRep    * 0.50 +
      ratioApto       * 0.30 +
      Math.max(0, 100 - sanctionPenalty) * 0.20,
    );

    await this.companyRepo.update(companyId, { reputation_score: Math.min(100, Math.max(0, score)) });

    return {
      company_id:       companyId,
      company_name:     company.name,
      score:            Math.min(100, Math.max(0, score)),
      driver_avg_rep:   driverAvgRep,
      drivers_total:    driversTotal,
      drivers_apto:     driversApto,
      active_sanctions: activeSanctions,
    };
  }

  // ── RANKINGS ───────────────────────────────────────────────────────────────

  async rankingDrivers(municipalityId: string, limit = 20) {
    return this.driverRepo
      .createQueryBuilder('d')
      .select(['d.id', 'd.name', 'd.reputation_score', 'd.status'])
      .innerJoin('companies', 'c', 'c.id = d.company_id AND c.municipality_id = :mId', { mId: municipalityId })
      .orderBy('d.reputation_score', 'DESC')
      .limit(limit)
      .getMany();
  }

  async rankingCompanies(municipalityId: string, limit = 20) {
    return this.companyRepo
      .createQueryBuilder('c')
      .select(['c.id', 'c.name', 'c.reputation_score', 'c.status'])
      .where('c.municipality_id = :mId', { mId: municipalityId })
      .orderBy('c.reputation_score', 'DESC')
      .limit(limit)
      .getMany();
  }

  // ── BULK RECALCULATE (for cron) ────────────────────────────────────────────

  async recalculateAll(): Promise<{ drivers: number; vehicles: number; companies: number }> {
    const [drivers, vehicles, companies] = await Promise.all([
      this.driverRepo.find({ select: ['id'] }),
      this.vehicleRepo.find({ select: ['id'] }),
      this.companyRepo.find({ select: ['id'] }),
    ]);

    let driverOk = 0, vehicleOk = 0, companyOk = 0;

    for (const { id } of drivers) {
      try { await this.calculateDriverReputation(id); driverOk++; }
      catch (e) { this.logger.warn(`Error calculando rep conductor ${id}: ${(e as Error).message}`); }
    }
    for (const { id } of vehicles) {
      try { await this.calculateVehicleReputation(id); vehicleOk++; }
      catch (e) { this.logger.warn(`Error calculando rep vehículo ${id}: ${(e as Error).message}`); }
    }
    for (const { id } of companies) {
      try { await this.calculateCompanyReputation(id); companyOk++; }
      catch (e) { this.logger.warn(`Error calculando rep empresa ${id}: ${(e as Error).message}`); }
    }

    return { drivers: driverOk, vehicles: vehicleOk, companies: companyOk };
  }
}
