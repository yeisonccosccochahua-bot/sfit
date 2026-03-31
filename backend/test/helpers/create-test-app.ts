/**
 * E2E Test App Factory
 *
 * Crea una instancia de NestJS con la misma configuración que main.ts.
 * Requiere que las variables de entorno apunten a una base de datos real
 * (puede ser la misma sfit_db o sfit_test_db).
 *
 * Instalar dependencias: npm i -D supertest @types/supertest
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

export interface TestApp {
  app:    INestApplication;
  http:   ReturnType<typeof request>;
}

export async function createTestApp(): Promise<TestApp> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist:              true,
      forbidNonWhitelisted:   true,
      transform:              true,
    }),
  );

  await app.init();
  const http = request(app.getHttpServer());
  return { app, http };
}

// ─── Auth helper ─────────────────────────────────────────────────────────────

export async function loginAs(
  http: ReturnType<typeof request>,
  email:    string,
  password: string,
): Promise<string> {
  const res = await (http as any)
    .post('/api/auth/login')
    .send({ email, password })
    .expect(200);
  return res.body.access_token as string;
}

// ─── Bearer header helper ─────────────────────────────────────────────────────

export function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}
