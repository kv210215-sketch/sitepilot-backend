import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsModule } from '../projects/projects.module';
import { Page } from './page.entity';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';

@Module({
  imports: [TypeOrmModule.forFeature([Page]), ProjectsModule],
  controllers: [PagesController],
  providers: [PagesService],
})
export class PagesModule {}
