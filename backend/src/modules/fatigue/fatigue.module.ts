import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FatigueEngineService } from './fatigue-engine.service';
import { FatigueCronService } from './fatigue-cron.service';
import { FatigueController } from './fatigue.controller';
import { Driver } from '../../entities/driver.entity';
import { Trip } from '../../entities/trip.entity';
import { TripDriver } from '../../entities/trip-driver.entity';
import { Route } from '../../entities/route.entity';
import { FatigueLog } from '../../entities/fatigue-log.entity';
import { Notification } from '../../entities/notification.entity';
import { AuditLog } from '../../entities/audit-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Driver,
      Trip,
      TripDriver,
      Route,
      FatigueLog,
      Notification,
      AuditLog,
    ]),
  ],
  controllers: [FatigueController],
  providers: [FatigueEngineService, FatigueCronService],
  exports: [FatigueEngineService],
})
export class FatigueModule {}
