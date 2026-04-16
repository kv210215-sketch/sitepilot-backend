import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationsService } from '../organizations/organizations.service';
import { User } from '../users/user.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { Project } from './project.entity';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    private readonly organizationsService: OrganizationsService,
  ) {}

  async create(user: User, createProjectDto: CreateProjectDto): Promise<Project> {
    await this.organizationsService.findOneForOwner(createProjectDto.organizationId, user.id);

    const existing = await this.projectsRepository.findOne({ where: { slug: createProjectDto.slug } });
    if (existing) {
      throw new ConflictException('Project slug already exists');
    }

    const project = this.projectsRepository.create(createProjectDto);
    return this.projectsRepository.save(project);
  }

  findAllForOwner(ownerId: string): Promise<Project[]> {
    return this.projectsRepository
      .createQueryBuilder('project')
      .innerJoinAndSelect('project.organization', 'organization')
      .where('organization.owner_id = :ownerId', { ownerId })
      .orderBy('project.createdAt', 'DESC')
      .getMany();
  }

  async findOneForOwner(id: string, ownerId: string): Promise<Project> {
    const project = await this.projectsRepository
      .createQueryBuilder('project')
      .innerJoinAndSelect('project.organization', 'organization')
      .where('project.id = :id', { id })
      .andWhere('organization.owner_id = :ownerId', { ownerId })
      .getOne();

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }
}
