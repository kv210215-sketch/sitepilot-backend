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
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Projects')
@ApiBearerAuth('JWT')
@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new project' })
  create(@CurrentUser() user: any, @Body() createProjectDto: CreateProjectDto) {
    return this.projectsService.create(user.sub, createProjectDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all projects for the current user' })
  findAll(@CurrentUser() user: any) {
    return this.projectsService.findAllForUser(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a project by ID' })
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.projectsService.findOne(id, user.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a project' })
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ) {
    return this.projectsService.update(id, user.sub, updateProjectDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a project' })
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.projectsService.remove(id, user.sub);
  }
}
