import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CompanyStatus } from '../../../entities/company.entity';

export class ChangeCompanyStatusDto {
  @ApiProperty({ enum: CompanyStatus })
  @IsEnum(CompanyStatus)
  status: CompanyStatus;
}
