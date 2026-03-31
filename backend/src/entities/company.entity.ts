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

export enum CompanyStatus {
  ACTIVO = 'ACTIVO',
  INACTIVO = 'INACTIVO',
  SUSPENDIDO = 'SUSPENDIDO',
}

@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ unique: true, length: 11 })
  ruc: string;

  @Column({ length: 200 })
  name: string;

  @Column({ length: 300, nullable: true })
  address: string;

  @Column({ length: 100, nullable: true })
  license: string;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({ length: 150, nullable: true })
  email: string;

  @Column({ length: 200, nullable: true })
  representative: string;

  @Column({ length: 15, nullable: true })
  representative_dni: string;

  @Index()
  @Column()
  municipality_id: string;

  @ManyToOne(() => Municipality, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'municipality_id' })
  municipality: Municipality;

  @Index()
  @Column({ type: 'enum', enum: CompanyStatus, default: CompanyStatus.ACTIVO })
  status: CompanyStatus;

  @Column({ type: 'int', default: 100 })
  reputation_score: number;

  @Index()
  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
