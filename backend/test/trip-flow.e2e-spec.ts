/**
 * E2E — Flujo completo de registro de viaje
 *
 * Pre-requisitos:
 *   1. npm i -D supertest @types/supertest
 *   2. Base de datos activa (docker-compose up -d)
 *   3. npm run seed   (crea municipalidades, rutas, empresas, conductores, vehículos)
 *   4. DB_NAME=sfit_db npm run test:e2e -- trip-flow
 *
 * Escenarios cubiertos:
 *   1. Login como OPERADOR_EMPRESA
 *   2. Crear conductor (con foto DNI)
 *   3. Crear vehículo (verificar QR generado)
 *   4. Registrar viaje en ruta normal → APROBADO
 *   5. Intentar viaje con mismo conductor sin descanso → BLOQUEADO (fatiga)
 *   6. Ruta Arequipa-Challhuahuacho con 1 conductor → BLOQUEADO (min_drivers)
 *   7. Ruta Arequipa-Challhuahuacho con 2 conductores APTOS → APROBADO
 *   8. Viaje de retorno Cusco-Tambobamba sin cumplir 4h descanso → BLOQUEADO
 */
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { createTestApp, loginAs, bearer } from './helpers/create-test-app';

// ─── Test data ────────────────────────────────────────────────────────────────

const SEED_PASSWORD = 'Sfit2026!';
const QR_SECRET    = process.env.QR_HMAC_SECRET ?? 'sfit_qr_hmac_secret_change_in_prod';

function makeQr(): { qr_code: string; qr_hmac: string } {
  const qr_code = uuidv4();
  const qr_hmac = crypto.createHmac('sha256', QR_SECRET).update(qr_code).digest('hex');
  return { qr_code, qr_hmac };
}

describe('Trip Registration Flow (E2E)', () => {
  let app:           INestApplication;
  let http:          ReturnType<typeof request>;
  let ds:            DataSource;
  let operatorToken: string;

  // ── IDs created in beforeAll ──────────────────────────────────────────────
  let municipalityId: string;
  let companyId:      string;
  let driver1Id:      string;   // APTO
  let driver2Id:      string;   // APTO (second driver for special route)
  let vehicleId:      string;
  let routeNormalId:  string;   // min_drivers=1
  let routeSpecialId: string;   // Arequipa-Challhuahuacho, min_drivers=2
  let routeReturnId:  string;   // Cusco-Tambobamba, allows_roundtrip=true, rest=4h
  let parentTripId:   string;   // trip ida for return leg test

  // ─────────────────────────────────────────────────────────────────────────

  beforeAll(async () => {
    ({ app, http } = await createTestApp());
    ds = app.get<DataSource>(getDataSourceToken());

    const pwHash = await bcrypt.hash(SEED_PASSWORD, 10);

    // ── 1. Municipality ──────────────────────────────────────────────────
    const [mun] = await ds.query(
      `INSERT INTO municipalities (id, name, province, district, region, status)
       VALUES (gen_random_uuid(), 'Test Municipalidad E2E', 'Test', 'TestTrip', 'Test', 'ACTIVO')
       RETURNING id`,
    );
    municipalityId = mun.id;

    // ── 2. Company ──────────────────────────────────────────────────────
    const [comp] = await ds.query(
      `INSERT INTO companies (id, ruc, name, municipality_id, status, reputation_score)
       VALUES (gen_random_uuid(), '20999000001', 'Trans E2E Trip S.A.C.', $1, 'ACTIVO', 100)
       RETURNING id`,
      [municipalityId],
    );
    companyId = comp.id;

    // ── 3. Operator user ─────────────────────────────────────────────────
    await ds.query(
      `INSERT INTO users (id, email, password_hash, name, role, municipality_id, status, reputation_score, total_points, reports_today)
       VALUES (gen_random_uuid(), 'op.e2e.trip@test.com', $1, 'Operador Trip E2E', 'OPERADOR_EMPRESA', $2, 'ACTIVO', 100, 0, 0)`,
      [pwHash, municipalityId],
    );
    operatorToken = await loginAs(http as any, 'op.e2e.trip@test.com', SEED_PASSWORD);

    // ── 4. Routes ────────────────────────────────────────────────────────
    const [rNormal] = await ds.query(
      `INSERT INTO routes (id, origin, destination, estimated_duration_minutes, type, min_drivers, allows_roundtrip, municipality_id, status)
       VALUES (gen_random_uuid(), 'Centro E2E', 'Terminal E2E', 60, 'PREDEFINIDA', 1, false, $1, 'ACTIVO')
       RETURNING id`,
      [municipalityId],
    );
    routeNormalId = rNormal.id;

    const [rSpecial] = await ds.query(
      `INSERT INTO routes (id, origin, destination, estimated_duration_minutes, type, min_drivers, allows_roundtrip, municipality_id, status)
       VALUES (gen_random_uuid(), 'Arequipa E2E', 'Challhuahuacho E2E', 660, 'PREDEFINIDA', 2, false, $1, 'ACTIVO')
       RETURNING id`,
      [municipalityId],
    );
    routeSpecialId = rSpecial.id;

    const [rReturn] = await ds.query(
      `INSERT INTO routes (id, origin, destination, estimated_duration_minutes, type, min_drivers, allows_roundtrip, rest_between_legs_hours, municipality_id, status)
       VALUES (gen_random_uuid(), 'Cusco E2E', 'Tambobamba E2E', 300, 'PREDEFINIDA', 1, true, 4, $1, 'ACTIVO')
       RETURNING id`,
      [municipalityId],
    );
    routeReturnId = rReturn.id;
  });

  afterAll(async () => {
    // Cleanup: borrar datos de prueba (orden importa por FK)
    await ds.query(`DELETE FROM trip_drivers WHERE trip_id IN (SELECT id FROM trips WHERE municipality_id = $1)`, [municipalityId]);
    await ds.query(`DELETE FROM trips    WHERE municipality_id = $1`, [municipalityId]);
    await ds.query(`DELETE FROM vehicles WHERE company_id = $1`, [companyId]);
    await ds.query(`DELETE FROM drivers  WHERE company_id = $1`, [companyId]);
    await ds.query(`DELETE FROM users    WHERE municipality_id = $1`, [municipalityId]);
    await ds.query(`DELETE FROM routes   WHERE municipality_id = $1`, [municipalityId]);
    await ds.query(`DELETE FROM companies WHERE id = $1`, [companyId]);
    await ds.query(`DELETE FROM municipalities WHERE id = $1`, [municipalityId]);
    await app.close();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Login
  // ──────────────────────────────────────────────────────────────────────────

  it('1 — Login como OPERADOR_EMPRESA obtiene access_token', () => {
    expect(operatorToken).toBeDefined();
    expect(typeof operatorToken).toBe('string');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Crear conductor
  // ──────────────────────────────────────────────────────────────────────────

  it('2 — Crear conductor (con foto DNI) → 201 + conductor en BD', async () => {
    const res = await (http as any)
      .post('/api/drivers')
      .set(bearer(operatorToken))
      .send({
        dni:              '87654321',
        name:             'Carlos Quispe E2E',
        license_number:   'B-IIa-11111',
        license_photo_url:'https://cdn.test/dni1.jpg',
        company_id:       companyId,
      })
      .expect(201);

    driver1Id = res.body.id;
    expect(driver1Id).toBeDefined();
    expect(res.body.status).toBe('APTO');
    expect(res.body.reputation_score).toBe(100);
  });

  it('2b — Crear segundo conductor APTO → 201', async () => {
    const res = await (http as any)
      .post('/api/drivers')
      .set(bearer(operatorToken))
      .send({
        dni:       '87654322',
        name:      'Mario Flores E2E',
        company_id: companyId,
      })
      .expect(201);

    driver2Id = res.body.id;
    expect(driver2Id).toBeDefined();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Crear vehículo y verificar QR
  // ──────────────────────────────────────────────────────────────────────────

  it('3 — Crear vehículo → 201 + QR data_url generado', async () => {
    const res = await (http as any)
      .post('/api/vehicles')
      .set(bearer(operatorToken))
      .send({ plate: 'E2E-001', company_id: companyId })
      .expect(201);

    vehicleId = res.body.id;
    expect(vehicleId).toBeDefined();
    expect(res.body.qr_code).toBeDefined();
    expect(res.body.qr_data_url).toMatch(/^data:image\/png;base64,/);
    expect(res.body.status).toBe('ACTIVO');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Registrar viaje normal → APROBADO
  // ──────────────────────────────────────────────────────────────────────────

  it('4 — Registrar viaje ruta normal (1 conductor APTO) → 201 REGISTRADO', async () => {
    const res = await (http as any)
      .post('/api/trips')
      .set(bearer(operatorToken))
      .send({
        vehicle_id: vehicleId,
        route_id:   routeNormalId,
        drivers:    [{ driver_id: driver1Id, role: 'PRINCIPAL' }],
      })
      .expect(201);

    expect(res.body.status).toBe('REGISTRADO');
    parentTripId = res.body.id; // guardar para test de retorno
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Mismo conductor sin descanso → BLOQUEADO
  // ──────────────────────────────────────────────────────────────────────────

  it('5 — Mismo conductor sin descanso → 409 bloqueado por fatiga', async () => {
    // Simular fatiga: insertar viaje FINALIZADO de 9 horas en las últimas 24h
    const [fatigueTrip] = await ds.query(
      `INSERT INTO trips (id, vehicle_id, route_id, start_time, end_time, status, municipality_id, is_return_leg, auto_closed)
       VALUES (gen_random_uuid(), $1, $2, NOW() - INTERVAL '10 hours', NOW() - INTERVAL '1 hour', 'FINALIZADO', $3, false, false)
       RETURNING id`,
      [vehicleId, routeNormalId, municipalityId],
    );
    await ds.query(
      `INSERT INTO trip_drivers (id, trip_id, driver_id, role, fatigue_check_result)
       VALUES (gen_random_uuid(), $1, $2, 'PRINCIPAL', 'APTO')`,
      [fatigueTrip.id, driver1Id],
    );

    const res = await (http as any)
      .post('/api/trips')
      .set(bearer(operatorToken))
      .send({
        vehicle_id: vehicleId,
        route_id:   routeNormalId,
        drivers:    [{ driver_id: driver1Id, role: 'PRINCIPAL' }],
      })
      .expect(409);

    expect(res.body.blocked).toBe(true);
    expect(res.body.reasons.some((r: any) => r.type === 'FATIGUE')).toBe(true);

    // Limpiar el viaje de fatiga simulado para no afectar tests posteriores
    await ds.query(`DELETE FROM trip_drivers WHERE trip_id = $1`, [fatigueTrip.id]);
    await ds.query(`DELETE FROM trips WHERE id = $1`, [fatigueTrip.id]);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Ruta especial con 1 conductor → BLOQUEADO (min_drivers=2)
  // ──────────────────────────────────────────────────────────────────────────

  it('6 — Ruta Arequipa-Challhuahuacho con 1 conductor → 409 bloqueado (min_drivers)', async () => {
    // Restaurar conductor2 en estado APTO (sin fatiga)
    await ds.query(
      `UPDATE drivers SET total_hours_driven_24h = 0, status = 'APTO' WHERE id = $1`,
      [driver2Id],
    );

    const res = await (http as any)
      .post('/api/trips')
      .set(bearer(operatorToken))
      .send({
        vehicle_id: vehicleId,
        route_id:   routeSpecialId,
        drivers:    [{ driver_id: driver2Id, role: 'PRINCIPAL' }],
      })
      .expect(409);

    expect(res.body.blocked).toBe(true);
    expect(res.body.reasons.some((r: any) => r.type === 'MIN_DRIVERS')).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Ruta especial con 2 conductores APTOS → APROBADO
  // ──────────────────────────────────────────────────────────────────────────

  it('7 — Ruta Arequipa-Challhuahuacho con 2 conductores APTOS → 201 REGISTRADO', async () => {
    // Restaurar ambos conductores a 0h
    await ds.query(
      `UPDATE drivers SET total_hours_driven_24h = 0, status = 'APTO',
       last_rest_start = NOW() - INTERVAL '10 hours'
       WHERE id = ANY($1::uuid[])`,
      [[driver1Id, driver2Id]],
    );

    const res = await (http as any)
      .post('/api/trips')
      .set(bearer(operatorToken))
      .send({
        vehicle_id: vehicleId,
        route_id:   routeSpecialId,
        drivers:    [
          { driver_id: driver1Id, role: 'PRINCIPAL' },
          { driver_id: driver2Id, role: 'COPILOTO'  },
        ],
      })
      .expect(201);

    expect(res.body.status).toBe('REGISTRADO');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. Viaje de retorno sin cumplir descanso → BLOQUEADO
  // ──────────────────────────────────────────────────────────────────────────

  it('8 — Retorno Cusco-Tambobamba sin 4h descanso → 409 bloqueado (RETURN_LEG)', async () => {
    // Resetear conductor para que esté APTO
    await ds.query(
      `UPDATE drivers SET total_hours_driven_24h = 0, status = 'APTO',
       last_rest_start = NOW() - INTERVAL '1 hour'
       WHERE id = $1`,
      [driver1Id],
    );

    // Simular un viaje de ida que terminó hace 1h (< 4h requeridas)
    const [ida] = await ds.query(
      `INSERT INTO trips (id, vehicle_id, route_id, start_time, end_time, status, municipality_id, is_return_leg, auto_closed)
       VALUES (gen_random_uuid(), $1, $2, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour', 'FINALIZADO', $3, false, false)
       RETURNING id`,
      [vehicleId, routeReturnId, municipalityId],
    );

    const res = await (http as any)
      .post('/api/trips')
      .set(bearer(operatorToken))
      .send({
        vehicle_id:    vehicleId,
        route_id:      routeReturnId,
        drivers:       [{ driver_id: driver1Id, role: 'PRINCIPAL' }],
        is_return_leg: true,
        parent_trip_id: ida.id,
      })
      .expect(409);

    expect(res.body.blocked).toBe(true);
    expect(res.body.reasons.some((r: any) => r.type === 'RETURN_LEG')).toBe(true);
  });
});
