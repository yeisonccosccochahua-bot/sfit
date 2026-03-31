import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Driver } from './driver.entity';
import { Municipality } from './municipality.entity';
import { User } from './user.entity';

export enum AppealStatus {
  SIN_APELACION = 'SIN_APELACION',
  EN_APELACION = 'EN_APELACION',
  APELACION_ACEPTADA = 'APELACION_ACEPTADA',
  APELACION_RECHAZADA = 'APELACION_RECHAZADA',
}

@Entity('sanctions')
export class Sanction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  driver_id: string;

  @ManyToOne(() => Driver, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'driver_id' })
  driver: Driver;

  @Column({ type: 'smallint', comment: 'Nivel 1-4' })
  level: number;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'jsonb', nullable: true, comment: 'Array de IDs de evidencias' })
  evidence_ids: string[];

  @Column({
    type: 'enum',
    enum: AppealStatus,
    default: AppealStatus.SIN_APELACION,
  })
  appeal_status: AppealStatus;

  @Column({ type: 'timestamptz', nullable: true })
  appeal_deadline: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  fine_amount: number;

  @Index()
  @Column()
  municipality_id: string;

  @ManyToOne(() => Municipality, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'municipality_id' })
  municipality: Municipality;

  @Column({ nullable: true })
  issued_by_id: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'issued_by_id' })
  issued_by: User;

  @Column({ type: 'date', nullable: true })
  resolved_date: string;

  @Index()
  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
