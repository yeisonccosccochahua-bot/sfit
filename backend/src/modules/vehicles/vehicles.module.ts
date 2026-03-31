import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehiclesService } from './vehicles.service';
import { VehiclesController } from './vehicles.controller';
import { Vehicle } from '../../entities/vehicle.entity';
import { Company } from '../../entities/company.entity';
import { AuditModule } from '../audit/audit.module';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [TypeOrmModule.forFeature([Vehicle, Company]), AuditModule, UploadsModule],
  controllers: [VehiclesController],
  providers: [VehiclesService],
  exports: [VehiclesService],
})
export class VehiclesModule {}
