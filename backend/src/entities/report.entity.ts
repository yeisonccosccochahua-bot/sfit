import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Trip } from './trip.entity';
import { User } from './user.entity';

export enum ReportType {
  CONDUCTOR_DIFERENTE = 'CONDUCTOR_DIFERENTE',
  CONDICION_VEHICULO = 'CONDICION_VEHICULO',
  CONDUCCION_PELIGROSA = 'CONDUCCION_PELIGROSA',
  EXCESO_VELOCIDAD = 'EXCESO_VELOCIDAD',
  OTRO = 'OTRO',
}

export enum ReportStatus {
  PENDIENTE = 'PENDIENTE',
  VALIDO = 'VALIDO',
  INVALIDO = 'INVALIDO',
  EN_REVISION = 'EN_REVISION',
}

@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  trip_id: string;

  @ManyToOne(() => Trip, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'trip_id' })
  trip: Trip;

  @Index()
  @Column()
  citizen_id: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'citizen_id' })
  citizen: User;

  @Column({ type: 'enum', enum: ReportType })
  type: ReportType;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true, length: 500 })
  photo_url: string;

  @Index()
  @Column({ type: 'enum', enum: ReportStatus, default: ReportStatus.PENDIENTE })
  status: ReportStatus;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  validation_score: number;

  @Index()
  @CreateDateColumn()
  created_at: Date;
}
