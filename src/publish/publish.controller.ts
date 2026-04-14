import { Controller, Post, Param, UseGuards } from '@nestjs/common';
import { PublishService } from './publish.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('publish')
@UseGuards(JwtAuthGuard)
export class PublishController {
  constructor(private readonly publishService: PublishService) {}

  @Post('project/:id')
  publish(@CurrentUser() user: any, @Param('id') id: string) {
    return this.publishService.publishProject(id, user.sub);
  }
}
