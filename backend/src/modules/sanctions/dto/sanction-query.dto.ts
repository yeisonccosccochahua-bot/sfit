import { IsOptional, IsInt, Min, Max, IsDateString, IsUUID, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AppealStatus } from '../../../entities';

export class SanctionQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 15 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit = 15;

  @ApiPropertyOptional({ enum: [1, 2, 3, 4], description: 'Nivel de sanción 1-4' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  level?: number;

  @ApiPropertyOptional({ enum: AppealStatus })
  @IsOptional()
  @IsIn(Object.values(AppealStatus))
  appeal_status?: AppealStatus;

  @ApiPropertyOptional({ description: 'UUID del conductor' })
  @IsOptional()
  @IsUUID()
  driver_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date_to?: string;
}
