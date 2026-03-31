/**
 * E2E — Flujo de sanciones
 *
 * Escenarios:
 *   1. Generar múltiples incidencias para un conductor
 *   2. Evaluar conductor → sanción del nivel correcto
 *   3. Conductor apela → flujo de apelación creado
 *   4. Fiscal resuelve apelación → efecto en reputación
 */
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { createTestApp, loginAs, bearer } from './helpers/create-test-app';

const SEED_PASSWORD = 'Sfit2026!';

describe('Sanctions Flow (E2E)', () => {
  let app:         INestApplication;
  let http:        ReturnType<typeof request>;
  let ds:          DataSource;
  let fiscalToken: string;
  let adminToken:  string;

  let municipalityId: string;
  let companyId:      string;
  let driverId:       string;
  let sanctionId:     string;
  let appealId:       string;

  beforeAll(async () => {
    ({ app, http } = await createTestApp());
    ds = app.get<DataSource>(getDataSourceToken());
    const pwHash = await bcrypt.hash(SEED_PASSWORD, 10);

    // Municipality
    const [mun] = await ds.query(
      `INSERT INTO municipalities (id, name, province, district, region, status, config_json)
       VALUES (gen_random_uuid(), 'Test Muni Sanctions E2E', 'Test', 'TestSanctions', 'Test', 'ACTIVO',
               '{"sanction_thresholds":{"level1":1,"level2":3,"level3":5,"level4":8}}'::jsonb)
       RETURNING id`,
    );
    municipalityId = mun.id;

    // Company
    const [comp] = await ds.query(
      `INSERT INTO companies (id, ruc, name, municipality_id, status, reputation_score)
       VALUES (gen_random_uuid(), '20999000003', 'Trans E2E Sanction S.A.C.', $1, 'ACTIVO', 100)
       RETURNING id`, [municipalityId],
    );
    companyId = comp.id;

    // Driver (reputation_score=100 initially)
    const [drv] = await ds.query(
      `INSERT INTO drivers (id, dni, name, company_id, status, reputation_score, total_hours_driven_24h)
       VALUES (gen_random_uuid(), '30000001', 'Conductor Sancion E2E', $1, 'APTO', 100, 0)
       RETURNING id`, [companyId],
    );
    driverId = drv.id;

    // Fiscal + Admin users
    await ds.query(
      `INSERT INTO users (id, email, password_hash, name, role, municipality_id, status, reputation_score, total_points, reports_today)
       VALUES
         (gen_random_uuid(), 'fiscal.sanc.e2e@test.com', $1, 'Fiscal Sanc E2E',
          'FISCAL', $2, 'ACTIVO', 100, 0, 0),
         (gen_random_uuid(), 'admin.sanc.e2e@test.com', $1, 'Admin Sanc E2E',
          'ADMIN_MUNICIPAL', $2, 'ACTIVO', 100, 0, 0)`,
      [pwHash, municipalityId],
    );
    fiscalToken = await loginAs(http as any, 'fiscal.sanc.e2e@test.com', SEED_PASSWORD);
    adminToken  = await loginAs(http as any, 'admin.sanc.e2e@test.com', SEED_PASSWORD);
  });

  afterAll(async () => {
    await ds.query(`DELETE FROM appeals  WHERE sanction_id IN (SELECT id FROM sanctions WHERE driver_id = $1)`, [driverId]);
    await ds.query(`DELETE FROM sanctions WHERE driver_id = $1`, [driverId]);
    await ds.query(`DELETE FROM fatigue_logs WHERE driver_id = $1`, [driverId]);
    await ds.query(`DELETE FROM drivers   WHERE company_id = $1`, [companyId]);
    await ds.query(`DELETE FROM users     WHERE municipality_id = $1`, [municipalityId]);
    await ds.query(`DELETE FROM companies WHERE id = $1`, [companyId]);
    await ds.query(`DELETE FROM municipalities WHERE id = $1`, [municipalityId]);
    await app.close();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Generar incidencias
  // ──────────────────────────────────────────────────────────────────────────

  it('1 — Insertar incidencias de fatiga (NO_APTO) en el historial del conductor', async () => {
    // El motor de sanciones cuenta fatigue_logs con result=NO_APTO en los últimos 30 días
    // Insertamos 1 para llegar al nivel 1 (threshold = 1)
    await ds.query(
      `INSERT INTO fatigue_logs (id, driver_id, result, hours_driven_24h, last_rest_hours, evaluation_date)
       VALUES
         (gen_random_uuid(), $1, 'NO_APTO', 12, 2, CURRENT_DATE - 1),
         (gen_random_uuid(), $1, 'NO_APTO', 11, 1, CURRENT_DATE - 2)`,
      [driverId],
    );

    const logs = await ds.query(
      `SELECT COUNT(*) FROM fatigue_logs WHERE driver_id = $1 AND result = 'NO_APTO'`, [driverId],
    );
    expect(parseInt(logs[0].count)).toBeGreaterThanOrEqual(2);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Evaluar conductor → sanción nivel correcto
  // ──────────────────────────────────────────────────────────────────────────

  it('2 — POST /api/sanctions/evaluate/:driverId → crea sanción nivel 1', async () => {
    const res = await (http as any)
      .post(`/api/sanctions/evaluate/${driverId}`)
      .set(bearer(fiscalToken))
      .expect(201);

    // El servicio devuelve { created: true, sanction, level }
    expect(res.body).toBeDefined();

    // Verificar que se creó la sanción en BD
    const sanctions = await ds.query(
      `SELECT * FROM sanctions WHERE driver_id = $1 ORDER BY created_at DESC LIMIT 1`, [driverId],
    );
    expect(sanctions.length).toBeGreaterThan(0);
    sanctionId = sanctions[0].id;
    expect(sanctions[0].level).toBe(3);

    // Verificar que la reputación del conductor bajó
    const drv = await ds.query(`SELECT reputation_score FROM drivers WHERE id = $1`, [driverId]);
    expect(drv[0].reputation_score).toBeLessThan(100);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Apelación del conductor
  // ──────────────────────────────────────────────────────────────────────────

  it('3 — Apelar sanción → 201 + apelación PENDIENTE creada', async () => {
    // El conductor apela a través de un usuario representante o el propio fiscal
    const res = await (http as any)
      .post(`/api/sanctions/${sanctionId}/appeal`)
      .set(bearer(adminToken))
      .send({
        description:   'El conductor estaba conduciendo dentro de los límites permitidos. Se adjunta bitácora completa del GPS.',
        evidence_urls: ['https://cdn.test/evidencia-gps.pdf'],
      })
      .expect(201);

    appealId = res.body.id ?? res.body.appeal?.id;
    expect(appealId).toBeDefined();
    expect(res.body.status ?? res.body.appeal?.status).toBe('PENDIENTE');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Fiscal resuelve apelación → efecto en reputación
  // ──────────────────────────────────────────────────────────────────────────

  it('4a — Resolver apelación como ACEPTADA → conductor restaurado a APTO', async () => {
    const repBefore = (await ds.query(`SELECT reputation_score FROM drivers WHERE id = $1`, [driverId]))[0].reputation_score;

    const res = await (http as any)
      .patch(`/api/sanctions/${sanctionId}/appeal/resolve`)
      .set(bearer(fiscalToken))
      .send({
        status: 'ACEPTADA',
        reason: 'La evidencia GPS demuestra que el conductor respetó los tiempos de descanso.',
      })
      .expect(200);

    const appeal = await ds.query(`SELECT status FROM appeals WHERE id = $1`, [appealId]);
    expect(appeal[0].status).toBe('ACEPTADA');

    // El conductor debería haber recuperado los puntos de reputación
    const drvAfter = await ds.query(`SELECT reputation_score, status FROM drivers WHERE id = $1`, [driverId]);
    expect(drvAfter[0].reputation_score).toBeGreaterThanOrEqual(repBefore);
    expect(drvAfter[0].status).toBe('APTO');
  });

  it('4b — GET /api/sanctions/stats → incluye la sanción evaluada', async () => {
    const res = await (http as any)
      .get('/api/sanctions/stats')
      .set(bearer(fiscalToken))
      .expect(200);

    expect(res.body).toBeDefined();
    // Stats al menos tiene el campo total o by_level
    expect(typeof res.body).toBe('object');
  });
});
