import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MunicipalReportsService } from './municipal-reports.service';
import { MunicipalReportsController } from './municipal-reports.controller';
import { MunicipalReportsCronService } from './municipal-reports-cron.service';
import { NotificationsModule } from '../notifications/notifications.module';

import { Trip }         from '../../entities/trip.entity';
import { Driver }       from '../../entities/driver.entity';
import { FatigueLog }   from '../../entities/fatigue-log.entity';
import { Report }       from '../../entities/report.entity';
import { Sanction }     from '../../entities/sanction.entity';
import { User }         from '../../entities/user.entity';
import { Municipality } from '../../entities/municipality.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trip, Driver, FatigueLog, Report, Sanction, User, Municipality]),
    NotificationsModule,   // provides EmailService
  ],
  controllers: [MunicipalReportsController],
  providers:   [MunicipalReportsService, MunicipalReportsCronService],
  exports:     [MunicipalReportsService],
})
export class MunicipalReportsModule {}
