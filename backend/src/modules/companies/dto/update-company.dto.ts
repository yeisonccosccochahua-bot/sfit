import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateCompanyDto } from './create-company.dto';
import { CompanyStatus } from '../../../entities/company.entity';

export class UpdateCompanyDto extends PartialType(CreateCompanyDto) {
  @IsEnum(CompanyStatus) @IsOptional()
  status?: CompanyStatus;
}
