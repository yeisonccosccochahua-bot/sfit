import { IsString, MinLength, MaxLength, IsOptional, IsArray, IsUrl, ArrayMaxSize } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAppealDto {
  @ApiProperty({ description: 'Descripción de la apelación', minLength: 20, maxLength: 2000 })
  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  description: string;

  @ApiPropertyOptional({ type: [String], description: 'URLs de evidencias adjuntas (máx. 10)' })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  @ArrayMaxSize(10)
  evidence_urls?: string[];
}
