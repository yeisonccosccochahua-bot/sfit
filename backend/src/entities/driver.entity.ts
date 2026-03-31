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

export enum DriverStatus {
  APTO = 'APTO',
  RIESGO = 'RIESGO',
  NO_APTO = 'NO_APTO',
  INACTIVO = 'INACTIVO',   // No longer employed (distinct from NO_APTO which is sanction-based)
}

@Entity('drivers')
export class Driver {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ unique: true, length: 15 })
  dni: string;

  @Column({ length: 200 })
  name: string;

  @Column({ length: 50, nullable: true })
  license_number: string;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({ length: 150, nullable: true })
  email: string;

  @Column({ nullable: true, length: 500 })
  photo_url: string;

  @Column({ nullable: true, length: 500 })
  license_photo_url: string;

  @Column({ type: 'timestamptz', nullable: true })
  photo_expires_at: Date;

  @Column({ type: 'date', nullable: true })
  license_expires_at: Date;

  @Index()
  @Column()
  company_id: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ type: 'int', default: 100 })
  reputation_score: number;

  @Index()
  @Column({ type: 'enum', enum: DriverStatus, default: DriverStatus.APTO })
  status: DriverStatus;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  total_hours_driven_24h: number;

  @Column({ type: 'timestamptz', nullable: true })
  last_rest_start: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
