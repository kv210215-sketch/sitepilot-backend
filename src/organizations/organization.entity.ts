import { Column, Entity, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { Project } from '../projects/project.entity';
import { User } from '../users/user.entity';

@Entity('organizations')
export class Organization extends BaseEntity {
  @Column({ length: 120 })
  name!: string;

  @Column({ unique: true, length: 150 })
  slug!: string;

  @Column({ name: 'owner_id' })
  ownerId!: string;

  @ManyToOne(() => User, (user) => user.organizations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner!: User;

  @OneToMany(() => Project, (project) => project.organization)
  projects!: Project[];
}
