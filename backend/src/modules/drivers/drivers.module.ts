import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriversService } from './drivers.service';
import { DriversController } from './drivers.controller';
import { Driver } from '../../entities/driver.entity';
import { Company } from '../../entities/company.entity';
import { AuditModule } from '../audit/audit.module';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [TypeOrmModule.forFeature([Driver, Company]), AuditModule, UploadsModule],
  controllers: [DriversController],
  providers: [DriversService],
  exports: [DriversService],
})
export class DriversModule {}
