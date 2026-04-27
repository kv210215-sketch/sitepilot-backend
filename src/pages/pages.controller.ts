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
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PagesService } from './pages.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Pages')
@ApiBearerAuth('JWT')
@Controller('projects/:projectId/pages')
@UseGuards(JwtAuthGuard)
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a page inside a project' })
  create(
    @CurrentUser() user: any,
    @Param('projectId') projectId: string,
    @Body() createPageDto: CreatePageDto,
  ) {
    return this.pagesService.create(projectId, user.sub, createPageDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all pages in a project' })
  findAll(@CurrentUser() user: any, @Param('projectId') projectId: string) {
    return this.pagesService.findAll(projectId, user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single page' })
  findOne(
    @CurrentUser() user: any,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.pagesService.findOne(id, projectId, user.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a page' })
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
  @ApiOperation({ summary: 'Delete a page' })
  remove(
    @CurrentUser() user: any,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.pagesService.remove(id, projectId, user.sub);
  }
}
