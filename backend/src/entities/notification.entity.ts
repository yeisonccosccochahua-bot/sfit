import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

export enum NotificationChannel {
  WHATSAPP = 'WHATSAPP',
  EMAIL = 'EMAIL',
  WEB = 'WEB',
}

export enum NotificationStatus {
  PENDIENTE = 'PENDIENTE',
  ENVIADO = 'ENVIADO',
  FALLIDO = 'FALLIDO',
  LEIDO = 'LEIDO',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: NotificationChannel })
  channel: NotificationChannel;

  @Column({ length: 100 })
  type: string;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Index()
  @Column({ type: 'enum', enum: NotificationStatus, default: NotificationStatus.PENDIENTE })
  status: NotificationStatus;

  @Column({ type: 'timestamptz', nullable: true })
  sent_at: Date;

  @Index()
  @CreateDateColumn()
  created_at: Date;
}
