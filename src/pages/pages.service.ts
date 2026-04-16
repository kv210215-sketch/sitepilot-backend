import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectsService } from '../projects/projects.service';
import { User } from '../users/user.entity';
import { CreatePageDto } from './dto/create-page.dto';
import { Page } from './page.entity';

@Injectable()
export class PagesService {
  constructor(
    @InjectRepository(Page)
    private readonly pagesRepository: Repository<Page>,
    private readonly projectsService: ProjectsService,
  ) {}

  async create(user: User, createPageDto: CreatePageDto): Promise<Page> {
    await this.projectsService.findOneForOwner(createPageDto.projectId, user.id);
    const page = this.pagesRepository.create(createPageDto);
    return this.pagesRepository.save(page);
  }

  findAllForOwner(ownerId: string): Promise<Page[]> {
    return this.pagesRepository
      .createQueryBuilder('page')
      .innerJoinAndSelect('page.project', 'project')
      .innerJoin('project.organization', 'organization')
      .where('organization.owner_id = :ownerId', { ownerId })
      .orderBy('page.createdAt', 'DESC')
      .getMany();
  }

  async findOneForOwner(id: string, ownerId: string): Promise<Page> {
    const page = await this.pagesRepository
      .createQueryBuilder('page')
      .innerJoinAndSelect('page.project', 'project')
      .innerJoin('project.organization', 'organization')
      .where('page.id = :id', { id })
      .andWhere('organization.owner_id = :ownerId', { ownerId })
      .getOne();

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    return page;
  }
}
