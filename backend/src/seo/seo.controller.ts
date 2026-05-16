import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
} from '@nestjs/swagger';
import { SeoService } from './seo.service';
import { SeoAnalysisDto } from './dto/seo-analysis.dto';
import { SeoResultDto } from './dto/seo-result.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('seo')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'seo', version: '1' })
export class SeoController {
  constructor(private readonly seoService: SeoService) {}

  @Post('analyze')
  @ApiOperation({ summary: 'Analyze SEO for a given URL' })
  @ApiOkResponse({ type: SeoResultDto, description: 'SEO analysis result' })
  analyze(@Body() seoAnalysisDto: SeoAnalysisDto) {
    return this.seoService.analyzeUrl(seoAnalysisDto);
  }
}
