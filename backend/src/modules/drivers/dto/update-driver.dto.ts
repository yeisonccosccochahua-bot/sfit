import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateDriverDto } from './create-driver.dto';
import { DriverStatus } from '../../../entities/driver.entity';

export class UpdateDriverDto extends PartialType(CreateDriverDto) {
  @IsEnum(DriverStatus) @IsOptional()
  status?: DriverStatus;
}
