import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

import { Report } from '../../entities/report.entity';
import { User } from '../../entities/user.entity';
import { Vehicle } from '../../entities/vehicle.entity';
import { Trip } from '../../entities/trip.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { IncentivePoint } from '../../entities/incentive-point.entity';
import { Notification } from '../../entities/notification.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Report,
      User,
      Vehicle,
      Trip,
      AuditLog,
      IncentivePoint,
      Notification,
    ]),
  ],
  controllers: [ReportsController],
  providers:   [ReportsService],
  exports:     [ReportsService],
})
export class ReportsModule {}
