import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RoutesService } from './routes.service';
import { RouteValidationService } from './route-validation.service';
import { RoutesController } from './routes.controller';
import { Route } from '../../entities/route.entity';
import { Trip } from '../../entities/trip.entity';
import { Driver } from '../../entities/driver.entity';
import { AuditLog } from '../../entities/audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Route, Trip, Driver, AuditLog])],
  controllers: [RoutesController],
  providers: [RoutesService, RouteValidationService],
  exports: [RoutesService, RouteValidationService],
})
export class RoutesModule {}
