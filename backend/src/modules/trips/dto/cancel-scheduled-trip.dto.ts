import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CancelScheduledTripDto {
  @IsString()
  motivo_cancelacion: string;

  @IsOptional()
  @IsBoolean()
  cancelar_serie?: boolean;
}
