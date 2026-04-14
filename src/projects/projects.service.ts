import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './entities/project.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { slugify } from '../common/utils/slugify';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  async create(userId: string, createProjectDto: CreateProjectDto): Promise<Project> {
    const project = this.projectRepository.create({
      ...createProjectDto,
      userId,
      slug: createProjectDto.slug || slugify(createProjectDto.name),
    });
    return this.projectRepository.save(project);
  }

  async findAllForUser(userId: string): Promise<Project[]> {
    return this.projectRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string): Promise<Project> {
    const project = await this.projectRepository.findOne({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.userId !== userId) throw new ForbiddenException('Access denied');
    return project;
  }

  async findOneWithPages(id: string, userId: string): Promise<Project> {
    const project = await this.projectRepository.findOne({
      where: { id },
      relations: ['pages'],
      order: { pages: { order: 'ASC' } } as any,
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.userId !== userId) throw new ForbiddenException('Access denied');
    return project;
  }

  async update(id: string, userId: string, updateProjectDto: UpdateProjectDto): Promise<Project> {
    const project = await this.findOne(id, userId);
    Object.assign(project, updateProjectDto);
    return this.projectRepository.save(project);
  }

  async remove(id: string, userId: string): Promise<void> {
    const project = await this.findOne(id, userId);
    await this.projectRepository.remove(project);
  }

  /** Internal — called by PublishService to stamp publish result on the project. */
  async markPublished(id: string, userId: string, publishedUrl: string): Promise<Project> {
    const project = await this.findOne(id, userId);
    project.isPublished = true;
    project.publishedUrl = publishedUrl;
    project.slug = project.slug || slugify(project.name);
    return this.projectRepository.save(project);
  }
}

