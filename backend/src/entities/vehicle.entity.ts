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
import { Company } from './company.entity';

export enum VehicleStatus {
  ACTIVO = 'ACTIVO',
  INACTIVO = 'INACTIVO',
  EN_MANTENIMIENTO = 'EN_MANTENIMIENTO',
  SUSPENDIDO = 'SUSPENDIDO',
  FUERA_DE_CIRCULACION = 'FUERA_DE_CIRCULACION',
  DADO_DE_BAJA = 'DADO_DE_BAJA',
}

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ unique: true, length: 10 })
  plate: string;

  @Column({ length: 100, nullable: true })
  brand: string;

  @Column({ length: 100, nullable: true })
  model: string;

  @Column({ type: 'int', nullable: true })
  year: number;

  @Column({ length: 50, nullable: true })
  color: string;

  @Column({ type: 'int', nullable: true })
  capacity: number;

  @Column({ nullable: true, length: 500 })
  photo_url: string;

  @Column({ type: 'date', nullable: true })
  soat_expires_at: Date;

  @Column({ type: 'date', nullable: true })
  inspection_expires_at: Date;

  @Index({ unique: true })
  @Column({ unique: true, length: 255 })
  qr_code: string;

  @Column({ length: 255 })
  qr_hmac: string;

  @Column({ nullable: true, length: 500 })
  qr_image_url: string;

  @Index()
  @Column()
  company_id: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Index()
  @Column({ type: 'enum', enum: VehicleStatus, default: VehicleStatus.ACTIVO })
  status: VehicleStatus;

  @Column({ type: 'int', default: 100 })
  reputation_score: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
