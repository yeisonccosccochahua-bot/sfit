import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ReputationService } from './reputation.service';
import { ReputationController } from './reputation.controller';
import { ReputationCronService } from './reputation-cron.service';

import { Driver }     from '../../entities/driver.entity';
import { Vehicle }    from '../../entities/vehicle.entity';
import { Company }    from '../../entities/company.entity';
import { FatigueLog } from '../../entities/fatigue-log.entity';
import { Report }     from '../../entities/report.entity';
import { Sanction }   from '../../entities/sanction.entity';
import { Trip }       from '../../entities/trip.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Driver, Vehicle, Company, FatigueLog, Report, Sanction, Trip]),
  ],
  controllers: [ReputationController],
  providers:   [ReputationService, ReputationCronService],
  exports:     [ReputationService],
})
export class ReputationModule {}
