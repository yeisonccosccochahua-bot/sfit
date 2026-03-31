import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateVehicleDto } from './create-vehicle.dto';
import { VehicleStatus } from '../../../entities/vehicle.entity';

export class UpdateVehicleDto extends PartialType(CreateVehicleDto) {
  @IsEnum(VehicleStatus) @IsOptional()
  status?: VehicleStatus;
}
