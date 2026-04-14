import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum SiteStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
}

@Entity('sites')
export class Site {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  domain: string;

  @Column({ nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: SiteStatus,
    default: SiteStatus.PENDING,
  })
  status: SiteStatus;

  @Column({ nullable: true })
  sitemapUrl: string;

  @Column({ default: false })
  seoEnabled: boolean;

  @Column({ default: false })
  aiEnabled: boolean;

  @ManyToOne(() => User, { eager: false, onDelete: 'CASCADE' })
  owner: User;

  @Column()
  ownerId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
