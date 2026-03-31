import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { InspectorController } from './inspector.controller';
import { InspectorService }    from './inspector.service';
import { Inspection }          from './entities/inspection.entity';

import { Vehicle }      from '../../entities/vehicle.entity';
import { Driver }       from '../../entities/driver.entity';
import { Trip }         from '../../entities/trip.entity';
import { TripDriver }   from '../../entities/trip-driver.entity';
import { Notification } from '../../entities/notification.entity';
import { AuditLog }     from '../../entities/audit-log.entity';
import { Sanction, AppealStatus } from '../../entities/sanction.entity';

import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Inspection,
      Vehicle,
      Driver,
      Trip,
      TripDriver,
      Notification,
      AuditLog,
      Sanction,
    ]),
    UploadsModule,
  ],
  controllers: [InspectorController],
  providers:   [InspectorService],
  exports:     [InspectorService],
})
export class InspectorModule {}
