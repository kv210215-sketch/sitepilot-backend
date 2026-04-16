import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';

@Entity('audit_logs')
export class AuditLog extends BaseEntity {
  @Column({ length: 100 })
  action!: string;

  @Column({ name: 'actor_id', nullable: true })
  actorId?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;
}
