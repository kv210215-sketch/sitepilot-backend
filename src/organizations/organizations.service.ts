import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { Organization } from './organization.entity';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private readonly organizationsRepository: Repository<Organization>,
  ) {}

  async create(owner: User, createOrganizationDto: CreateOrganizationDto): Promise<Organization> {
    const existing = await this.organizationsRepository.findOne({ where: { slug: createOrganizationDto.slug } });
    if (existing) {
      throw new ConflictException('Organization slug already exists');
    }

    const organization = this.organizationsRepository.create({
      ...createOrganizationDto,
      ownerId: owner.id,
    });

    return this.organizationsRepository.save(organization);
  }

  findAllForOwner(ownerId: string): Promise<Organization[]> {
    return this.organizationsRepository.find({ where: { ownerId }, order: { createdAt: 'DESC' } });
  }

  async findOneForOwner(id: string, ownerId: string): Promise<Organization> {
    const organization = await this.organizationsRepository.findOne({ where: { id, ownerId } });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization;
  }
}
