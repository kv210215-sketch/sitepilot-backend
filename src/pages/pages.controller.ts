import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PagesService } from './pages.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

// Pages are nested under projects: /projects/:projectId/pages
@Controller('projects/:projectId/pages')
@UseGuards(JwtAuthGuard)
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Post()
  create(
    @CurrentUser() user: any,
    @Param('projectId') projectId: string,
    @Body() createPageDto: CreatePageDto,
  ) {
    return this.pagesService.create(projectId, user.sub, createPageDto);
  }

  @Get()
  findAll(@CurrentUser() user: any, @Param('projectId') projectId: string) {
    return this.pagesService.findAll(projectId, user.sub);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: any,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.pagesService.findOne(id, projectId, user.sub);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: any,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() updatePageDto: UpdatePageDto,
  ) {
    return this.pagesService.update(id, projectId, user.sub, updatePageDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: any,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.pagesService.remove(id, projectId, user.sub);
  }
}
