import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as path from 'path';
import * as express from 'express';
import { AppModule } from './app.module';
import { normalizeSpanishFields } from './shared/normalize-fields';

async function bootstrap() {
  // Disable NestJS built-in body parser so we control parse order
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });

  // 1. Parse JSON/urlencoded bodies first
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // 2. Normalize Spanish field name aliases before NestJS validation runs
  app.use((req: any, _res: any, next: () => void) => {
    if (req.body && typeof req.body === 'object') normalizeSpanishFields(req.body);
    next();
  });

  // Serve uploaded files as static assets: /uploads/drivers/..., /uploads/vehicles/...
  app.useStaticAssets(path.resolve(process.cwd(), 'uploads'), { prefix: '/uploads' });

  // Validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS — allow local dev + Railway subdomains + configured FRONTEND_URL
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // curl / server-to-server
      const allowed = [
        process.env.FRONTEND_URL,
        'http://localhost:5173',
        'http://localhost:3000',
      ].filter(Boolean) as string[];
      if (allowed.includes(origin) || /\.railway\.app$/.test(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Swagger
  if (process.env.SWAGGER_ENABLED !== 'false') {
    const config = new DocumentBuilder()
      .setTitle(process.env.SWAGGER_TITLE || 'SFIT API')
      .setDescription(
        process.env.SWAGGER_DESCRIPTION ||
          'Sistema de Fiscalización Inteligente de Transporte',
      )
      .setVersion(process.env.SWAGGER_VERSION || '1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`🚀 Backend corriendo en: http://localhost:${port}`);
  console.log(`📚 Swagger disponible en: http://localhost:${port}/api/docs`);
}

bootstrap();
