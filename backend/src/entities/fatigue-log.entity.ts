import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Driver } from './driver.entity';

export enum FatigueLogResult {
  APTO = 'APTO',
  RIESGO = 'RIESGO',
  NO_APTO = 'NO_APTO',
}

@Entity('fatigue_logs')
export class FatigueLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  driver_id: string;

  @ManyToOne(() => Driver, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'driver_id' })
  driver: Driver;

  @Column({ type: 'date' })
  evaluation_date: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  hours_driven_24h: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  last_rest_hours: number;

  @Column({ type: 'enum', enum: FatigueLogResult })
  result: FatigueLogResult;

  @Column({ type: 'jsonb', nullable: true })
  details_json: Record<string, any>;

  @Index()
  @CreateDateColumn()
  created_at: Date;
}
