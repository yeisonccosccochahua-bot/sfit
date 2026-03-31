import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { Vehicle } from '../../../entities/vehicle.entity';
import { Route } from '../../../entities/route.entity';
import { Company } from '../../../entities/company.entity';
import { Trip } from '../../../entities/trip.entity';
import { User } from '../../../entities/user.entity';

export enum ScheduledTripStatus {
  PROGRAMADO   = 'PROGRAMADO',
  CONFIRMADO   = 'CONFIRMADO',
  EN_CURSO     = 'EN_CURSO',
  COMPLETADO   = 'COMPLETADO',
  CANCELADO    = 'CANCELADO',
  NO_REALIZADO = 'NO_REALIZADO',
}

export enum ScheduledTripRecurrencia {
  UNICO          = 'UNICO',
  DIARIO_LUN_VIE = 'DIARIO_LUN_VIE',
  DIARIO_LUN_SAB = 'DIARIO_LUN_SAB',
  PERSONALIZADO  = 'PERSONALIZADO',
}

@Entity('scheduled_trips')
export class ScheduledTrip {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  vehicle_id: string;

  @ManyToOne(() => Vehicle, { eager: false })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle;

  @Index()
  @Column()
  route_id: string;

  @ManyToOne(() => Route, { eager: false })
  @JoinColumn({ name: 'route_id' })
  route: Route;

  @Index()
  @Column()
  company_id: string;

  @ManyToOne(() => Company, { eager: false })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Index()
  @Column()
  municipality_id: string;

  // Conductores asignados
  @Column({ type: 'jsonb' })
  assigned_drivers: { driver_id: string; role: 'PRINCIPAL' | 'SUPLENTE' | 'COPILOTO' }[];

  @Index()
  @Column({ type: 'date' })
  fecha_programada: string;

  @Column({ type: 'time' })
  hora_salida: string;

  @Column({ type: 'time', nullable: true })
  hora_llegada_estimada: string | null;

  @Column({
    type: 'enum',
    enum: ScheduledTripRecurrencia,
    default: ScheduledTripRecurrencia.UNICO,
  })
  recurrencia: ScheduledTripRecurrencia;

  // UUID del primer trip de la serie (para agrupar recurrencias)
  @Column({ nullable: true })
  serie_id: string | null;

  @Column({ type: 'jsonb', nullable: true })
  dias_semana: number[] | null;

  @Column({ type: 'date', nullable: true })
  recurrencia_hasta: string | null;

  @Index()
  @Column({
    type: 'enum',
    enum: ScheduledTripStatus,
    default: ScheduledTripStatus.PROGRAMADO,
  })
  estado: ScheduledTripStatus;

  @Column({ nullable: true })
  trip_id: string | null;

  @ManyToOne(() => Trip, { nullable: true, eager: false })
  @JoinColumn({ name: 'trip_id' })
  trip: Trip;

  @Column({ nullable: true, length: 500 })
  motivo_cancelacion: string | null;

  @Column({ nullable: true, length: 500 })
  notas: string | null;

  @Column()
  created_by: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
