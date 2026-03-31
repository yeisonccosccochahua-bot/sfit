import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TripsService } from './trips.service';
import { TripsCronService } from './trips-cron.service';
import { TripsController } from './trips.controller';
import { ScheduledTripsService } from './scheduled-trips.service';
import { ScheduledTripsController } from './scheduled-trips.controller';
import { ScheduledTrip } from './entities/scheduled-trip.entity';

import { Trip } from '../../entities/trip.entity';
import { TripDriver } from '../../entities/trip-driver.entity';
import { Vehicle } from '../../entities/vehicle.entity';
import { Driver } from '../../entities/driver.entity';
import { Route } from '../../entities/route.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { Notification } from '../../entities/notification.entity';

import { FatigueModule } from '../fatigue/fatigue.module';
import { RoutesModule } from '../routes/routes.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trip, TripDriver, Vehicle, Driver, Route, AuditLog, Notification, ScheduledTrip]),
    FatigueModule,
    RoutesModule,
  ],
  controllers: [TripsController, ScheduledTripsController],
  providers: [TripsService, TripsCronService, ScheduledTripsService],
  exports: [TripsService, ScheduledTripsService],
})
export class TripsModule {}
