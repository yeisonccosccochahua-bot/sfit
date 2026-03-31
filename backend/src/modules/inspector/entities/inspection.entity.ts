import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { User } from '../../../entities/user.entity';
import { Vehicle } from '../../../entities/vehicle.entity';
import { Trip } from '../../../entities/trip.entity';
import { Driver } from '../../../entities/driver.entity';
import { Municipality } from '../../../entities/municipality.entity';

export enum InspectionTipo {
  VERIFICACION_QR           = 'VERIFICACION_QR',
  VERIFICACION_CONDUCTOR    = 'VERIFICACION_CONDUCTOR',
  INSPECCION_VEHICULO       = 'INSPECCION_VEHICULO',
  CONTROL_RUTA              = 'CONTROL_RUTA',
  FISCALIZACION_GENERAL     = 'FISCALIZACION_GENERAL',
}

export enum InspectionResultado {
  EN_PROCESO         = 'EN_PROCESO',
  CONFORME           = 'CONFORME',
  CON_OBSERVACIONES  = 'CON_OBSERVACIONES',
  INFRACCION_DETECTADA = 'INFRACCION_DETECTADA',
}

@Entity('inspections')
export class Inspection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  inspector_id: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'inspector_id' })
  inspector: User;

  @Index()
  @Column({ nullable: true })
  vehicle_id: string;

  @ManyToOne(() => Vehicle, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle;

  @Index()
  @Column({ nullable: true })
  trip_id: string;

  @ManyToOne(() => Trip, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'trip_id' })
  trip: Trip;

  @Column({ nullable: true })
  driver_id: string;

  @ManyToOne(() => Driver, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'driver_id' })
  driver: Driver;

  @Index()
  @Column({ type: 'enum', enum: InspectionTipo })
  tipo: InspectionTipo;

  @Index()
  @Column({ type: 'enum', enum: InspectionResultado, default: InspectionResultado.EN_PROCESO })
  resultado: InspectionResultado;

  @Column({ nullable: true, length: 500 })
  ubicacion_descripcion: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitud: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitud: number;

  @Column({ type: 'jsonb', nullable: true })
  observaciones: {
    descripcion: string;
    tipo: string;
    gravedad: 'LEVE' | 'MODERADA' | 'GRAVE';
    foto_url?: string;
  }[];

  @Column({ type: 'jsonb', nullable: true })
  fotos_evidencia: string[];

  @Column({ type: 'jsonb', nullable: true })
  verificacion_conductor: {
    conductor_coincide: boolean;
    licencia_vigente: boolean;
    licencia_categoria_correcta: boolean;
    estado_fatiga_visual: 'NORMAL' | 'CANSADO' | 'MUY_CANSADO';
    observaciones_conductor: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  verificacion_vehiculo: {
    estado_general: 'BUENO' | 'REGULAR' | 'MALO';
    luces_funcionan: boolean;
    llantas_estado: 'BUENO' | 'REGULAR' | 'MALO';
    documentos_vigentes: boolean;
    soat_vigente: boolean;
    revision_tecnica_vigente: boolean;
    capacidad_excedida: boolean;
    observaciones_vehiculo: string;
  };

  @Column({ nullable: true, length: 36 })
  sanction_id: string;

  @Index()
  @Column({ nullable: true })
  municipality_id: string;

  @ManyToOne(() => Municipality, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'municipality_id' })
  municipality: Municipality;

  @Column({ type: 'text', nullable: true })
  notas_adicionales: string;

  @Index()
  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
