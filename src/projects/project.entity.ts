import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { Organization } from '../organizations/organization.entity';
import { Page } from '../pages/page.entity';

@Entity('projects')
export class Project extends BaseEntity {
  @Column({ length: 120 })
  name!: string;

  @Column({ unique: true, length: 150 })
  slug!: string;

  @Column({ name: 'organization_id' })
  organizationId!: string;

  @ManyToOne(() => Organization, (organization) => organization.projects, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @OneToMany(() => Page, (page) => page.project)
  pages!: Page[];
}
