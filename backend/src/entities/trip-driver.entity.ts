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
import { Driver } from './driver.entity';

export enum TripDriverRole {
  PRINCIPAL = 'PRINCIPAL',
  SUPLENTE = 'SUPLENTE',
  COPILOTO = 'COPILOTO',
}

export enum FatigueCheckResult {
  APTO = 'APTO',
  RIESGO = 'RIESGO',
  NO_APTO = 'NO_APTO',
}

@Entity('trip_drivers')
export class TripDriver {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  trip_id: string;

  @ManyToOne(() => Trip, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trip_id' })
  trip: Trip;

  @Index()
  @Column()
  driver_id: string;

  @ManyToOne(() => Driver, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'driver_id' })
  driver: Driver;

  @Column({ type: 'enum', enum: TripDriverRole })
  role: TripDriverRole;

  @Column({ type: 'enum', enum: FatigueCheckResult, nullable: true })
  fatigue_check_result: FatigueCheckResult;

  @CreateDateColumn()
  assigned_at: Date;
}
