import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SanctionEngineService } from './sanction-engine.service';
import { SanctionsController } from './sanctions.controller';
import { SanctionsCronService } from './sanctions-cron.service';

import { Sanction }     from '../../entities/sanction.entity';
import { Appeal }       from '../../entities/appeal.entity';
import { Driver }       from '../../entities/driver.entity';
import { User }         from '../../entities/user.entity';
import { Report }       from '../../entities/report.entity';
import { Trip }         from '../../entities/trip.entity';
import { FatigueLog }   from '../../entities/fatigue-log.entity';
import { AuditLog }     from '../../entities/audit-log.entity';
import { Notification } from '../../entities/notification.entity';
import { Municipality } from '../../entities/municipality.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Sanction,
      Appeal,
      Driver,
      User,
      Report,
      Trip,
      FatigueLog,
      AuditLog,
      Notification,
      Municipality,
    ]),
  ],
  controllers: [SanctionsController],
  providers:   [SanctionEngineService, SanctionsCronService],
  exports:     [SanctionEngineService],
})
export class SanctionsModule {}
