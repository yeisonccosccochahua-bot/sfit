import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Sanction } from './sanction.entity';
import { User } from './user.entity';

export enum AppealDecisionStatus {
  PENDIENTE = 'PENDIENTE',
  ACEPTADA = 'ACEPTADA',
  RECHAZADA = 'RECHAZADA',
}

@Entity('appeals')
export class Appeal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  sanction_id: string;

  @ManyToOne(() => Sanction, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sanction_id' })
  sanction: Sanction;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'jsonb', nullable: true, comment: 'URLs de evidencias adjuntas' })
  evidence_urls: string[];

  @Index()
  @Column({
    type: 'enum',
    enum: AppealDecisionStatus,
    default: AppealDecisionStatus.PENDIENTE,
  })
  status: AppealDecisionStatus;

  @CreateDateColumn()
  submitted_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  resolved_at: Date;

  @Column({ nullable: true })
  resolved_by_id: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'resolved_by_id' })
  resolved_by: User;
}
