import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { getDatabaseConfig } from './config/database.config';
import { AuthModule } from './modules/auth/auth.module';
import { RoutesModule } from './modules/routes/routes.module';
import { FatigueModule } from './modules/fatigue/fatigue.module';
import { TripsModule } from './modules/trips/trips.module';
import { QrModule } from './modules/qr/qr.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SanctionsModule } from './modules/sanctions/sanctions.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReputationModule } from './modules/reputation/reputation.module';
import { IncentivesModule } from './modules/incentives/incentives.module';
import { MunicipalReportsModule } from './modules/municipal-reports/municipal-reports.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { UsersModule } from './modules/users/users.module';
import { AuditModule } from './modules/audit/audit.module';
import { MunicipalitiesModule } from './modules/municipalities/municipalities.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { InspectorModule } from './modules/inspector/inspector.module';

@Module({
  imports: [
    // Config global
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
    }),

    // TypeORM - supports DATABASE_URL (Railway) and individual DB_* vars (local)
    TypeOrmModule.forRoot(getDatabaseConfig()),

    // Cache - supports REDIS_URL (Railway) and individual REDIS_* vars (local)
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL');
        if (redisUrl) {
          return {
            store: redisStore,
            url: redisUrl,
            ttl: config.get<number>('REDIS_TTL', 300) * 1000,
          };
        }
        return {
          store: redisStore,
          socket: {
            host: config.get('REDIS_HOST', 'localhost'),
            port: config.get<number>('REDIS_PORT', 6379),
          },
          ttl: config.get<number>('REDIS_TTL', 300) * 1000,
        };
      },
    }),

    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    AuthModule,
    RoutesModule,
    FatigueModule,
    TripsModule,
    QrModule,
    ReportsModule,
    SanctionsModule,
    NotificationsModule,
    ReputationModule,
    IncentivesModule,
    MunicipalReportsModule,
    CompaniesModule,
    DriversModule,
    VehiclesModule,
    UsersModule,
    AuditModule,
    MunicipalitiesModule,
    UploadsModule,
    InspectorModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
