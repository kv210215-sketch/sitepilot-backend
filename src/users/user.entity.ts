import { Exclude } from 'class-transformer';
import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { Organization } from '../organizations/organization.entity';

export enum UserRole {
  ADMIN = 'admin',
  MEMBER = 'member',
}

@Entity('users')
export class User extends BaseEntity {
  @Column({ unique: true })
  email!: string;

  @Exclude()
  @Column({ name: 'password_hash' })
  passwordHash!: string;

  @Column({ length: 120 })
  fullName!: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.MEMBER })
  role!: UserRole;

  @OneToMany(() => Organization, (organization) => organization.owner)
  organizations!: Organization[];
}
