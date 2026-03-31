import { TypeOrmModuleOptions } from '@nestjs/typeorm';

/**
 * Returns TypeORM config.
 * - Production (Railway): uses DATABASE_URL + SSL
 * - Local dev: uses individual DB_* env vars with synchronize:true
 */
export function getDatabaseConfig(): TypeOrmModuleOptions {
  if (process.env.DATABASE_URL) {
    return {
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: true,
      synchronize: process.env.DB_SYNCHRONIZE === 'true',
      ssl: { rejectUnauthorized: false },
      logging: false,
    };
  }

  return {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'sfit_db',
    username: process.env.DB_USER || 'sfit_user',
    password: process.env.DB_PASSWORD || 'sfit_pass_2026',
    autoLoadEntities: true,
    synchronize: process.env.DB_SYNCHRONIZE !== 'false', // true by default in dev
    logging: process.env.DB_LOGGING === 'true',
  };
}
