import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum MunicipalityStatus {
  ACTIVO = 'ACTIVO',
  INACTIVO = 'INACTIVO',
}

export enum MunicipalityType {
  PROVINCIAL = 'PROVINCIAL',
  DISTRITAL = 'DISTRITAL',
}

@Entity('municipalities')
export class Municipality {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 150 })
  name: string;

  @Column({ length: 100 })
  province: string;

  @Column({ length: 100 })
  district: string;

  @Column({ length: 100 })
  region: string;

  @Column({ type: 'jsonb', nullable: true, comment: 'Umbrales de sanción, pesos de reputación' })
  config_json: Record<string, any>;

  @Index()
  @Column({
    type: 'enum',
    enum: MunicipalityStatus,
    default: MunicipalityStatus.ACTIVO,
  })
  status: MunicipalityStatus;

  @Index()
  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
