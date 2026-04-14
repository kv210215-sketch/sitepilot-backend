import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Site } from './entities/site.entity';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { User, UserRole } from '../users/entities/user.entity';

@Injectable()
export class SitesService {
  constructor(
    @InjectRepository(Site)
    private readonly sitesRepository: Repository<Site>,
  ) {}

  async create(createSiteDto: CreateSiteDto, owner: User): Promise<Site> {
    const site = this.sitesRepository.create({
      ...createSiteDto,
      ownerId: owner.id,
    });
    return this.sitesRepository.save(site);
  }

  async findAll(user: User): Promise<Site[]> {
    if (user.role === UserRole.ADMIN) {
      return this.sitesRepository.find();
    }
    return this.sitesRepository.find({ where: { ownerId: user.id } });
  }

  async findOne(id: string, user: User): Promise<Site> {
    const site = await this.sitesRepository.findOne({ where: { id } });
    if (!site) {
      throw new NotFoundException(`Site #${id} not found`);
    }
    if (user.role !== UserRole.ADMIN && site.ownerId !== user.id) {
      throw new ForbiddenException('Access denied');
    }
    return site;
  }

  async update(id: string, updateSiteDto: UpdateSiteDto, user: User): Promise<Site> {
    const site = await this.findOne(id, user);
    Object.assign(site, updateSiteDto);
    return this.sitesRepository.save(site);
  }

  async remove(id: string, user: User): Promise<void> {
    const site = await this.findOne(id, user);
    await this.sitesRepository.remove(site);
  }
}
