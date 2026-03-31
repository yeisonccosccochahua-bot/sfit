/**
 * SFIT — Production seed for Railway demo
 *
 * Creates minimal but complete demo data:
 *   - 1 municipality (Cotabambas)
 *   - 5 demo users  (password: Demo2026!)
 *   - 4 routes
 *   - 1 company
 *   - 3 drivers
 *   - 2 vehicles (with QR codes)
 *
 * Safe to run multiple times (ON CONFLICT DO NOTHING).
 *
 * Usage:
 *   # Local (from backend/):
 *   npx ts-node -r tsconfig-paths/register src/scripts/seed-production.ts
 *
 *   # Railway (via CLI after deploy):
 *   node dist/scripts/seed-production.js
 */

import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '../../..', '.env') });

const QR_SECRET =
  process.env.QR_HMAC_SECRET || 'sfit_qr_hmac_secret_change_in_prod';

function qrHmac(qrCode: string): string {
  return crypto.createHmac('sha256', QR_SECRET).update(qrCode).digest('hex');
}

async function run() {
  const ds = process.env.DATABASE_URL
    ? new DataSource({
        type: 'postgres',
        url: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        synchronize: false,
      })
    : new DataSource({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME || 'sfit_db',
        username: process.env.DB_USER || 'sfit_user',
        password: process.env.DB_PASSWORD || 'sfit_pass_2026',
        synchronize: false,
      });

  await ds.initialize();
  console.log('📦 Conectado a la base de datos');

  // ── 1. Municipality ───────────────────────────────────────────────────────
  const muniId = uuidv4();
  await ds.query(`
    INSERT INTO municipalities (id, name, province, district, region, status, created_at, updated_at)
    VALUES ($1, 'Municipalidad Provincial de Cotabambas', 'Cotabambas', 'Tambobamba', 'Apurímac', 'ACTIVO', NOW(), NOW())
    ON CONFLICT DO NOTHING
  `, [muniId]);

  // Re-fetch the id in case the row already existed
  const [{ id: mId }] = await ds.query(
    `SELECT id FROM municipalities WHERE name = 'Municipalidad Provincial de Cotabambas' LIMIT 1`,
  );
  console.log('✅ Municipalidad lista');

  // ── 2. Demo users (password: Demo2026!) ───────────────────────────────────
  const pwHash = await bcrypt.hash('Demo2026!', 12);

  const users = [
    { email: 'admin@sfit.gob.pe',      role: 'ADMIN_MUNICIPAL',  name: 'Admin Municipal',         dni: '10000001' },
    { email: 'fiscal@sfit.gob.pe',     role: 'FISCAL',           name: 'Fiscal de Transporte',    dni: '10000002' },
    { email: 'inspector@sfit.gob.pe',  role: 'INSPECTOR',        name: 'Inspector de Campo',      dni: '10000003' },
    { email: 'operador@sfit.gob.pe',   role: 'OPERADOR_EMPRESA', name: 'Operador Trans. Demo',     dni: '10000004' },
    { email: 'ciudadano@sfit.gob.pe',  role: 'CIUDADANO',        name: 'María Quispe Huamán',     dni: '10000005' },
  ];

  for (const u of users) {
    const uid = uuidv4();
    await ds.query(`
      INSERT INTO users (id, email, password_hash, role, name, dni, phone, municipality_id, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, '999000001', $7, 'ACTIVO', NOW(), NOW())
      ON CONFLICT (email) DO NOTHING
    `, [uid, u.email, pwHash, u.role, u.name, u.dni, mId]);
  }
  console.log('✅ Usuarios demo creados (password: Demo2026!)');

  // ── 3. Company ────────────────────────────────────────────────────────────
  const compId = uuidv4();
  await ds.query(`
    INSERT INTO companies (id, ruc, name, address, municipality_id, status, created_at, updated_at)
    VALUES ($1, '20567890123', 'Transportes Cotabambas SAC', 'Jr. Lima 123, Tambobamba', $2, 'ACTIVO', NOW(), NOW())
    ON CONFLICT (ruc) DO NOTHING
  `, [compId, mId]);

  const [{ id: cId }] = await ds.query(
    `SELECT id FROM companies WHERE ruc = '20567890123' LIMIT 1`,
  );

  // Associate operator user to company
  await ds.query(
    `UPDATE users SET company_id = $1 WHERE email = 'operador@sfit.gob.pe'`,
    [cId],
  );
  console.log('✅ Empresa demo lista');

  // ── 4. Routes ─────────────────────────────────────────────────────────────
  const routes = [
    { origin: 'Arequipa',  dest: 'Challhuahuacho', dur: 660, min_d: 2, rest: null, roundtrip: false },
    { origin: 'Cusco',     dest: 'Tambobamba',      dur: 300, min_d: 1, rest: 4,    roundtrip: true  },
    { origin: 'Tambobamba',dest: 'Challhuahuacho',  dur: 180, min_d: 1, rest: null, roundtrip: false },
    { origin: 'Cusco',     dest: 'Santo Tomás',     dur: 360, min_d: 1, rest: null, roundtrip: false },
  ];

  for (const r of routes) {
    await ds.query(`
      INSERT INTO routes (id, origin, destination, estimated_duration_minutes, type, min_drivers,
                          rest_between_legs_hours, allows_roundtrip, municipality_id, status, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, $3, 'PREDEFINIDA', $4, $5, $6, $7, 'ACTIVO', NOW(), NOW())
      ON CONFLICT DO NOTHING
    `, [r.origin, r.dest, r.dur, r.min_d, r.rest, r.roundtrip, mId]);
  }
  console.log('✅ Rutas creadas');

  // ── 5. Drivers ────────────────────────────────────────────────────────────
  const drivers = [
    { dni: '45001001', name: 'Carlos Huamán Quispe',  lic: 'Q45001001', cat: 'A-IIIa' },
    { dni: '45001002', name: 'Pedro Condori Mamani',  lic: 'Q45001002', cat: 'A-IIIa' },
    { dni: '45001003', name: 'Juan Soto Vargas',       lic: 'Q45001003', cat: 'A-IIb'  },
  ];

  for (const d of drivers) {
    await ds.query(`
      INSERT INTO drivers (id, dni, name, license_number, phone, company_id, status, reputation_score, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, $3, '984000001', $4, 'APTO', 100, NOW(), NOW())
      ON CONFLICT (dni) DO NOTHING
    `, [d.dni, d.name, d.lic, cId]);
  }
  console.log('✅ Conductores creados');

  // ── 6. Vehicles (with QR) ─────────────────────────────────────────────────
  const vehicles = [
    { plate: 'ABC-123', brand: 'Toyota',  model: 'Hiace', year: 2022, color: 'Blanco', cap: 15 },
    { plate: 'XYZ-789', brand: 'Hyundai', model: 'H1',    year: 2023, color: 'Gris',   cap: 12 },
  ];

  for (const v of vehicles) {
    const qrCode = `SFIT-${v.plate}-${uuidv4().slice(0, 8).toUpperCase()}`;
    const hmac   = qrHmac(qrCode);
    await ds.query(`
      INSERT INTO vehicles (id, plate, brand, model, year, color, capacity, qr_code, qr_hmac,
                            company_id, status, reputation_score, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVO', 100, NOW(), NOW())
      ON CONFLICT (plate) DO NOTHING
    `, [v.plate, v.brand, v.model, v.year, v.color, v.cap, qrCode, hmac, cId]);
  }
  console.log('✅ Vehículos creados');

  await ds.destroy();
  console.log('\n🎉 Seed de producción completado');
  console.log('   Usuarios demo:');
  console.log('   admin@sfit.gob.pe     → ADMIN_MUNICIPAL');
  console.log('   fiscal@sfit.gob.pe    → FISCAL');
  console.log('   inspector@sfit.gob.pe → INSPECTOR');
  console.log('   operador@sfit.gob.pe  → OPERADOR_EMPRESA');
  console.log('   ciudadano@sfit.gob.pe → CIUDADANO');
  console.log('   Password: Demo2026!');
}

run().catch((err) => { console.error(err); process.exit(1); });
