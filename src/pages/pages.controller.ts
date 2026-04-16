import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { User } from '../users/user.entity';
import { CreatePageDto } from './dto/create-page.dto';
import { PagesService } from './pages.service';

@Controller({ path: 'pages', version: '1' })
@UseGuards(JwtAuthGuard)
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.pagesService.findAllForOwner(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.pagesService.findOneForOwner(id, user.id);
  }

  @Post()
  create(@Body() createPageDto: CreatePageDto, @CurrentUser() user: User) {
    return this.pagesService.create(user, createPageDto);
  }
}
