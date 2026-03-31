import { IsIn, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AppealDecisionStatus } from '../../../entities';

export class ResolveAppealDto {
  @ApiProperty({
    enum: [AppealDecisionStatus.ACEPTADA, AppealDecisionStatus.RECHAZADA],
    description: 'Decisión final de la apelación',
  })
  @IsIn([AppealDecisionStatus.ACEPTADA, AppealDecisionStatus.RECHAZADA], {
    message: 'El estado debe ser ACEPTADA o RECHAZADA',
  })
  status: AppealDecisionStatus.ACEPTADA | AppealDecisionStatus.RECHAZADA;

  @ApiProperty({ description: 'Motivo de la decisión', maxLength: 500 })
  @IsString()
  @MaxLength(500)
  reason: string;
}
