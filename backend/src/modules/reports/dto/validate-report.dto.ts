import { IsIn } from 'class-validator';
import { ReportStatus } from '../../../entities';

export class ValidateReportDto {
  @IsIn([ReportStatus.VALIDO, ReportStatus.INVALIDO], {
    message: 'El estado debe ser VALIDO o INVALIDO',
  })
  status: ReportStatus.VALIDO | ReportStatus.INVALIDO;
}
