import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Page } from './entities/page.entity';
import { ProjectsService } from '../projects/projects.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { slugify } from '../common/utils/slugify';

@Injectable()
export class PagesService {
  constructor(
    @InjectRepository(Page)
    private readonly pageRepository: Repository<Page>,
    private readonly projectsService: ProjectsService,
  ) {}

  async create(projectId: string, userId: string, createPageDto: CreatePageDto): Promise<Page> {
    // Verify project ownership — throws ForbiddenException if not owner
    await this.projectsService.findOne(projectId, userId);

    const page = this.pageRepository.create({
      ...createPageDto,
      projectId,
      slug: createPageDto.slug || slugify(createPageDto.title),
    });
    return this.pageRepository.save(page);
  }

  async findAll(projectId: string, userId: string): Promise<Page[]> {
    await this.projectsService.findOne(projectId, userId);
    return this.pageRepository.find({
      where: { projectId },
      order: { order: 'ASC', createdAt: 'ASC' },
    });
  }

  async findOne(id: string, projectId: string, userId: string): Promise<Page> {
    await this.projectsService.findOne(projectId, userId);
    const page = await this.pageRepository.findOne({ where: { id, projectId } });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  async update(
    id: string,
    projectId: string,
    userId: string,
    updatePageDto: UpdatePageDto,
  ): Promise<Page> {
    const page = await this.findOne(id, projectId, userId);
    Object.assign(page, updatePageDto);
    return this.pageRepository.save(page);
  }

  async remove(id: string, projectId: string, userId: string): Promise<void> {
    const page = await this.findOne(id, projectId, userId);
    await this.pageRepository.remove(page);
  }

}

