import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '../../..', '.env') });

// Railway injects DATABASE_URL; local dev uses individual DB_* vars
export const AppDataSource = process.env.DATABASE_URL
  ? new DataSource({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      entities: [join(__dirname, '../entities/*.entity{.ts,.js}')],
      migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
      synchronize: false,
      logging: false,
    })
  : new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'sfit_db',
      username: process.env.DB_USER || 'sfit_user',
      password: process.env.DB_PASSWORD || 'sfit_pass_2026',
      entities: [join(__dirname, '../entities/*.entity{.ts,.js}')],
      migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
      synchronize: false,
      logging: process.env.DB_LOGGING === 'true',
    });
