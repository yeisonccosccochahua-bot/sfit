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

export enum UserRole {
  ADMIN_MUNICIPAL = 'ADMIN_MUNICIPAL',
  FISCAL = 'FISCAL',
  OPERADOR_EMPRESA = 'OPERADOR_EMPRESA',
  CIUDADANO = 'CIUDADANO',
  INSPECTOR = 'INSPECTOR',
}

export enum UserStatus {
  ACTIVO = 'ACTIVO',
  BLOQUEADO = 'BLOQUEADO',
  SUSPENDIDO = 'SUSPENDIDO',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 200 })
  email: string;

  @Column({ length: 255 })
  password_hash: string;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  @Index()
  @Column({ nullable: true })
  municipality_id: string;

  @ManyToOne(() => Municipality, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'municipality_id' })
  municipality: Municipality;

  @Column({ nullable: true, length: 36 })
  company_id: string;

  @Index({ unique: true })
  @Column({ unique: true, nullable: true, length: 15 })
  dni: string;

  @Column({ length: 200 })
  name: string;

  @Column({ nullable: true, length: 20 })
  phone: string;

  @Column({ type: 'int', default: 100 })
  reputation_score: number;

  @Column({ type: 'int', default: 0 })
  total_points: number;

  @Column({ type: 'int', default: 0 })
  reports_today: number;

  @Index()
  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVO })
  status: UserStatus;

  @Index()
  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
