import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';

import {
  Trip, TripStatus,
  Driver, DriverStatus,
  FatigueLog, FatigueLogResult,
  Report, ReportType, ReportStatus,
  Sanction, AppealStatus,
  User, UserRole,
  Municipality,
} from '../../entities';
import { EmailService } from '../notifications/email.service';
import { NotificationType } from '../notifications/dto/create-notification.dto';

// ─── Interfaces ───────────────────────────────────────────────────────────────
export type ReportPeriodType = 'SEMANAL' | 'MENSUAL';

export interface RouteIncident {
  route_id:    string;
  origin:      string;
  destination: string;
  incidents:   number;
}

export interface DriverSummary {
  id:    string;
  name:  string;
  score: number;
}

export interface ReportData {
  municipalityId:    string;
  municipalityName:  string;
  type:              ReportPeriodType;
  from:              Date;
  to:                Date;
  generatedAt:       Date;
  // Trips
  tripsTotal:        number;
  tripsAutoClosed:   number;
  // Drivers
  driversApto:       number;
  driversRiesgo:     number;
  driversNoApto:     number;
  // Citizen reports
  reportsByType:     Record<string, number>;
  reportsByStatus:   Record<string, number>;
  reportsTotal:      number;
  // Sanctions
  sanctionsByLevel:  Record<number, number>;
  sanctionsTotal:    number;
  // Rankings
  topDriversBest:    DriverSummary[];
  topDriversWorst:   DriverSummary[];
  // Routes with most incidents
  topIncidentRoutes: RouteIncident[];
  // Monthly trend (only when type=MENSUAL)
  trend?: {
    trips:     { current: number; previous: number; delta: number; up: boolean };
    reports:   { current: number; previous: number; delta: number; up: boolean };
    sanctions: { current: number; previous: number; delta: number; up: boolean };
  };
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class MunicipalReportsService {
  private readonly logger = new Logger(MunicipalReportsService.name);

  constructor(
    @InjectRepository(Trip)         private tripRepo:         Repository<Trip>,
    @InjectRepository(Driver)       private driverRepo:       Repository<Driver>,
    @InjectRepository(FatigueLog)   private fatigueRepo:      Repository<FatigueLog>,
    @InjectRepository(Report)       private reportRepo:       Repository<Report>,
    @InjectRepository(Sanction)     private sanctionRepo:     Repository<Sanction>,
    @InjectRepository(User)         private userRepo:         Repository<User>,
    @InjectRepository(Municipality) private municipalityRepo: Repository<Municipality>,
    private readonly emailService:  EmailService,
    private readonly config:        ConfigService,
  ) {}

  // ── GATHER DATA ─────────────────────────────────────────────────────────────

  async gatherData(
    municipalityId: string,
    from:           Date,
    to:             Date,
    type:           ReportPeriodType,
  ): Promise<ReportData> {
    const municipality = await this.municipalityRepo.findOne({ where: { id: municipalityId } });
    const munName      = municipality?.name ?? municipalityId;

    // ── Trips ────────────────────────────────────────────────────────────────
    const [tripsTotal, tripsAutoClosed] = await Promise.all([
      this.tripRepo.createQueryBuilder('t')
        .where('t.municipality_id = :mId', { mId: municipalityId })
        .andWhere('t.created_at BETWEEN :from AND :to', { from, to })
        .getCount(),

      this.tripRepo.createQueryBuilder('t')
        .where('t.municipality_id = :mId', { mId: municipalityId })
        .andWhere('t.status = :s', { s: TripStatus.CERRADO_AUTO })
        .andWhere('t.created_at BETWEEN :from AND :to', { from, to })
        .getCount(),
    ]);

    // ── Drivers by status ────────────────────────────────────────────────────
    const driverStatusCounts = await this.driverRepo
      .createQueryBuilder('d')
      .select('d.status', 'status')
      .addSelect('COUNT(*)', 'cnt')
      .innerJoin('companies', 'c', 'c.id = d.company_id AND c.municipality_id = :mId', { mId: municipalityId })
      .groupBy('d.status')
      .getRawMany<{ status: string; cnt: string }>();

    const driverMap = Object.fromEntries(
      driverStatusCounts.map((r) => [r.status, parseInt(r.cnt, 10)]),
    );

    // ── Reports by type & status ─────────────────────────────────────────────
    const reportTypeRows = await this.reportRepo
      .createQueryBuilder('r')
      .select('r.type', 'type')
      .addSelect('COUNT(*)', 'cnt')
      .innerJoin('trips', 't', 't.id = r.trip_id AND t.municipality_id = :mId', { mId: municipalityId })
      .where('r.created_at BETWEEN :from AND :to', { from, to })
      .groupBy('r.type')
      .getRawMany<{ type: string; cnt: string }>();

    const reportStatusRows = await this.reportRepo
      .createQueryBuilder('r')
      .select('r.status', 'status')
      .addSelect('COUNT(*)', 'cnt')
      .innerJoin('trips', 't', 't.id = r.trip_id AND t.municipality_id = :mId', { mId: municipalityId })
      .where('r.created_at BETWEEN :from AND :to', { from, to })
      .groupBy('r.status')
      .getRawMany<{ status: string; cnt: string }>();

    const reportsByType   = Object.fromEntries(reportTypeRows.map((r) => [r.type, parseInt(r.cnt, 10)]));
    const reportsByStatus = Object.fromEntries(reportStatusRows.map((r) => [r.status, parseInt(r.cnt, 10)]));
    const reportsTotal    = reportTypeRows.reduce((s, r) => s + parseInt(r.cnt, 10), 0);

    // ── Sanctions by level ───────────────────────────────────────────────────
    const sanctionRows = await this.sanctionRepo
      .createQueryBuilder('s')
      .select('s.level', 'level')
      .addSelect('COUNT(*)', 'cnt')
      .where('s.municipality_id = :mId', { mId: municipalityId })
      .andWhere('s.created_at BETWEEN :from AND :to', { from, to })
      .groupBy('s.level')
      .getRawMany<{ level: string; cnt: string }>();

    const sanctionsByLevel = Object.fromEntries(
      sanctionRows.map((r) => [parseInt(r.level, 10), parseInt(r.cnt, 10)]),
    ) as Record<number, number>;
    const sanctionsTotal = sanctionRows.reduce((s, r) => s + parseInt(r.cnt, 10), 0);

    // ── Top 5 drivers best / worst reputation ────────────────────────────────
    const [topBest, topWorst] = await Promise.all([
      this.driverRepo
        .createQueryBuilder('d')
        .select(['d.id', 'd.name', 'd.reputation_score'])
        .innerJoin('companies', 'c', 'c.id = d.company_id AND c.municipality_id = :mId', { mId: municipalityId })
        .orderBy('d.reputation_score', 'DESC')
        .limit(5)
        .getMany(),

      this.driverRepo
        .createQueryBuilder('d')
        .select(['d.id', 'd.name', 'd.reputation_score'])
        .innerJoin('companies', 'c', 'c.id = d.company_id AND c.municipality_id = :mId', { mId: municipalityId })
        .orderBy('d.reputation_score', 'ASC')
        .limit(5)
        .getMany(),
    ]);

    // ── Routes with most incidents (VALIDO reports) ──────────────────────────
    const incidentRoutes = await this.reportRepo
      .createQueryBuilder('r')
      .select('rt.id', 'route_id')
      .addSelect('rt.origin', 'origin')
      .addSelect('rt.destination', 'destination')
      .addSelect('COUNT(*)', 'incidents')
      .innerJoin('trips', 't', 't.id = r.trip_id AND t.municipality_id = :mId', { mId: municipalityId })
      .innerJoin('routes', 'rt', 'rt.id = t.route_id')
      .where('r.status = :s', { s: ReportStatus.VALIDO })
      .andWhere('r.created_at BETWEEN :from AND :to', { from, to })
      .groupBy('rt.id, rt.origin, rt.destination')
      .orderBy('incidents', 'DESC')
      .limit(5)
      .getRawMany<RouteIncident & { incidents: string }>();

    const topIncidentRoutes = incidentRoutes.map((r) => ({
      ...r,
      incidents: parseInt(r.incidents as unknown as string, 10),
    }));

    // ── Monthly trend ─────────────────────────────────────────────────────────
    let trend: ReportData['trend'] | undefined;
    if (type === 'MENSUAL') {
      const period     = to.getTime() - from.getTime();
      const prevFrom   = new Date(from.getTime() - period);
      const prevTo     = new Date(from.getTime() - 1);

      const [prevTrips, prevReports, prevSanctions] = await Promise.all([
        this.tripRepo.createQueryBuilder('t')
          .where('t.municipality_id = :mId', { mId: municipalityId })
          .andWhere('t.created_at BETWEEN :from AND :to', { from: prevFrom, to: prevTo })
          .getCount(),
        this.reportRepo.createQueryBuilder('r')
          .innerJoin('trips', 't', 't.id = r.trip_id AND t.municipality_id = :mId', { mId: municipalityId })
          .where('r.created_at BETWEEN :from AND :to', { from: prevFrom, to: prevTo })
          .getCount(),
        this.sanctionRepo.createQueryBuilder('s')
          .where('s.municipality_id = :mId', { mId: municipalityId })
          .andWhere('s.created_at BETWEEN :from AND :to', { from: prevFrom, to: prevTo })
          .getCount(),
      ]);

      trend = {
        trips:     { current: tripsTotal,    previous: prevTrips,    delta: tripsTotal - prevTrips,       up: tripsTotal >= prevTrips },
        reports:   { current: reportsTotal,  previous: prevReports,  delta: reportsTotal - prevReports,   up: reportsTotal >= prevReports },
        sanctions: { current: sanctionsTotal, previous: prevSanctions, delta: sanctionsTotal - prevSanctions, up: sanctionsTotal >= prevSanctions },
      };
    }

    return {
      municipalityId,
      municipalityName: munName,
      type,
      from,
      to,
      generatedAt:      new Date(),
      tripsTotal,
      tripsAutoClosed,
      driversApto:      driverMap[DriverStatus.APTO]    ?? 0,
      driversRiesgo:    driverMap[DriverStatus.RIESGO]  ?? 0,
      driversNoApto:    driverMap[DriverStatus.NO_APTO] ?? 0,
      reportsByType,
      reportsByStatus,
      reportsTotal,
      sanctionsByLevel,
      sanctionsTotal,
      topDriversBest:   topBest.map((d) => ({ id: d.id, name: d.name, score: d.reputation_score })),
      topDriversWorst:  topWorst.map((d) => ({ id: d.id, name: d.name, score: d.reputation_score })),
      topIncidentRoutes,
      trend,
    };
  }

  // ── GENERATE AND SEND ────────────────────────────────────────────────────────

  async generateAndSend(
    municipalityId: string,
    type:           ReportPeriodType,
    from:           Date,
    to:             Date,
  ): Promise<ReportData> {
    const data    = await this.gatherData(municipalityId, from, to, type);
    const html    = this.buildHtmlReport(data);
    const subject = `${type === 'SEMANAL' ? 'Reporte Semanal' : 'Reporte Mensual'} SFIT — ${data.municipalityName}`;

    // Find FISCAL and ADMIN_MUNICIPAL users for this municipality
    const recipients = await this.userRepo.find({
      where: [
        { municipality_id: municipalityId, role: UserRole.FISCAL },
        { municipality_id: municipalityId, role: UserRole.ADMIN_MUNICIPAL },
      ],
      select: ['id', 'email', 'name'],
    });

    for (const user of recipients) {
      try {
        await this.emailService.send(
          user.email,
          NotificationType.REPORTE_NUEVO,
          subject,
          `Reporte ${type.toLowerCase()} automático generado para ${data.municipalityName}. Período: ${this.formatDate(from)} — ${this.formatDate(to)}.`,
          { html_report: html, user_name: user.name },
        );
      } catch (err) {
        this.logger.warn(`Error enviando reporte a ${user.email}: ${(err as Error).message}`);
      }
    }

    this.logger.log(
      `Reporte ${type} enviado a ${recipients.length} usuario(s) — ${data.municipalityName}`,
    );
    return data;
  }

  // ── GENERATE FOR ALL MUNICIPALITIES (for cron) ────────────────────────────────

  async generateForAll(type: ReportPeriodType, from: Date, to: Date): Promise<void> {
    const municipalities = await this.municipalityRepo.find({ select: ['id', 'name'] });

    for (const mun of municipalities) {
      try {
        await this.generateAndSend(mun.id, type, from, to);
      } catch (err) {
        this.logger.error(`Error generando reporte para ${mun.name}: ${(err as Error).message}`);
      }
    }
  }

  // ── CSV EXPORT ──────────────────────────────────────────────────────────────

  toCsv(data: ReportData): string {
    const lines: string[] = [
      // Header section
      `"REPORTE ${data.type} — ${data.municipalityName}"`,
      `"Período","${this.formatDate(data.from)} al ${this.formatDate(data.to)}"`,
      `"Generado el","${this.formatDate(data.generatedAt)}"`,
      '',
      // Trips
      '"VIAJES"',
      '"Métrica","Valor"',
      `"Total de viajes","${data.tripsTotal}"`,
      `"Viajes cerrados automáticamente","${data.tripsAutoClosed}"`,
      '',
      // Drivers
      '"CONDUCTORES"',
      '"Estado","Cantidad"',
      `"APTO","${data.driversApto}"`,
      `"RIESGO","${data.driversRiesgo}"`,
      `"NO_APTO","${data.driversNoApto}"`,
      '',
      // Reports
      '"REPORTES CIUDADANOS"',
      '"Tipo","Cantidad"',
      ...Object.entries(data.reportsByType).map(([k, v]) => `"${k}","${v}"`),
      '',
      '"Estado","Cantidad"',
      ...Object.entries(data.reportsByStatus).map(([k, v]) => `"${k}","${v}"`),
      '',
      // Sanctions
      '"SANCIONES"',
      '"Nivel","Cantidad"',
      ...[1, 2, 3, 4].map((l) => `"Nivel ${l}","${data.sanctionsByLevel[l] ?? 0}"`),
      '',
      // Top drivers
      '"TOP 5 MEJOR REPUTACIÓN"',
      '"Conductor","Score"',
      ...data.topDriversBest.map((d) => `"${d.name}","${d.score}"`),
      '',
      '"TOP 5 PEOR REPUTACIÓN"',
      '"Conductor","Score"',
      ...data.topDriversWorst.map((d) => `"${d.name}","${d.score}"`),
      '',
      // Routes
      '"RUTAS CON MÁS INCIDENCIAS"',
      '"Ruta","Incidencias"',
      ...data.topIncidentRoutes.map((r) => `"${r.origin} → ${r.destination}","${r.incidents}"`),
    ];

    if (data.trend) {
      lines.push('', '"TENDENCIA VS PERÍODO ANTERIOR"');
      lines.push('"Métrica","Actual","Anterior","Variación"');
      for (const [key, t] of Object.entries(data.trend)) {
        const arrow = t.up ? '↑' : '↓';
        lines.push(`"${key}","${t.current}","${t.previous}","${arrow} ${Math.abs(t.delta)}"`);
      }
    }

    return lines.join('\n');
  }

  // ── HTML BUILDER ─────────────────────────────────────────────────────────────

  buildHtmlReport(data: ReportData): string {
    const DARK  = '#1B4F72';
    const MID   = '#2E86C1';
    const LIGHT = '#AED6F1';
    const type  = data.type === 'SEMANAL' ? 'Semanal' : 'Mensual';

    const trendSection = data.trend ? `
      <h2 style="color:${DARK};font-size:16px;margin:24px 0 8px;">📈 Tendencias vs período anterior</h2>
      <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;border:1px solid #ddd;border-radius:6px;overflow:hidden;margin-bottom:16px;">
        <thead><tr style="background:${DARK};color:#fff;">
          <th style="text-align:left;padding:10px;">Métrica</th>
          <th style="text-align:center;">Actual</th>
          <th style="text-align:center;">Anterior</th>
          <th style="text-align:center;">Variación</th>
        </tr></thead>
        <tbody>
          ${['trips','reports','sanctions'].map((k, i) => {
            const labels = ['Viajes', 'Reportes', 'Sanciones'];
            const t = data.trend![k as keyof typeof data.trend]!;
            const arrow = t.up ? '🟢 ↑' : '🔴 ↓';
            return `<tr style="background:${i % 2 === 0 ? '#f9f9f9' : '#fff'};">
              <td style="padding:10px;">${labels[i]}</td>
              <td style="text-align:center;font-weight:600;">${t.current}</td>
              <td style="text-align:center;color:#888;">${t.previous}</td>
              <td style="text-align:center;">${arrow} ${Math.abs(t.delta)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>` : '';

    const routeRows = data.topIncidentRoutes.length > 0
      ? data.topIncidentRoutes.map((r, i) =>
          `<tr style="background:${i % 2 === 0 ? '#f9f9f9' : '#fff'};">
            <td style="padding:8px;">${r.origin}</td>
            <td style="padding:8px;">${r.destination}</td>
            <td style="text-align:center;padding:8px;font-weight:600;">${r.incidents}</td>
          </tr>`)
        .join('')
      : `<tr><td colspan="3" style="padding:12px;text-align:center;color:#888;">Sin incidencias en el período</td></tr>`;

    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><title>Reporte ${type} SFIT</title></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:32px 0;">
<tr><td align="center">
<table width="680" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.1);">

  <!-- Header -->
  <tr><td style="background:${DARK};padding:28px 36px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td><span style="color:#fff;font-size:26px;font-weight:900;letter-spacing:3px;">SFIT</span>
            <span style="color:${LIGHT};font-size:12px;margin-left:10px;">Sistema de Fiscalización Inteligente de Transporte</span></td>
        <td align="right"><span style="color:#fff;background:${MID};padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;">
          Reporte ${type}
        </span></td>
      </tr>
    </table>
  </td></tr>

  <!-- Accent bar -->
  <tr><td style="height:4px;background:linear-gradient(90deg,${MID},${LIGHT});"></td></tr>

  <!-- Body -->
  <tr><td style="padding:32px 36px;">
    <h1 style="color:${DARK};font-size:20px;margin:0 0 4px;">${data.municipalityName}</h1>
    <p style="color:#888;font-size:13px;margin:0 0 24px;">
      Período: <strong>${this.formatDate(data.from)}</strong> al <strong>${this.formatDate(data.to)}</strong>
      &nbsp;|&nbsp; Generado: ${this.formatDate(data.generatedAt)}
    </p>

    <!-- KPI Cards (simulated) -->
    <table width="100%" cellpadding="0" cellspacing="8" style="margin-bottom:24px;">
      <tr>
        ${[
          { label: 'Viajes totales', value: data.tripsTotal,    icon: '🚌', color: '#E8F4FD' },
          { label: 'Reportes',       value: data.reportsTotal,  icon: '📋', color: '#FDF8E1' },
          { label: 'Sanciones',      value: data.sanctionsTotal, icon: '⚖️', color: '#FDE8E8' },
        ].map((k) => `
          <td width="33%" style="background:${k.color};border-radius:8px;padding:16px;text-align:center;">
            <div style="font-size:28px;">${k.icon}</div>
            <div style="font-size:28px;font-weight:900;color:${DARK};">${k.value}</div>
            <div style="font-size:12px;color:#666;">${k.label}</div>
          </td>`).join('')}
      </tr>
    </table>

    <!-- Drivers -->
    <h2 style="color:${DARK};font-size:16px;margin:0 0 8px;">👥 Estado de conductores</h2>
    <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;border:1px solid #ddd;border-radius:6px;margin-bottom:20px;">
      <tr style="background:${DARK};color:#fff;">
        <th style="padding:10px;text-align:left;">Estado</th>
        <th style="padding:10px;text-align:center;">Cantidad</th>
        <th style="padding:10px;text-align:center;">%</th>
      </tr>
      ${(() => {
        const total = data.driversApto + data.driversRiesgo + data.driversNoApto || 1;
        return [
          { label: 'APTO',    count: data.driversApto,    color: '#27AE60' },
          { label: 'RIESGO',  count: data.driversRiesgo,  color: '#E67E22' },
          { label: 'NO APTO', count: data.driversNoApto,  color: '#E74C3C' },
        ].map((r, i) => `
          <tr style="background:${i % 2 === 0 ? '#f9f9f9' : '#fff'};">
            <td style="padding:10px;"><span style="color:${r.color};font-weight:700;">● </span>${r.label}</td>
            <td style="text-align:center;padding:10px;font-weight:700;">${r.count}</td>
            <td style="text-align:center;padding:10px;color:#888;">${Math.round(r.count / total * 100)}%</td>
          </tr>`).join('');
      })()}
    </table>

    <!-- Sanctions by level -->
    <h2 style="color:${DARK};font-size:16px;margin:0 0 8px;">⚖️ Sanciones emitidas por nivel</h2>
    <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;border:1px solid #ddd;border-radius:6px;margin-bottom:20px;">
      <tr style="background:${DARK};color:#fff;">
        <th style="padding:10px;text-align:left;">Nivel</th>
        <th style="padding:10px;text-align:left;">Tipo</th>
        <th style="padding:10px;text-align:center;">Cantidad</th>
      </tr>
      ${[
        { level: 1, label: 'Alerta',          color: '#3498DB' },
        { level: 2, label: 'Observación',     color: '#E67E22' },
        { level: 3, label: 'Sanción + multa', color: '#E74C3C' },
        { level: 4, label: 'Escalamiento legal', color: '#8E44AD' },
      ].map((r, i) => `
        <tr style="background:${i % 2 === 0 ? '#f9f9f9' : '#fff'};">
          <td style="padding:10px;font-weight:700;color:${r.color};">Nivel ${r.level}</td>
          <td style="padding:10px;">${r.label}</td>
          <td style="text-align:center;padding:10px;font-weight:700;">${data.sanctionsByLevel[r.level] ?? 0}</td>
        </tr>`).join('')}
    </table>

    <!-- Top drivers -->
    <table width="100%" cellpadding="0" cellspacing="12" style="margin-bottom:20px;">
      <tr>
        <td width="48%" valign="top">
          <h2 style="color:${DARK};font-size:14px;margin:0 0 8px;">🏆 Mejor reputación</h2>
          ${data.topDriversBest.map((d, i) => `
            <div style="background:#F0FFF4;border-left:3px solid #27AE60;padding:8px 10px;margin-bottom:4px;border-radius:0 4px 4px 0;">
              <span style="color:#27AE60;font-weight:700;">#${i + 1}</span>
              <span style="margin-left:8px;font-size:13px;">${d.name}</span>
              <span style="float:right;font-weight:700;color:#27AE60;">${d.score}</span>
            </div>`).join('')}
        </td>
        <td width="4%"></td>
        <td width="48%" valign="top">
          <h2 style="color:${DARK};font-size:14px;margin:0 0 8px;">⚠️ Peor reputación</h2>
          ${data.topDriversWorst.map((d, i) => `
            <div style="background:#FFF5F5;border-left:3px solid #E74C3C;padding:8px 10px;margin-bottom:4px;border-radius:0 4px 4px 0;">
              <span style="color:#E74C3C;font-weight:700;">#${i + 1}</span>
              <span style="margin-left:8px;font-size:13px;">${d.name}</span>
              <span style="float:right;font-weight:700;color:#E74C3C;">${d.score}</span>
            </div>`).join('')}
        </td>
      </tr>
    </table>

    <!-- Top incident routes -->
    <h2 style="color:${DARK};font-size:16px;margin:0 0 8px;">🗺️ Rutas con más incidencias</h2>
    <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;border:1px solid #ddd;border-radius:6px;margin-bottom:20px;">
      <tr style="background:${DARK};color:#fff;">
        <th style="padding:10px;text-align:left;">Origen</th>
        <th style="padding:10px;text-align:left;">Destino</th>
        <th style="padding:10px;text-align:center;">Incidencias</th>
      </tr>
      ${routeRows}
    </table>

    ${trendSection}

  </td></tr>

  <!-- Footer -->
  <tr><td style="background:${DARK};padding:20px 36px;text-align:center;">
    <p style="color:${LIGHT};font-size:12px;margin:0;">
      Sistema de Fiscalización Inteligente de Transporte — ${data.municipalityName}
    </p>
    <p style="color:#7FB3D3;font-size:11px;margin:4px 0 0;">
      Este es un reporte automático generado por SFIT. No responda este correo.
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
  }

  // ── Period helpers ──────────────────────────────────────────────────────────

  /** Returns {from, to} for the previous complete week (Mon–Sun) */
  getPreviousWeekRange(): { from: Date; to: Date } {
    const now   = new Date();
    const day   = now.getDay(); // 0=Sun, 1=Mon…
    const daysToLastSunday = day === 0 ? 7 : day;
    const to    = new Date(now);
    to.setDate(now.getDate() - daysToLastSunday);
    to.setHours(23, 59, 59, 999);
    const from  = new Date(to);
    from.setDate(to.getDate() - 6);
    from.setHours(0, 0, 0, 0);
    return { from, to };
  }

  /** Returns {from, to} for the previous complete calendar month */
  getPreviousMonthRange(): { from: Date; to: Date } {
    const now   = new Date();
    const to    = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    const from  = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    return { from, to };
  }

  private formatDate(d: Date): string {
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
