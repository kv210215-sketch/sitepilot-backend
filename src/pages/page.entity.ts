import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { Project } from '../projects/project.entity';

@Entity('pages')
export class Page extends BaseEntity {
  @Column({ length: 150 })
  title!: string;

  @Column({ length: 255 })
  path!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ default: false })
  published!: boolean;

  @Column({ name: 'project_id' })
  projectId!: string;

  @ManyToOne(() => Project, (project) => project.pages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: Project;
}
