/**
 * SFIT Database Seed — completo
 *
 * Crea:
 *   - 4 municipalidades
 *   - 7 usuarios por municipalidad (1 admin, 1 fiscal, 2 operadores, 2 ciudadanos, 1 inspector)
 *   - 3 empresas por municipalidad (12 total)
 *   - 5 conductores por empresa (60 total)  →  mix APTO/RIESGO/NO_APTO
 *   - 3 vehículos por empresa (36 total)    →  QR generado
 *   - Rutas predefinidas (2 especiales + 1 local por municipalidad)
 *   - 20 viajes de ejemplo (varios estados)
 *   - 10 reportes ciudadanos (varios estados)
 *   - 5 sanciones de ejemplo
 *
 * Ejecutar:
 *   npm run seed
 *
 * Credenciales (password: Sfit2026!):
 *   admin@tambobamba.gob.pe         → ADMIN_MUNICIPAL  (Cotabambas)
 *   fiscal@tambobamba.gob.pe        → FISCAL
 *   operador1@cotabambas.test       → OPERADOR_EMPRESA
 *   ciudadano1@cotabambas.test      → CIUDADANO
 *   inspector1@cotabambas.test      → INSPECTOR
 */
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { AppDataSource } from '../data-source';
import { Municipality, MunicipalityStatus } from '../../entities/municipality.entity';
import { User, UserRole, UserStatus } from '../../entities/user.entity';
import { Company, CompanyStatus } from '../../entities/company.entity';
import { Driver, DriverStatus } from '../../entities/driver.entity';
import { Vehicle, VehicleStatus } from '../../entities/vehicle.entity';
import { Route, RouteType, RouteStatus } from '../../entities/route.entity';
import { Trip, TripStatus } from '../../entities/trip.entity';
import { TripDriver, TripDriverRole } from '../../entities/trip-driver.entity';
import { Report, ReportType, ReportStatus } from '../../entities/report.entity';
import { Sanction, AppealStatus } from '../../entities/sanction.entity';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const QR_SECRET = process.env.QR_HMAC_SECRET ?? 'sfit_qr_hmac_secret_change_in_prod';

function qrHmac(qrCode: string): string {
  return crypto.createHmac('sha256', QR_SECRET).update(qrCode).digest('hex');
}

function ago(days: number, hours = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(d.getHours() - hours);
  return d;
}

// ─── Static data ──────────────────────────────────────────────────────────────

const MUNICIPALITIES_DATA = [
  { name: 'Municipalidad Provincial de Cotabambas',   province: 'Cotabambas',   district: 'Tambobamba',    region: 'Apurímac', slug: 'cotabambas',    adminEmail: 'admin@tambobamba.gob.pe',    fiscalEmail: 'fiscal@tambobamba.gob.pe' },
  { name: 'Municipalidad Distrital de Challhuahuacho', province: 'Cotabambas',  district: 'Challhuahuacho', region: 'Apurímac', slug: 'challhuahuacho', adminEmail: 'admin@challhuahuacho.gob.pe', fiscalEmail: 'fiscal@challhuahuacho.gob.pe' },
  { name: 'Municipalidad Provincial de Chumbivilcas',  province: 'Chumbivilcas', district: 'Santo Tomás',   region: 'Cusco',    slug: 'chumbivilcas',   adminEmail: 'admin@santotomas.gob.pe',    fiscalEmail: 'fiscal@santotomas.gob.pe' },
  { name: 'Municipalidad Distrital de Colquemarca',    province: 'Chumbivilcas', district: 'Colquemarca',   region: 'Cusco',    slug: 'colquemarca',    adminEmail: 'admin@colquemarca.gob.pe',   fiscalEmail: 'fiscal@colquemarca.gob.pe' },
];

const COMPANY_DATA = [
  'Transportes Andinos', 'Express Altiplano', 'Trans Cordillera',
  'Viajes Seguros del Sur', 'Movilidad Regional', 'Trans Inca Imperial',
  'Buses del Valle', 'Trans Minero', 'Rutas del Andino',
  'Nuevo Horizonte', 'Trans Andes Sur', 'Flota Regional',
];

const DRIVER_NAMES = [
  'Juan Quispe Mamani', 'Pedro Condori López', 'Luis Huanca Flores',
  'Roberto Ccama Quispe', 'Felipe Mamani Ticona', 'Carlos Layme Turpo',
  'Miguel Puma Quispe', 'Julio Cusi Mamani', 'Eduardo Flores Condori',
  'Ricardo Apaza Ticona', 'Héctor Ramírez Coaquira', 'Marcos Vilca Huanca',
  'Elías Chura Mamani', 'Jorge Callata Quispe', 'Andrés Puma Ccama',
];

const REPORT_DESCRIPTIONS = [
  'Conductor manejando a exceso de velocidad en zona escolar.',
  'Vehículo con luces traseras en mal estado, riesgo nocturno.',
  'Conductor realizó maniobras peligrosas en curvas.',
  'El conductor no corresponde a la foto del sistema.',
  'Conductor usando el celular mientras manejaba.',
  'Se observaron frenos deficientes en el vehículo.',
  'Conductor realizó paradas no autorizadas.',
  'Vehículo emitía humo excesivo durante el trayecto.',
  'Conductor ignoró señal de pare en intersección.',
  'Exceso de pasajeros por encima de la capacidad.',
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Iniciando seed SFIT completo...\n');
  await AppDataSource.initialize();

  const munRepo      = AppDataSource.getRepository(Municipality);
  const userRepo     = AppDataSource.getRepository(User);
  const companyRepo  = AppDataSource.getRepository(Company);
  const driverRepo   = AppDataSource.getRepository(Driver);
  const vehicleRepo  = AppDataSource.getRepository(Vehicle);
  const routeRepo    = AppDataSource.getRepository(Route);
  const tripRepo     = AppDataSource.getRepository(Trip);
  const tdRepo       = AppDataSource.getRepository(TripDriver);
  const reportRepo   = AppDataSource.getRepository(Report);
  const sanctionRepo  = AppDataSource.getRepository(Sanction);

  const pwHash = await bcrypt.hash('Sfit2026!', 10);

  // Track created entities for cross-referencing
  const municipalities: Municipality[] = [];
  const allCompanies:   Company[]      = [];
  const allDrivers:     Driver[]       = [];
  const allVehicles:    Vehicle[]      = [];
  const allRoutes:      Route[]        = [];
  const allUsers:       User[]         = [];

  // ── MUNICIPALIDADES ──────────────────────────────────────────────────────

  console.log('📍 Municipalidades...');
  for (const md of MUNICIPALITIES_DATA) {
    let mun = await munRepo.findOne({ where: { name: md.name } });
    if (!mun) {
      mun = await munRepo.save(munRepo.create({
        name: md.name, province: md.province, district: md.district,
        region: md.region, status: MunicipalityStatus.ACTIVO,
        config_json: {
          sanction_thresholds: { level1: 1, level2: 3, level3: 5, level4: 8 },
          reputation_weights:  { fatigue: 0.4, reports: 0.3, incidents: 0.3 },
          fatigue_rules:       { max_hours_24h: 10, warning_hours_24h: 8, min_rest_hours: 8 },
        },
      }));
      console.log(`  ✅ ${mun.name}`);
    } else {
      console.log(`  ⏭  ${mun.name} (ya existe)`);
    }
    municipalities.push(mun);
  }

  // ── USUARIOS ─────────────────────────────────────────────────────────────

  console.log('\n👤 Usuarios...');
  for (const [i, mun] of municipalities.entries()) {
    const md   = MUNICIPALITIES_DATA[i];
    const slug = md.slug;
    const userDefs = [
      { email: md.adminEmail,            name: `Admin ${md.district}`,    role: UserRole.ADMIN_MUNICIPAL,  pts: 0   },
      { email: md.fiscalEmail,           name: `Fiscal ${md.district}`,   role: UserRole.FISCAL,           pts: 0   },
      { email: `operador1@${slug}.test`, name: `Operador 1 ${md.district}`, role: UserRole.OPERADOR_EMPRESA, pts: 0   },
      { email: `operador2@${slug}.test`, name: `Operador 2 ${md.district}`, role: UserRole.OPERADOR_EMPRESA, pts: 0   },
      { email: `ciudadano1@${slug}.test`,name: `María Quispe - ${md.district}`, role: UserRole.CIUDADANO,  pts: 150, dni: `7${slug.slice(0,3).padEnd(7,'1')}` },
      { email: `ciudadano2@${slug}.test`,name: `José Mamani - ${md.district}`,  role: UserRole.CIUDADANO,  pts: 80,  dni: `7${slug.slice(0,3).padEnd(7,'2')}` },
      { email: `inspector1@${slug}.test`,name: `Inspector 1 ${md.district}`,   role: UserRole.INSPECTOR,   pts: 0   },
    ];
    for (const ud of userDefs) {
      let u = await userRepo.findOne({ where: { email: ud.email } });
      if (!u) {
        u = await userRepo.save(userRepo.create({
          email: ud.email, password_hash: pwHash, name: ud.name, role: ud.role,
          municipality_id: mun.id, status: UserStatus.ACTIVO,
          reputation_score: 100, total_points: ud.pts, reports_today: 0,
          ...(('dni' in ud && ud.dni) ? { dni: ud.dni } : {}),
        }));
        console.log(`  ✅ ${ud.email}`);
      } else {
        console.log(`  ⏭  ${ud.email}`);
      }
      allUsers.push(u);
    }
  }

  // ── EMPRESAS ─────────────────────────────────────────────────────────────

  console.log('\n🏢 Empresas...');
  const suffixes = ['S.A.C.', 'E.I.R.L.', 'S.C.R.L.'];
  let cidx = 0;
  for (const mun of municipalities) {
    for (let j = 0; j < 3; j++) {
      const ruc  = `2${String(cidx + 10).padStart(10, '0')}`;
      const name = `${COMPANY_DATA[cidx % COMPANY_DATA.length]} ${suffixes[j]}`;
      let co = await companyRepo.findOne({ where: { ruc } });
      if (!co) {
        co = await companyRepo.save(companyRepo.create({
          ruc, name, municipality_id: mun.id,
          status: CompanyStatus.ACTIVO, reputation_score: 75 + j * 5,
        }));
        console.log(`  ✅ ${name}`);
      } else {
        console.log(`  ⏭  ${name}`);
      }
      allCompanies.push(co);
      cidx++;
    }
  }

  // ── CONDUCTORES ───────────────────────────────────────────────────────────

  console.log('\n🧑‍✈️ Conductores...');
  const statusMix: DriverStatus[] = [DriverStatus.APTO, DriverStatus.APTO, DriverStatus.APTO, DriverStatus.RIESGO, DriverStatus.NO_APTO];
  let dnameIdx = 0;
  for (const [ci, company] of allCompanies.entries()) {
    for (let k = 0; k < 5; k++) {
      const dni    = String(10000000 + ci * 5 + k).slice(0, 8);
      const status = statusMix[k];
      let drv = await driverRepo.findOne({ where: { dni } });
      if (!drv) {
        drv = await driverRepo.save(driverRepo.create({
          dni,
          name: DRIVER_NAMES[dnameIdx % DRIVER_NAMES.length],
          company_id:    company.id,
          license_number:`B-IIa-${10000 + dnameIdx}`,
          status,
          reputation_score: status === DriverStatus.APTO ? 85 + k : status === DriverStatus.RIESGO ? 55 : 28,
          total_hours_driven_24h: status === DriverStatus.NO_APTO ? 11.5 : status === DriverStatus.RIESGO ? 8.5 : 2,
          last_rest_start: ago(0, status === DriverStatus.NO_APTO ? 1 : 10),
        }));
        allDrivers.push(drv);
      } else {
        allDrivers.push(drv);
      }
      dnameIdx++;
    }
  }
  console.log(`  ✅ ${allDrivers.length} conductores`);

  // ── VEHÍCULOS ─────────────────────────────────────────────────────────────

  console.log('\n🚌 Vehículos...');
  const platePool = ['ABC', 'BCD', 'CDE', 'DEF', 'EFG', 'FGH', 'GHI', 'HIJ', 'IJK', 'JKL', 'KLM', 'LMN'];
  for (const [ci, company] of allCompanies.entries()) {
    for (let v = 0; v < 3; v++) {
      const plate = `${platePool[ci % platePool.length]}-${String(100 + ci * 3 + v).padStart(3,'0')}`;
      let veh = await vehicleRepo.findOne({ where: { plate } });
      if (!veh) {
        const qr_code = uuidv4();
        veh = await vehicleRepo.save(vehicleRepo.create({
          plate, company_id: company.id,
          qr_code, qr_hmac: qrHmac(qr_code),
          status: VehicleStatus.ACTIVO,
          reputation_score: 80 + v * 5,
        }));
        allVehicles.push(veh);
      } else {
        allVehicles.push(veh);
      }
    }
  }
  console.log(`  ✅ ${allVehicles.length} vehículos`);

  // ── RUTAS ─────────────────────────────────────────────────────────────────

  console.log('\n🗺  Rutas...');

  // Rutas especiales
  const specialRoutesData = [
    { origin: 'Arequipa', dest: 'Challhuahuacho', stops: ['Cailloma','Imata','Condoroma'], mins: 660, min_drivers: 2, rest: null,  roundtrip: false, munIdx: 1 },
    { origin: 'Cusco',    dest: 'Tambobamba',     stops: ['Livitaca','Velille'],           mins: 300, min_drivers: 1, rest: 4,     roundtrip: true,  munIdx: 0 },
  ];
  for (const rd of specialRoutesData) {
    const mun = municipalities[rd.munIdx];
    let r = await routeRepo.findOne({ where: { origin: rd.origin, destination: rd.dest, municipality_id: mun.id } });
    if (!r) {
      r = await routeRepo.save(routeRepo.create({
        origin: rd.origin, destination: rd.dest, stops: rd.stops,
        estimated_duration_minutes: rd.mins, type: RouteType.PREDEFINIDA,
        min_drivers: rd.min_drivers, rest_between_legs_hours: rd.rest ?? undefined,
        allows_roundtrip: rd.roundtrip, municipality_id: mun.id, status: RouteStatus.ACTIVA,
      }));
      console.log(`  ✅ Especial: ${r.origin} → ${r.destination} (min_drivers=${r.min_drivers})`);
    } else {
      console.log(`  ⏭  Especial: ${rd.origin} → ${rd.dest}`);
    }
    allRoutes.push(r);
  }

  // Ruta local por municipalidad
  for (const mun of municipalities) {
    const origin = `Terminal ${mun.district}`, dest = `Centro ${mun.district}`;
    let r = await routeRepo.findOne({ where: { origin, municipality_id: mun.id } });
    if (!r) {
      r = await routeRepo.save(routeRepo.create({
        origin, destination: dest, estimated_duration_minutes: 45,
        type: RouteType.PREDEFINIDA, min_drivers: 1,
        allows_roundtrip: false, municipality_id: mun.id, status: RouteStatus.ACTIVA,
      }));
      console.log(`  ✅ Local: ${r.origin} → ${r.destination}`);
    }
    allRoutes.push(r);
  }

  // ── VIAJES (20) ──────────────────────────────────────────────────────────

  console.log('\n🚍 Viajes de ejemplo...');
  const localRoutes = allRoutes.filter(r => r.origin.startsWith('Terminal'));
  const tripDefs: Array<{ status: TripStatus; daysAgo: number; munIdx: number }> = [
    { status: TripStatus.FINALIZADO,  daysAgo: 1,  munIdx: 0 },
    { status: TripStatus.FINALIZADO,  daysAgo: 2,  munIdx: 0 },
    { status: TripStatus.FINALIZADO,  daysAgo: 3,  munIdx: 1 },
    { status: TripStatus.FINALIZADO,  daysAgo: 4,  munIdx: 1 },
    { status: TripStatus.FINALIZADO,  daysAgo: 5,  munIdx: 2 },
    { status: TripStatus.FINALIZADO,  daysAgo: 6,  munIdx: 2 },
    { status: TripStatus.FINALIZADO,  daysAgo: 7,  munIdx: 3 },
    { status: TripStatus.FINALIZADO,  daysAgo: 8,  munIdx: 3 },
    { status: TripStatus.FINALIZADO,  daysAgo: 9,  munIdx: 0 },
    { status: TripStatus.FINALIZADO,  daysAgo: 10, munIdx: 1 },
    { status: TripStatus.EN_CURSO,    daysAgo: 0,  munIdx: 0 },
    { status: TripStatus.EN_CURSO,    daysAgo: 0,  munIdx: 1 },
    { status: TripStatus.EN_CURSO,    daysAgo: 0,  munIdx: 2 },
    { status: TripStatus.EN_CURSO,    daysAgo: 0,  munIdx: 3 },
    { status: TripStatus.EN_CURSO,    daysAgo: 0,  munIdx: 0 },
    { status: TripStatus.CERRADO_AUTO,daysAgo: 1,  munIdx: 1 },
    { status: TripStatus.CERRADO_AUTO,daysAgo: 2,  munIdx: 2 },
    { status: TripStatus.CERRADO_AUTO,daysAgo: 3,  munIdx: 3 },
    { status: TripStatus.REGISTRADO,  daysAgo: 0,  munIdx: 0 },
    { status: TripStatus.REGISTRADO,  daysAgo: 0,  munIdx: 2 },
  ];

  const allTrips: Trip[] = [];
  for (const td of tripDefs) {
    const mun = municipalities[td.munIdx];
    const company = allCompanies.find(c => c.municipality_id === mun.id)!;
    const driver  = allDrivers.find(d => d.company_id === company.id && d.status === DriverStatus.APTO);
    const vehicle = allVehicles.find(v => v.company_id === company.id);
    const route   = localRoutes.find(r => r.municipality_id === mun.id);
    if (!driver || !vehicle || !route) continue;

    const start   = ago(td.daysAgo, 2);
    const end     = [TripStatus.FINALIZADO, TripStatus.CERRADO_AUTO].includes(td.status)
      ? new Date(start.getTime() + route.estimated_duration_minutes * 60_000) : undefined;

    const trip = await tripRepo.save(tripRepo.create({
      vehicle_id: vehicle.id, route_id: route.id,
      start_time: start, end_time: end, status: td.status,
      auto_closed: td.status === TripStatus.CERRADO_AUTO,
      is_return_leg: false, municipality_id: mun.id,
      fatigue_result: td.status === TripStatus.FINALIZADO ? 'APTO' as any : undefined,
    }));
    await tdRepo.save(tdRepo.create({
      trip_id: trip.id, driver_id: driver.id,
      role: TripDriverRole.PRINCIPAL, fatigue_check_result: 'APTO' as any,
    }));
    allTrips.push(trip);
  }
  console.log(`  ✅ ${allTrips.length} viajes`);

  // ── REPORTES (10) ────────────────────────────────────────────────────────

  console.log('\n📋 Reportes ciudadanos...');
  const citizens     = allUsers.filter(u => u.role === UserRole.CIUDADANO);
  const finishedTrips = allTrips.filter(t => t.status === TripStatus.FINALIZADO);
  const rStatuses: ReportStatus[] = [
    ReportStatus.VALIDO, ReportStatus.INVALIDO, ReportStatus.EN_REVISION,
    ReportStatus.VALIDO, ReportStatus.EN_REVISION, ReportStatus.VALIDO,
    ReportStatus.INVALIDO, ReportStatus.EN_REVISION, ReportStatus.VALIDO, ReportStatus.EN_REVISION,
  ];
  const rTypes: ReportType[] = [
    ReportType.CONDUCCION_PELIGROSA, ReportType.EXCESO_VELOCIDAD, ReportType.CONDICION_VEHICULO,
    ReportType.CONDUCTOR_DIFERENTE, ReportType.OTRO, ReportType.CONDUCCION_PELIGROSA,
    ReportType.EXCESO_VELOCIDAD, ReportType.CONDICION_VEHICULO, ReportType.OTRO, ReportType.EXCESO_VELOCIDAD,
  ];
  for (let ri = 0; ri < 10 && ri < finishedTrips.length; ri++) {
    const citizen = citizens[ri % citizens.length];
    const trip    = finishedTrips[ri];
    if (!citizen) continue;
    await reportRepo.save(reportRepo.create({
      citizen_id: citizen.id, trip_id: trip.id,
      type: rTypes[ri], description: REPORT_DESCRIPTIONS[ri],
      status: rStatuses[ri], validation_score: rStatuses[ri] === ReportStatus.VALIDO ? 75 + ri : 40,
    }));
  }
  console.log(`  ✅ 10 reportes`);

  // ── SANCIONES (5) ─────────────────────────────────────────────────────────

  console.log('\n⚠️  Sanciones...');
  const riesgoDrivers = allDrivers
    .filter(d => d.status === DriverStatus.RIESGO || d.status === DriverStatus.NO_APTO)
    .slice(0, 5);
  const sLevels:   number[]        = [1, 2, 1, 3, 2];
  const sStatuses: AppealStatus[]  = [
    AppealStatus.SIN_APELACION,
    AppealStatus.SIN_APELACION,
    AppealStatus.EN_APELACION,
    AppealStatus.SIN_APELACION,
    AppealStatus.APELACION_ACEPTADA,
  ];

  for (let si = 0; si < Math.min(5, riesgoDrivers.length); si++) {
    const driver  = riesgoDrivers[si];
    const company = allCompanies.find(c => c.id === driver.company_id)!;
    const munId   = company?.municipality_id ?? municipalities[0].id;
    await sanctionRepo.save(sanctionRepo.create({
      driver_id:      driver.id,
      level:          sLevels[si],
      reason:         `Acumulación de incidentes de fatiga — Nivel ${sLevels[si]}`,
      appeal_status:  sStatuses[si],
      municipality_id: munId,
      appeal_deadline: new Date(Date.now() + 5 * 86_400_000),
      fine_amount:    sLevels[si] >= 3 ? 500 : null,
    }));
  }
  console.log(`  ✅ ${Math.min(5, riesgoDrivers.length)} sanciones`);

  // ─────────────────────────────────────────────────────────────────────────

  await AppDataSource.destroy();

  console.log('\n✅ Seed completado exitosamente.');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(' CREDENCIALES DE ACCESO   (contraseña: Sfit2026!)');
  console.log('═══════════════════════════════════════════════════════════');
  for (const md of MUNICIPALITIES_DATA) {
    console.log(`\n  ${md.district.toUpperCase()}:`);
    console.log(`    Admin    → ${md.adminEmail}`);
    console.log(`    Fiscal   → ${md.fiscalEmail}`);
    console.log(`    Operador → operador1@${md.slug}.test`);
    console.log(`    Ciudadano→ ciudadano1@${md.slug}.test`);
  }
  console.log('\n');
}

main().catch(err => {
  console.error('❌ Seed falló:', err);
  process.exit(1);
});
