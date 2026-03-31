import {
  IsString,
  IsArray,
  IsEnum,
  IsIn,
  IsOptional,
  IsObject,
  MaxLength,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationChannel } from '../../../entities';

export enum NotificationType {
  FATIGA_RIESGO              = 'FATIGA_RIESGO',
  FATIGA_BLOQUEADO           = 'FATIGA_BLOQUEADO',
  SANCION                    = 'SANCION',
  APELACION                  = 'APELACION',
  REPORTE_NUEVO              = 'REPORTE_NUEVO',
  VIAJE_CERRADO_AUTO         = 'VIAJE_CERRADO_AUTO',
  PAUSA_RECOMENDADA          = 'PAUSA_RECOMENDADA',
  ALERTA_CONDUCTOR_DIFERENTE = 'ALERTA_CONDUCTOR_DIFERENTE',
}

export type NotificationPriority = 'ALTA' | 'MEDIA' | 'BAJA';

export class CreateNotificationDto {
  @ApiProperty({ description: 'UUID del usuario destinatario' })
  @IsString()
  userId: string;

  @ApiProperty({ enum: NotificationChannel, isArray: true, description: 'Canales a usar' })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(NotificationChannel, { each: true })
  channels: NotificationChannel[];

  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiProperty({ description: 'Contenido del mensaje' })
  @IsString()
  content: string;

  @ApiProperty({ enum: ['ALTA', 'MEDIA', 'BAJA'] })
  @IsIn(['ALTA', 'MEDIA', 'BAJA'])
  priority: NotificationPriority;

  @ApiPropertyOptional({ description: 'Datos adicionales para la plantilla' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
