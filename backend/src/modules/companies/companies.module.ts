import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { Company } from '../../entities/company.entity';
import { User } from '../../entities/user.entity';
import { Driver } from '../../entities/driver.entity';
import { Vehicle } from '../../entities/vehicle.entity';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([Company, User, Driver, Vehicle]), AuditModule],
  controllers: [CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
