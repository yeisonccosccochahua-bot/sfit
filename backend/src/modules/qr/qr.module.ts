import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { QrService } from './qr.service';
import { QrController } from './qr.controller';
import { Vehicle } from '../../entities/vehicle.entity';
import { Trip } from '../../entities/trip.entity';
import { TripDriver } from '../../entities/trip-driver.entity';
import { Driver } from '../../entities/driver.entity';
import { Report } from '../../entities/report.entity';
import { AuditLog } from '../../entities/audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Vehicle, Trip, TripDriver, Driver, Report, AuditLog])],
  controllers: [QrController],
  providers: [QrService],
  exports: [QrService],
})
export class QrModule {}
