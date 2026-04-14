import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNoContentResponse,
} from '@nestjs/swagger';
import { SitesService } from './sites.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('sites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'sites', version: '1' })
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new site' })
  @ApiCreatedResponse({ description: 'Site created successfully' })
  create(@Body() createSiteDto: CreateSiteDto, @CurrentUser() user: User) {
    return this.sitesService.create(createSiteDto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Get all sites' })
  @ApiOkResponse({ description: 'Sites retrieved successfully' })
  findAll(@CurrentUser() user: User) {
    return this.sitesService.findAll(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a site by ID' })
  @ApiOkResponse({ description: 'Site retrieved successfully' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.sitesService.findOne(id, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a site' })
  @ApiOkResponse({ description: 'Site updated successfully' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSiteDto: UpdateSiteDto,
    @CurrentUser() user: User,
  ) {
    return this.sitesService.update(id, updateSiteDto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a site' })
  @ApiNoContentResponse({ description: 'Site deleted successfully' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.sitesService.remove(id, user);
  }
}
