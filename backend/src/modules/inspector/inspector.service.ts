import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';

import { Inspection, InspectionTipo, InspectionResultado } from './entities/inspection.entity';
import { CreateInspectionDto } from './dto/create-inspection.dto';
import { CreateFieldObservationDto } from './dto/create-field-observation.dto';
import { VerifyDriverDto } from './dto/verify-driver.dto';
import { VerifyVehicleDto } from './dto/verify-vehicle.dto';
import { FinalizeInspectionDto } from './dto/finalize-inspection.dto';
import { InspectorFiltersDto } from './dto/inspector-filters.dto';

import { User } from '../../entities/user.entity';
import { Vehicle } from '../../entities/vehicle.entity';
import { Driver } from '../../entities/driver.entity';
import { Trip, TripStatus } from '../../entities/trip.entity';
import { TripDriver } from '../../entities/trip-driver.entity';
import { Notification, NotificationChannel, NotificationStatus } from '../../entities/notification.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { Sanction, AppealStatus } from '../../entities/sanction.entity';

@Injectable()
export class InspectorService {
  constructor(
    @InjectRepository(Inspection) private inspectionRepo: Repository<Inspection>,
    @InjectRepository(Vehicle)    private vehicleRepo:    Repository<Vehicle>,
    @InjectRepository(Driver)     private driverRepo:     Repository<Driver>,
    @InjectRepository(Trip)       private tripRepo:       Repository<Trip>,
    @InjectRepository(TripDriver) private tripDriverRepo: Repository<TripDriver>,
    @InjectRepository(Notification) private notifRepo:   Repository<Notification>,
    @InjectRepository(AuditLog)   private auditRepo:      Repository<AuditLog>,
    @InjectRepository(Sanction)   private sanctionRepo:   Repository<Sanction>,
    private config: ConfigService,
  ) {}

  // ─── DASHBOARD KPIs ────────────────────────────────────────────────────────
  async getDashboard(inspector: User) {
    const municipalityId = inspector.municipality_id!;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      inspeccionesHoy,
      infraccionesHoy,
      viajesActivos,
      conductoresRiesgo,
      conductoresBloqueados,
    ] = await Promise.all([
      this.inspectionRepo.count({
        where: { inspector_id: inspector.id, created_at: Between(today, tomorrow) },
      }),
      this.inspectionRepo.count({
        where: {
          inspector_id: inspector.id,
          resultado: InspectionResultado.INFRACCION_DETECTADA,
          created_at: Between(today, tomorrow),
        },
      }),
      this.tripRepo.count({ where: { municipality_id: municipalityId, status: TripStatus.EN_CURSO } }),
      this.driverRepo
        .createQueryBuilder('d')
        .innerJoin('d.company', 'c', 'c.municipality_id = :mId', { mId: municipalityId })
        .where("d.status = 'RIESGO'")
        .getCount(),
      this.driverRepo
        .createQueryBuilder('d')
        .innerJoin('d.company', 'c', 'c.municipality_id = :mId', { mId: municipalityId })
        .where("d.status = 'NO_APTO'")
        .getCount(),
    ]);

    const ultimasAlertas = await this.notifRepo.find({
      where: { user_id: inspector.id },
      order: { sent_at: 'DESC' },
      take: 10,
    });

    return {
      inspecciones_hoy: inspeccionesHoy,
      infracciones_detectadas_hoy: infraccionesHoy,
      viajes_activos_municipalidad: viajesActivos,
      conductores_en_riesgo: conductoresRiesgo,
      conductores_bloqueados: conductoresBloqueados,
      alertas_pendientes: ultimasAlertas.filter(a => a.status === NotificationStatus.ENVIADO || a.status === NotificationStatus.PENDIENTE).length,
      ultimas_alertas: ultimasAlertas,
    };
  }

  // ─── VIAJES ACTIVOS ─────────────────────────────────────────────────────────
  async getActiveTrips(inspector: User) {
    const trips = await this.tripRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.vehicle', 'v')
      .leftJoinAndSelect('v.company', 'c')
      .leftJoinAndSelect('t.route', 'r')
      .where('t.municipality_id = :mId', { mId: inspector.municipality_id })
      .andWhere('t.status = :s', { s: TripStatus.EN_CURSO })
      .orderBy('t.start_time', 'ASC')
      .getMany();

    const result = await Promise.all(trips.map(async (trip) => {
      const tDrivers = await this.tripDriverRepo.find({
        where: { trip_id: trip.id },
        relations: ['driver'],
      });
      const conductores = tDrivers.map(td => ({
        id: td.driver.id,
        nombre: td.driver.name,
        dni: td.driver.dni?.slice(-4).padStart(8, '*'),
        foto_url: td.driver.photo_url ?? null,
        estado_fatiga: td.driver.status,
        horas_conducidas: Number(td.driver.total_hours_driven_24h ?? 0),
        rol: td.role,
        fatigue_check_result: td.fatigue_check_result,
      }));

      const minutosTranscurridos = Math.floor((Date.now() - new Date(trip.start_time).getTime()) / 60000);

      return {
        id: trip.id,
        vehiculo: {
          id: trip.vehicle.id,
          placa: trip.vehicle.plate,
          marca: trip.vehicle.brand,
          modelo: trip.vehicle.model,
          foto_url: trip.vehicle.photo_url ?? null,
          empresa: { nombre: (trip.vehicle as any).company?.name, ruc: (trip.vehicle as any).company?.ruc },
        },
        ruta: {
          origen: (trip.route as any)?.origin,
          destino: (trip.route as any)?.destination,
        },
        conductores,
        hora_inicio: trip.start_time,
        minutos_transcurridos: minutosTranscurridos,
        status: trip.status,
        tiene_conductor_riesgo: conductores.some(c => c.estado_fatiga === 'RIESGO'),
        tiene_conductor_bloqueado: conductores.some(c => c.estado_fatiga === 'NO_APTO'),
      };
    }));

    // Sort: at-risk first, then blocked, then normal
    return result.sort((a, b) => {
      if (a.tiene_conductor_bloqueado && !b.tiene_conductor_bloqueado) return -1;
      if (!a.tiene_conductor_bloqueado && b.tiene_conductor_bloqueado) return 1;
      if (a.tiene_conductor_riesgo && !b.tiene_conductor_riesgo) return -1;
      if (!a.tiene_conductor_riesgo && b.tiene_conductor_riesgo) return 1;
      return 0;
    });
  }

  // ─── ALERTAS FEED ───────────────────────────────────────────────────────────
  async getAlertas(inspector: User, page = 1, limit = 50) {
    const [data, total] = await this.notifRepo.findAndCount({
      where: { user_id: inspector.id },
      order: { sent_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, lastPage: Math.ceil(total / limit) };
  }

  // ─── SCAN QR ────────────────────────────────────────────────────────────────
  async scanQr(qrContent: string, inspector: User) {
    // Extract qr_code from URL or use directly
    const match = qrContent.match(/\/scan\/([^/?#\s]+)/);
    const qrCode = match?.[1] ?? qrContent;

    const vehicle = await this.vehicleRepo.findOne({
      where: { qr_code: qrCode },
      relations: ['company'],
    });

    if (!vehicle) {
      return { qr_valido: false, motivo: 'QR no reconocido' };
    }

    // Validate HMAC
    const secret = this.config.get<string>('QR_HMAC_SECRET', 'sfit_qr_hmac_secret_change_in_prod');
    const expected = crypto.createHmac('sha256', secret).update(vehicle.qr_code).digest('hex');
    try {
      const valid = crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(vehicle.qr_hmac, 'hex'));
      if (!valid) return { qr_valido: false, motivo: 'Firma QR inválida' };
    } catch {
      return { qr_valido: false, motivo: 'Firma QR inválida' };
    }

    // Check municipality
    if ((vehicle.company as any)?.municipality_id !== inspector.municipality_id) {
      return { qr_valido: false, motivo: 'Vehículo no pertenece a tu municipalidad' };
    }

    const today = new Date();
    const soatVigente = vehicle.soat_expires_at ? new Date(vehicle.soat_expires_at) > today : false;
    const revTecVigente = vehicle.inspection_expires_at ? new Date(vehicle.inspection_expires_at) > today : false;

    // Active trip
    const activeTrip = await this.tripRepo.findOne({
      where: { vehicle_id: vehicle.id, status: TripStatus.EN_CURSO },
      relations: ['route'],
    });

    let viajeActivo: any = null;
    const conductores: any[] = [];

    if (activeTrip) {
      const minutosTranscurridos = Math.floor((Date.now() - new Date(activeTrip.start_time).getTime()) / 60000);
      viajeActivo = {
        id: activeTrip.id,
        ruta: {
          origen: (activeTrip.route as any)?.origin,
          destino: (activeTrip.route as any)?.destination,
        },
        hora_inicio: activeTrip.start_time,
        tiempo_transcurrido_minutos: minutosTranscurridos,
        estado: activeTrip.status,
      };

      const tDrivers = await this.tripDriverRepo.find({
        where: { trip_id: activeTrip.id },
        relations: ['driver'],
      });

      for (const td of tDrivers) {
        const d = td.driver;
        const licVigente = d.license_expires_at ? new Date(d.license_expires_at) > today : null;
        const diasVencLic = d.license_expires_at
          ? Math.ceil((new Date(d.license_expires_at).getTime() - today.getTime()) / 86400000)
          : null;

        // Active sanctions count
        const sanctions = await this.auditRepo
          .createQueryBuilder('a')
          .where("a.entity_type = 'Sanction'")
          .andWhere("a.action = 'SANCTION_CREATED'")
          .andWhere("(a.details_json->>'driver_id') = :dId", { dId: d.id })
          .getCount();

        conductores.push({
          id: d.id,
          nombre: d.name,
          dni: d.dni,
          foto_url: d.photo_url ?? null,
          licencia: {
            numero: d.license_number,
            vigente: licVigente,
            vencimiento: d.license_expires_at,
            dias_para_vencer: diasVencLic,
          },
          fatiga: {
            estado: d.status,
            horas_conducidas_24h: Number(d.total_hours_driven_24h ?? 0),
            ultima_pausa: d.last_rest_start,
          },
          reputation_score: d.reputation_score,
          sanciones_activas: sanctions,
          rol: td.role,
          fatigue_check_result: td.fatigue_check_result,
        });
      }
    }

    // Build alerts
    const alertas: string[] = [];
    if (!soatVigente) {
      const f = vehicle.soat_expires_at ? new Date(vehicle.soat_expires_at).toLocaleDateString('es-PE') : 'fecha desconocida';
      alertas.push(`SOAT vencido desde ${f}`);
    } else if (vehicle.soat_expires_at) {
      const dias = Math.ceil((new Date(vehicle.soat_expires_at).getTime() - today.getTime()) / 86400000);
      if (dias < 30) alertas.push(`SOAT vence en ${dias} día${dias !== 1 ? 's' : ''}`);
    }
    if (!revTecVigente) {
      const f = vehicle.inspection_expires_at ? new Date(vehicle.inspection_expires_at).toLocaleDateString('es-PE') : 'fecha desconocida';
      alertas.push(`Revisión técnica vencida desde ${f}`);
    }
    if (['INACTIVO', 'SUSPENDIDO', 'FUERA_DE_CIRCULACION', 'DADO_DE_BAJA'].includes(vehicle.status)) {
      alertas.push(`Vehículo en estado: ${vehicle.status}`);
    }
    for (const c of conductores) {
      if (c.fatiga.estado === 'RIESGO') alertas.push(`Conductor ${c.nombre} en RIESGO de fatiga (${c.fatiga.horas_conducidas_24h}h conducidas)`);
      if (c.fatiga.estado === 'NO_APTO') alertas.push(`Conductor ${c.nombre} NO APTO (bloqueado por fatiga)`);
      if (c.licencia.dias_para_vencer !== null && c.licencia.dias_para_vencer < 30 && c.licencia.dias_para_vencer > 0) {
        alertas.push(`Licencia de ${c.nombre} vence en ${c.licencia.dias_para_vencer} días`);
      }
      if (c.licencia.vigente === false) alertas.push(`Licencia de ${c.nombre} VENCIDA`);
    }
    if (!activeTrip) alertas.push('Sin viaje activo registrado para este vehículo');

    // Auto-create inspection for this scan
    const inspection = await this.createInspection({
      tipo: InspectionTipo.VERIFICACION_QR,
      ubicacion_descripcion: 'Escaneo QR de campo',
      vehicle_id: vehicle.id,
      trip_id: activeTrip?.id,
    }, inspector);

    return {
      qr_valido: true,
      inspection_id: inspection.id,
      vehiculo: {
        id: vehicle.id,
        placa: vehicle.plate,
        marca: vehicle.brand,
        modelo: vehicle.model,
        color: vehicle.color,
        year: vehicle.year,
        foto_url: vehicle.photo_url ?? null,
        estado: vehicle.status,
        soat_vigente: soatVigente,
        soat_vencimiento: vehicle.soat_expires_at,
        revision_tecnica_vigente: revTecVigente,
        revision_tecnica_vencimiento: vehicle.inspection_expires_at,
        empresa: {
          nombre: (vehicle.company as any)?.name,
          ruc: (vehicle.company as any)?.ruc,
        },
      },
      viaje_activo: viajeActivo,
      conductores,
      alertas,
      requiere_accion: alertas.length > 0,
    };
  }

  // ─── CREATE INSPECTION ───────────────────────────────────────────────────────
  async createInspection(dto: CreateInspectionDto, inspector: User): Promise<Inspection> {
    const insp = this.inspectionRepo.create({
      inspector_id: inspector.id,
      municipality_id: inspector.municipality_id,
      tipo: dto.tipo,
      ubicacion_descripcion: dto.ubicacion_descripcion,
      vehicle_id: dto.vehicle_id ?? null,
      trip_id: dto.trip_id ?? null,
      driver_id: dto.driver_id ?? null,
      latitud: dto.latitud ?? null,
      longitud: dto.longitud ?? null,
      resultado: InspectionResultado.EN_PROCESO,
      observaciones: [],
      fotos_evidencia: [],
    });
    return this.inspectionRepo.save(insp);
  }

  // ─── LIST MY INSPECTIONS ─────────────────────────────────────────────────────
  async findAll(inspector: User, filters: InspectorFiltersDto) {
    const page  = parseInt(filters.page  ?? '1',  10);
    const limit = parseInt(filters.limit ?? '20', 10);

    const qb = this.inspectionRepo
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.vehicle', 'v')
      .leftJoinAndSelect('i.driver',  'd')
      .where('i.inspector_id = :iId', { iId: inspector.id })
      .orderBy('i.created_at', 'DESC');

    if (filters.tipo)        qb.andWhere('i.tipo = :tipo',         { tipo: filters.tipo });
    if (filters.resultado)   qb.andWhere('i.resultado = :res',     { res: filters.resultado });
    if (filters.fecha_desde) qb.andWhere('i.created_at >= :fD',    { fD: new Date(filters.fecha_desde) });
    if (filters.fecha_hasta) {
      const fH = new Date(filters.fecha_hasta);
      fH.setHours(23, 59, 59, 999);
      qb.andWhere('i.created_at <= :fH', { fH });
    }
    if (filters.vehicle_plate) {
      qb.andWhere('v.plate ILIKE :p', { p: `%${filters.vehicle_plate}%` });
    }
    if (filters.driver_dni) {
      qb.andWhere('d.dni ILIKE :dni', { dni: `%${filters.driver_dni}%` });
    }

    const [data, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();
    return { data, total, page, lastPage: Math.ceil(total / limit) };
  }

  // ─── GET ONE INSPECTION ──────────────────────────────────────────────────────
  async findOne(id: string, inspector: User): Promise<Inspection> {
    const insp = await this.inspectionRepo.findOne({
      where: { id },
      relations: ['vehicle', 'vehicle.company', 'driver', 'trip', 'trip.route'],
    });
    if (!insp) throw new NotFoundException(`Inspección ${id} no encontrada`);
    if (insp.inspector_id !== inspector.id) throw new ForbiddenException('No tienes acceso a esta inspección');
    return insp;
  }

  // ─── ADD OBSERVATION ────────────────────────────────────────────────────────
  async addObservacion(id: string, dto: CreateFieldObservationDto, inspector: User): Promise<Inspection> {
    const insp = await this.findOne(id, inspector);
    if (insp.resultado !== InspectionResultado.EN_PROCESO) {
      throw new BadRequestException('La inspección ya está finalizada');
    }
    insp.observaciones = [
      ...(insp.observaciones ?? []),
      { descripcion: dto.descripcion, tipo: dto.tipo, gravedad: dto.gravedad, foto_url: dto.foto_url },
    ];
    return this.inspectionRepo.save(insp);
  }

  // ─── ADD PHOTO ──────────────────────────────────────────────────────────────
  async addFoto(id: string, fotoUrl: string, inspector: User): Promise<Inspection> {
    const insp = await this.findOne(id, inspector);
    insp.fotos_evidencia = [...(insp.fotos_evidencia ?? []), fotoUrl];
    return this.inspectionRepo.save(insp);
  }

  // ─── VERIFY DRIVER ──────────────────────────────────────────────────────────
  async verifyDriver(dto: VerifyDriverDto, inspector: User) {
    const insp = await this.findOne(dto.inspection_id, inspector);

    insp.driver_id = dto.driver_id;
    insp.verificacion_conductor = {
      conductor_coincide: dto.conductor_coincide,
      licencia_vigente: dto.licencia_vigente,
      licencia_categoria_correcta: dto.licencia_categoria_correcta,
      estado_fatiga_visual: dto.estado_fatiga_visual,
      observaciones_conductor: dto.observaciones_conductor ?? '',
    };

    // Auto-alert: conductor diferente
    if (!dto.conductor_coincide) {
      await this.createNotification(inspector.id, 'ALERTA: Conductor diferente detectado en inspección ' + insp.id, 'CONDUCTOR_DIFERENTE');
    }

    // Auto-alert: muy cansado
    if (dto.estado_fatiga_visual === 'MUY_CANSADO') {
      await this.createNotification(inspector.id, `ALERTA: Conductor ${dto.driver_id} visualmente muy cansado`, 'FATIGA_VISUAL');
    }

    return this.inspectionRepo.save(insp);
  }

  // ─── VERIFY VEHICLE ─────────────────────────────────────────────────────────
  async verifyVehicle(dto: VerifyVehicleDto, inspector: User) {
    const insp = await this.findOne(dto.inspection_id, inspector);

    insp.vehicle_id = dto.vehicle_id;
    insp.verificacion_vehiculo = {
      estado_general: dto.estado_general,
      luces_funcionan: dto.luces_funcionan,
      llantas_estado: dto.llantas_estado,
      documentos_vigentes: dto.documentos_vigentes,
      soat_vigente: dto.soat_vigente,
      revision_tecnica_vigente: dto.revision_tecnica_vigente,
      capacidad_excedida: dto.capacidad_excedida,
      observaciones_vehiculo: dto.observaciones_vehiculo ?? '',
    };

    if (dto.estado_general === 'MALO' || dto.capacidad_excedida) {
      await this.createNotification(inspector.id, `ALERTA GRAVE: Vehículo ${dto.vehicle_id} con problemas críticos`, 'VEHICULO_CRITICO');
    }

    return this.inspectionRepo.save(insp);
  }

  // ─── FINALIZE INSPECTION ────────────────────────────────────────────────────
  async finalizeInspection(id: string, dto: FinalizeInspectionDto, inspector: User) {
    const insp = await this.findOne(id, inspector);

    if (insp.resultado !== InspectionResultado.EN_PROCESO) {
      throw new BadRequestException('La inspección ya fue finalizada');
    }

    insp.resultado = dto.resultado;
    if (dto.notas_adicionales) insp.notas_adicionales = dto.notas_adicionales;

    await this.auditRepo.save(this.auditRepo.create({
      user_id: inspector.id,
      action: 'INSPECTION_FINALIZED',
      entity_type: 'Inspection',
      entity_id: insp.id,
      details_json: { resultado: dto.resultado, derivar_sancion: dto.derivar_sancion ?? false },
    }));

    if (dto.derivar_sancion && dto.resultado === InspectionResultado.INFRACCION_DETECTADA) {
      const driverId = insp.driver_id ?? (insp.verificacion_conductor as any)?.driver_id ?? null;
      const municipalityId = inspector.municipality_id ?? insp.municipality_id;

      if (driverId && municipalityId) {
        const appealDeadline = new Date();
        appealDeadline.setDate(appealDeadline.getDate() + 3);

        const sanction = await this.sanctionRepo.save(
          this.sanctionRepo.create({
            driver_id:       driverId,
            level:           1,
            reason:          `Infracción detectada en inspección de campo (ID: ${insp.id})`,
            evidence_ids:    insp.fotos_evidencia ?? [],
            appeal_status:   AppealStatus.SIN_APELACION,
            appeal_deadline: appealDeadline,
            municipality_id: municipalityId,
            issued_by_id:    inspector.id,
          }),
        );
        insp.sanction_id = sanction.id;
      }

      await this.createNotification(
        inspector.id,
        `Inspección ${insp.id} derivada a proceso de sanción por INFRACCION_DETECTADA`,
        'SANCION_DERIVADA',
      );
    }

    return this.inspectionRepo.save(insp);
  }

  // ─── MY STATS ───────────────────────────────────────────────────────────────
  async getStats(inspector: User) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const [total, mes, semana, infraccionesMes] = await Promise.all([
      this.inspectionRepo.count({ where: { inspector_id: inspector.id } }),
      this.inspectionRepo.count({ where: { inspector_id: inspector.id, created_at: MoreThanOrEqual(startOfMonth) } }),
      this.inspectionRepo.count({ where: { inspector_id: inspector.id, created_at: MoreThanOrEqual(startOfWeek) } }),
      this.inspectionRepo.count({
        where: { inspector_id: inspector.id, resultado: InspectionResultado.INFRACCION_DETECTADA, created_at: MoreThanOrEqual(startOfMonth) },
      }),
    ]);

    // By tipo
    const porTipoRaw = await this.inspectionRepo
      .createQueryBuilder('i')
      .select('i.tipo', 'tipo')
      .addSelect('COUNT(*)', 'count')
      .where('i.inspector_id = :id', { id: inspector.id })
      .groupBy('i.tipo')
      .getRawMany();
    const por_tipo = Object.fromEntries(porTipoRaw.map(r => [r.tipo, parseInt(r.count)]));

    // By resultado
    const porResultadoRaw = await this.inspectionRepo
      .createQueryBuilder('i')
      .select('i.resultado', 'resultado')
      .addSelect('COUNT(*)', 'count')
      .where('i.inspector_id = :id', { id: inspector.id })
      .groupBy('i.resultado')
      .getRawMany();
    const por_resultado = Object.fromEntries(porResultadoRaw.map(r => [r.resultado, parseInt(r.count)]));

    // Per day last 30 days
    const porDiaRaw = await this.inspectionRepo
      .createQueryBuilder('i')
      .select("DATE(i.created_at AT TIME ZONE 'America/Lima')", 'fecha')
      .addSelect('COUNT(*)', 'cantidad')
      .where('i.inspector_id = :id', { id: inspector.id })
      .andWhere('i.created_at >= :d', { d: thirtyDaysAgo })
      .groupBy("DATE(i.created_at AT TIME ZONE 'America/Lima')")
      .orderBy('fecha', 'ASC')
      .getRawMany();
    const inspecciones_por_dia = porDiaRaw.map(r => ({ fecha: r.fecha, cantidad: parseInt(r.cantidad) }));

    const tasa_infraccion = mes > 0 ? Math.round((infraccionesMes / mes) * 100) : 0;

    return {
      total_inspecciones: total,
      inspecciones_mes: mes,
      inspecciones_semana: semana,
      infracciones_detectadas_mes: infraccionesMes,
      sanciones_derivadas_mes: 0, // placeholder – could be extended
      tasa_infraccion,
      por_tipo,
      por_resultado,
      inspecciones_por_dia,
    };
  }

  // ─── LOOKUP DRIVER BY DNI ────────────────────────────────────────────────────
  async lookupDriver(dni: string, inspector: User) {
    const driver = await this.driverRepo
      .createQueryBuilder('d')
      .innerJoinAndSelect('d.company', 'c')
      .where('d.dni = :dni', { dni })
      .andWhere('c.municipality_id = :mId', { mId: inspector.municipality_id })
      .getOne();

    if (!driver) throw new NotFoundException(`Conductor con DNI ${dni} no encontrado en tu municipalidad`);

    const today = new Date();
    const licVigente = driver.license_expires_at ? new Date(driver.license_expires_at) > today : null;
    const diasVencLic = driver.license_expires_at
      ? Math.ceil((new Date(driver.license_expires_at).getTime() - today.getTime()) / 86400000)
      : null;

    // Active trip
    const activeTrip = await this.tripDriverRepo
      .createQueryBuilder('td')
      .innerJoinAndSelect('td.trip', 'tr')
      .innerJoinAndSelect('tr.vehicle', 'v')
      .innerJoinAndSelect('tr.route', 'r')
      .where('td.driver_id = :dId', { dId: driver.id })
      .andWhere('tr.status = :s', { s: TripStatus.EN_CURSO })
      .getOne();

    return {
      id: driver.id,
      nombre: driver.name,
      dni: driver.dni,
      foto_url: driver.photo_url ?? null,
      empresa: { id: (driver.company as any).id, nombre: (driver.company as any).name },
      licencia: {
        numero: driver.license_number,
        vigente: licVigente,
        vencimiento: driver.license_expires_at,
        dias_para_vencer: diasVencLic,
      },
      fatiga: {
        estado: driver.status,
        horas_conducidas_24h: Number(driver.total_hours_driven_24h ?? 0),
        ultima_pausa: driver.last_rest_start,
      },
      reputation_score: driver.reputation_score,
      viaje_activo: activeTrip ? {
        id: (activeTrip as any).trip?.id,
        ruta: {
          origen: (activeTrip as any).trip?.route?.origin,
          destino: (activeTrip as any).trip?.route?.destination,
        },
        vehiculo: { placa: (activeTrip as any).trip?.vehicle?.plate },
        hora_inicio: (activeTrip as any).trip?.start_time,
      } : null,
    };
  }

  // ─── LOOKUP VEHICLE BY PLATE ─────────────────────────────────────────────────
  async lookupVehicle(placa: string, inspector: User) {
    const vehicle = await this.vehicleRepo
      .createQueryBuilder('v')
      .innerJoinAndSelect('v.company', 'c')
      .where('v.plate = :p', { p: placa.toUpperCase() })
      .andWhere('c.municipality_id = :mId', { mId: inspector.municipality_id })
      .getOne();

    if (!vehicle) throw new NotFoundException(`Vehículo con placa ${placa} no encontrado en tu municipalidad`);

    const today = new Date();
    const soatVigente = vehicle.soat_expires_at ? new Date(vehicle.soat_expires_at) > today : false;
    const revTecVigente = vehicle.inspection_expires_at ? new Date(vehicle.inspection_expires_at) > today : false;

    const activeTrip = await this.tripRepo.findOne({
      where: { vehicle_id: vehicle.id, status: TripStatus.EN_CURSO },
      relations: ['route'],
    });

    let conductores: any[] = [];
    if (activeTrip) {
      const tDrivers = await this.tripDriverRepo.find({ where: { trip_id: activeTrip.id }, relations: ['driver'] });
      conductores = tDrivers.map(td => ({
        id: td.driver.id,
        nombre: td.driver.name,
        dni: td.driver.dni,
        foto_url: td.driver.photo_url ?? null,
        estado_fatiga: td.driver.status,
        rol: td.role,
      }));
    }

    return {
      id: vehicle.id,
      placa: vehicle.plate,
      marca: vehicle.brand,
      modelo: vehicle.model,
      year: vehicle.year,
      color: vehicle.color,
      foto_url: vehicle.photo_url ?? null,
      estado: vehicle.status,
      empresa: { nombre: (vehicle.company as any).name, ruc: (vehicle.company as any).ruc },
      documentos: {
        soat_vigente: soatVigente,
        soat_vencimiento: vehicle.soat_expires_at,
        revision_tecnica_vigente: revTecVigente,
        revision_tecnica_vencimiento: vehicle.inspection_expires_at,
      },
      viaje_activo: activeTrip ? {
        id: activeTrip.id,
        ruta: { origen: (activeTrip.route as any)?.origin, destino: (activeTrip.route as any)?.destination },
        hora_inicio: activeTrip.start_time,
        conductores,
      } : null,
    };
  }

  // ─── HELPER ─────────────────────────────────────────────────────────────────
  private async createNotification(userId: string, content: string, type: string) {
    await this.notifRepo.save(this.notifRepo.create({
      user_id: userId,
      channel: NotificationChannel.WEB,
      type,
      title: type.replace(/_/g, ' '),
      content,
      status: NotificationStatus.ENVIADO,
    }));
  }
}
