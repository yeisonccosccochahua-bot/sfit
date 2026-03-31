import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Report } from './report.entity';

export enum IncentiveActionType {
  REPORTE_VALIDO      = 'REPORTE_VALIDO',
  REPORTE_CON_SANCION = 'REPORTE_CON_SANCION',
  VALIDACION_CORRECTA = 'VALIDACION_CORRECTA',
  BONUS               = 'BONUS',
}

@Entity('incentive_points')
export class IncentivePoint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  citizen_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'citizen_id' })
  citizen: User;

  @Column({ type: 'int' })
  points: number;

  @Column({ type: 'enum', enum: IncentiveActionType })
  action_type: IncentiveActionType;

  @Index()
  @Column({ nullable: true })
  report_id: string;

  @ManyToOne(() => Report, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'report_id' })
  report: Report;

  @Column({ type: 'date' })
  date: string;

  @Index()
  @CreateDateColumn()
  created_at: Date;
}
