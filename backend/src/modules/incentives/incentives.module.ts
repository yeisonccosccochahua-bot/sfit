import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { IncentivesService } from './incentives.service';
import { IncentivesController } from './incentives.controller';
import { IncentivesCronService } from './incentives-cron.service';

import { IncentivePoint } from '../../entities/incentive-point.entity';
import { User }           from '../../entities/user.entity';

@Module({
  imports:     [TypeOrmModule.forFeature([IncentivePoint, User])],
  controllers: [IncentivesController],
  providers:   [IncentivesService, IncentivesCronService],
  exports:     [IncentivesService],
})
export class IncentivesModule {}
