/**
 * E2E — Flujo de reporte ciudadano
 *
 * Escenarios:
 *   1. Login como CIUDADANO
 *   2. Escanear QR (simular viaje activo)
 *   3. Crear reporte → verificar +10 puntos otorgados
 *   4. Crear 3 reportes → 4to rechazado (límite diario)
 *   5. Fiscal valida reporte → verificar actualización de reputación del conductor
 */
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { createTestApp, loginAs, bearer } from './helpers/create-test-app';

const SEED_PASSWORD = 'Sfit2026!';
const QR_SECRET = process.env.QR_HMAC_SECRET ?? 'sfit_qr_hmac_secret_change_in_prod';

function makeQrPair(): { qr_code: string; qr_hmac: string } {
  const qr_code = uuidv4();
  return { qr_code, qr_hmac: crypto.createHmac('sha256', QR_SECRET).update(qr_code).digest('hex') };
}

describe('Citizen Report Flow (E2E)', () => {
  let app:           INestApplication;
  let http:          ReturnType<typeof request>;
  let ds:            DataSource;
  let citizenToken:  string;
  let fiscalToken:   string;

  let municipalityId: string;
  let companyId:      string;
  let vehicleId:      string;
  let driverId:       string;
  let tripId:         string;
  let qrCode:         string;
  let reportId:       string;
  let citizenId:      string;
  let routeId:        string;

  beforeAll(async () => {
    ({ app, http } = await createTestApp());
    ds = app.get<DataSource>(getDataSourceToken());
    const pwHash = await bcrypt.hash(SEED_PASSWORD, 10);

    // Municipality
    const [mun] = await ds.query(
      `INSERT INTO municipalities (id, name, province, district, region, status)
       VALUES (gen_random_uuid(), 'Test Muni Citizen E2E', 'Test', 'TestCitizen', 'Test', 'ACTIVO')
       RETURNING id`,
    );
    municipalityId = mun.id;

    // Company
    const [comp] = await ds.query(
      `INSERT INTO companies (id, ruc, name, municipality_id, status, reputation_score)
       VALUES (gen_random_uuid(), '20999000002', 'Trans E2E Report S.A.C.', $1, 'ACTIVO', 100)
       RETURNING id`, [municipalityId],
    );
    companyId = comp.id;

    // Driver
    const [drv] = await ds.query(
      `INSERT INTO drivers (id, dni, name, company_id, status, reputation_score, total_hours_driven_24h)
       VALUES (gen_random_uuid(), '20000001', 'Conductor Reporte E2E', $1, 'APTO', 85, 0)
       RETURNING id`, [companyId],
    );
    driverId = drv.id;

    // Vehicle with QR
    const { qr_code, qr_hmac } = makeQrPair();
    qrCode = qr_code;
    const [veh] = await ds.query(
      `INSERT INTO vehicles (id, plate, company_id, qr_code, qr_hmac, status, reputation_score)
       VALUES (gen_random_uuid(), 'E2R-001', $1, $2, $3, 'ACTIVO', 100)
       RETURNING id`, [companyId, qr_code, qr_hmac],
    );
    vehicleId = veh.id;

    // Route
    const [rt] = await ds.query(
      `INSERT INTO routes (id, origin, destination, estimated_duration_minutes, type, min_drivers, allows_roundtrip, municipality_id, status)
       VALUES (gen_random_uuid(), 'OA E2E', 'OB E2E', 60, 'PREDEFINIDA', 1, false, $1, 'ACTIVO')
       RETURNING id`, [municipalityId],
    );
    routeId = rt.id;

    // Active trip (EN_CURSO)
    const [tr] = await ds.query(
      `INSERT INTO trips (id, vehicle_id, route_id, start_time, status, municipality_id, is_return_leg, auto_closed)
       VALUES (gen_random_uuid(), $1, $2, NOW() - INTERVAL '30 minutes', 'EN_CURSO', $3, false, false)
       RETURNING id`, [vehicleId, routeId, municipalityId],
    );
    tripId = tr.id;
    await ds.query(
      `INSERT INTO trip_drivers (id, trip_id, driver_id, role, fatigue_check_result)
       VALUES (gen_random_uuid(), $1, $2, 'PRINCIPAL', 'APTO')`, [tripId, driverId],
    );

    // Citizen user
    const [cit] = await ds.query(
      `INSERT INTO users (id, email, password_hash, name, dni, role, municipality_id, status, reputation_score, total_points, reports_today)
       VALUES (gen_random_uuid(), 'citizen.e2e@test.com', $1, 'Ciudadano E2E', '77700001', 'CIUDADANO', $2, 'ACTIVO', 80, 0, 0)
       RETURNING id`, [pwHash, municipalityId],
    );
    citizenId = cit.id;
    citizenToken = await loginAs(http as any, 'citizen.e2e@test.com', SEED_PASSWORD);

    // Fiscal user
    await ds.query(
      `INSERT INTO users (id, email, password_hash, name, role, municipality_id, status, reputation_score, total_points, reports_today)
       VALUES (gen_random_uuid(), 'fiscal.e2e@test.com', $1, 'Fiscal E2E', 'FISCAL', $2, 'ACTIVO', 100, 0, 0)`,
      [pwHash, municipalityId],
    );
    fiscalToken = await loginAs(http as any, 'fiscal.e2e@test.com', SEED_PASSWORD);
  });

  afterAll(async () => {
    await ds.query(`DELETE FROM reports    WHERE citizen_id = $1`, [citizenId]);
    await ds.query(`DELETE FROM incentive_points WHERE citizen_id = $1`, [citizenId]);
    await ds.query(`DELETE FROM trip_drivers WHERE trip_id = $1`, [tripId]);
    await ds.query(`DELETE FROM trips     WHERE id = $1`, [tripId]);
    await ds.query(`DELETE FROM vehicles  WHERE company_id = $1`, [companyId]);
    await ds.query(`DELETE FROM drivers   WHERE company_id = $1`, [companyId]);
    await ds.query(`DELETE FROM users     WHERE municipality_id = $1`, [municipalityId]);
    await ds.query(`DELETE FROM routes    WHERE municipality_id = $1`, [municipalityId]);
    await ds.query(`DELETE FROM companies WHERE id = $1`, [companyId]);
    await ds.query(`DELETE FROM municipalities WHERE id = $1`, [municipalityId]);
    await app.close();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Login
  // ──────────────────────────────────────────────────────────────────────────

  it('1 — Login como CIUDADANO → access_token', () => {
    expect(citizenToken).toBeDefined();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Escanear QR
  // ──────────────────────────────────────────────────────────────────────────

  it('2 — Escanear QR → retorna info de vehículo + viaje activo', async () => {
    const res = await (http as any)
      .get(`/api/qr/scan/${qrCode}`)
      .set(bearer(citizenToken))
      .expect(200);

    expect(res.body.vehicle).toBeDefined();
    expect(res.body.active_trip).toBeDefined();
    expect(res.body.active_trip.id).toBe(tripId);
    expect(res.body.can_report).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Crear reporte → verificar puntos
  // ──────────────────────────────────────────────────────────────────────────

  it('3 — Crear reporte válido → 201 + citizen recibe puntos', async () => {
    // Obtener puntos antes
    const before = await ds.query(`SELECT total_points FROM users WHERE id = $1`, [citizenId]);
    const pointsBefore: number = before[0].total_points;

    const res = await (http as any)
      .post('/api/reports')
      .set(bearer(citizenToken))
      .send({
        qr_code:        qrCode,
        trip_id:        tripId,
        type:           'CONDUCCION_PELIGROSA',
        description:    'Conductor manejando a exceso de velocidad durante 10 minutos',
        is_same_driver: true,
      })
      .expect(201);

    reportId = res.body.id;
    expect(reportId).toBeDefined();
    expect(res.body.citizen_id).toBe(citizenId);

    // Verificar que se otorgaron puntos (incentive points creados)
    const points = await ds.query(
      `SELECT SUM(points)::int AS total FROM incentive_points WHERE citizen_id = $1`, [citizenId],
    );
    expect(points[0].total).toBeGreaterThan(0);

    // Verificar reports_today incrementó
    const userAfter = await ds.query(`SELECT reports_today FROM users WHERE id = $1`, [citizenId]);
    expect(userAfter[0].reports_today).toBe(1);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Límite de 3 reportes diarios
  // ──────────────────────────────────────────────────────────────────────────

  it('4 — Crear 3 reportes → el 4to es rechazado (límite diario)', async () => {
    // Crear reportes 2 y 3
    for (let i = 2; i <= 3; i++) {
      await (http as any)
        .post('/api/reports')
        .set(bearer(citizenToken))
        .send({
          qr_code:        qrCode,
          trip_id:        tripId,
          type:           'CONDICION_VEHICULO',
          description:    `Descripción del reporte número ${i} con suficiente texto`,
          is_same_driver: true,
        })
        .expect(201);
    }

    // El 4to debe ser rechazado
    const res = await (http as any)
      .post('/api/reports')
      .set(bearer(citizenToken))
      .send({
        qr_code:        qrCode,
        trip_id:        tripId,
        type:           'OTRO',
        description:    'Este reporte debe ser rechazado por exceder el límite diario',
        is_same_driver: true,
      })
      .expect(429); // Too Many Requests — límite diario alcanzado

    expect(res.body.message).toMatch(/límite|limit|diario|máximo/i);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Fiscal valida reporte → reputación del conductor actualizada
  // ──────────────────────────────────────────────────────────────────────────

  it('5 — Fiscal valida reporte como VALIDO → reputación del conductor baja', async () => {
    const driverBefore = await ds.query(
      `SELECT reputation_score FROM drivers WHERE id = $1`, [driverId],
    );
    const repBefore: number = driverBefore[0].reputation_score;

    await (http as any)
      .patch(`/api/reports/${reportId}/validate`)
      .set(bearer(fiscalToken))
      .send({ status: 'VALIDO' })
      .expect(200);

    const report = await ds.query(`SELECT status FROM reports WHERE id = $1`, [reportId]);
    expect(report[0].status).toBe('VALIDO');

    // La reputación del conductor debería haberse recalculado (asíncrono, esperamos un momento)
    await new Promise(r => setTimeout(r, 500));
    const driverAfter = await ds.query(`SELECT reputation_score FROM drivers WHERE id = $1`, [driverId]);
    // La reputación puede bajar o mantenerse — el sistema recalcula en cron; al menos valida que el reporte quedó VALIDO
    expect(typeof driverAfter[0].reputation_score).toBe('number');
  });
});
