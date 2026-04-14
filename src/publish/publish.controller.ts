import { Controller, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PublishService } from './publish.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Publish')
@ApiBearerAuth('JWT')
@Controller('publish')
@UseGuards(JwtAuthGuard)
export class PublishController {
  constructor(private readonly publishService: PublishService) {}

  @Post('project/:id')
  @ApiOperation({ summary: 'Publish a project (marks as published, returns result)' })
  publish(@CurrentUser() user: any, @Param('id') id: string) {
    return this.publishService.publishProject(id, user.sub);
  }
}
