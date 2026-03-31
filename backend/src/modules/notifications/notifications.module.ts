import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { WhatsappService } from './whatsapp.service';
import { EmailService } from './email.service';

import { Notification } from '../../entities/notification.entity';
import { User }         from '../../entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, User]),
    // JwtModule needed by the WebSocket gateway to verify tokens in handshake
    JwtModule.registerAsync({
      imports:    [ConfigModule],
      inject:     [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret:      config.get<string>('JWT_SECRET', 'sfit_jwt_secret_change_in_prod'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '15m') },
      }),
    }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsGateway,
    WhatsappService,
    EmailService,
  ],
  exports: [NotificationsService, NotificationsGateway, EmailService],
})
export class NotificationsModule {}
