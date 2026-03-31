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
import { Municipality } from './municipality.entity';
import { User } from './user.entity';

export enum RouteType {
  PREDEFINIDA = 'PREDEFINIDA',
  ESPECIAL = 'ESPECIAL',
}

export enum RouteStatus {
  ACTIVA   = 'ACTIVA',
  INACTIVA = 'INACTIVA',
}

@Entity('routes')
export class Route {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  origin: string;

  @Column({ length: 200 })
  destination: string;

  @Column({ type: 'jsonb', nullable: true, default: () => "'[]'", comment: 'Array de paradas intermedias' })
  stops: string[];

  @Column({ type: 'int' })
  estimated_duration_minutes: number;

  @Column({ type: 'enum', enum: RouteType })
  type: RouteType;

  @Column({ type: 'int', default: 1 })
  min_drivers: number;

  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true })
  rest_between_legs_hours: number;

  @Column({ type: 'boolean', default: false })
  allows_roundtrip: boolean;

  @Index()
  @Column()
  municipality_id: string;

  @ManyToOne(() => Municipality, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'municipality_id' })
  municipality: Municipality;

  @Column({ nullable: true })
  authorized_by_id: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'authorized_by_id' })
  authorized_by: User;

  @Index()
  @Column({ type: 'enum', enum: RouteStatus, default: RouteStatus.ACTIVA })
  status: RouteStatus;

  @Index()
  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
