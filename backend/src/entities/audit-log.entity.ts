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

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ nullable: true })
  user_id: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ length: 100 })
  action: string;

  @Index()
  @Column({ length: 100 })
  entity_type: string;

  @Index()
  @Column({ length: 100 })
  entity_id: string;

  @Column({ type: 'jsonb', nullable: true })
  details_json: Record<string, any>;

  @Column({ length: 45, nullable: true })
  ip: string;

  @Index()
  @CreateDateColumn()
  created_at: Date;
}
