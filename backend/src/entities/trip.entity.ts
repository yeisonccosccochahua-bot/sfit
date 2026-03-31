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
import { Vehicle } from './vehicle.entity';
import { Route } from './route.entity';
import { Municipality } from './municipality.entity';
import { User } from './user.entity';

export enum TripStatus {
  REGISTRADO = 'REGISTRADO',
  EN_CURSO = 'EN_CURSO',
  FINALIZADO = 'FINALIZADO',
  CANCELADO = 'CANCELADO',
  CERRADO_AUTO = 'CERRADO_AUTO',
}

export enum FatigueResult {
  APTO = 'APTO',
  RIESGO = 'RIESGO',
  NO_APTO = 'NO_APTO',
}

@Entity('trips')
export class Trip {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  vehicle_id: string;

  @ManyToOne(() => Vehicle, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle;

  @Index()
  @Column()
  route_id: string;

  @ManyToOne(() => Route, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'route_id' })
  route: Route;

  @Column({ type: 'timestamptz' })
  start_time: Date;

  @Column({ type: 'timestamptz', nullable: true })
  end_time: Date;

  @Index()
  @Column({ type: 'enum', enum: TripStatus, default: TripStatus.REGISTRADO })
  status: TripStatus;

  @Column({ type: 'enum', enum: FatigueResult, nullable: true })
  fatigue_result: FatigueResult;

  @Column({ type: 'boolean', default: false })
  auto_closed: boolean;

  @Column({ type: 'boolean', default: false })
  is_return_leg: boolean;

  @Column({ nullable: true })
  parent_trip_id: string;

  @ManyToOne(() => Trip, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parent_trip_id' })
  parent_trip: Trip;

  @Index()
  @Column()
  municipality_id: string;

  @ManyToOne(() => Municipality, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'municipality_id' })
  municipality: Municipality;

  @Column({ nullable: true })
  registered_by_id: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'registered_by_id' })
  registered_by: User;

  @Index()
  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
