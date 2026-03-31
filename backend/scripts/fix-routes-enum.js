/**
 * One-shot DB migration: ACTIVO→ACTIVA, INACTIVO→INACTIVA
 * Run BEFORE starting the backend:
 *   node scripts/fix-routes-enum.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Client } = require('pg');

const client = new Client({
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'sfit_db',
  user:     process.env.DB_USER     || 'sfit_user',
  password: process.env.DB_PASSWORD || 'sfit_pass_2026',
});

async function run() {
  await client.connect();
  console.log('✅ Conectado a', process.env.DB_NAME);

  try {
    // ── PASO 1: Añadir los nuevos valores al tipo enum ────────────────────────
    // ALTER TYPE ADD VALUE no puede ir dentro de un BEGIN/COMMIT en PG < 12
    await client.query(`ALTER TYPE routes_status_enum ADD VALUE IF NOT EXISTS 'ACTIVA'`);
    await client.query(`ALTER TYPE routes_status_enum ADD VALUE IF NOT EXISTS 'INACTIVA'`);
    console.log('✅ Enum values ACTIVA / INACTIVA añadidos');

    // ── PASO 2: Migrar los datos existentes (cast a text para comparar valores viejos) ─
    const r1 = await client.query(`UPDATE routes SET status = 'ACTIVA'   WHERE status::text = 'ACTIVO'`);
    const r2 = await client.query(`UPDATE routes SET status = 'INACTIVA' WHERE status::text = 'INACTIVO'`);
    console.log(`✅ ${r1.rowCount} filas ACTIVO → ACTIVA`);
    console.log(`✅ ${r2.rowCount} filas INACTIVO → INACTIVA`);

    // ── PASO 3: Corregir stops NULL ───────────────────────────────────────────
    const r3 = await client.query(`UPDATE routes SET stops = '[]'::jsonb WHERE stops IS NULL`);
    console.log(`✅ ${r3.rowCount} filas stops NULL → []`);

    console.log('\n✅ Migración completa. Ahora ejecuta: npm run dev');
  } catch (err) {
    console.error('\n❌ Error en la migración:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
