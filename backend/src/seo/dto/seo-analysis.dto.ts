import { IsUrl, IsOptional, IsArray, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SeoAnalysisDto {
  @ApiProperty({ example: 'https://example.com' })
  @IsUrl()
  url: string;

  @ApiPropertyOptional({ example: ['title', 'meta', 'headings', 'links'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  checks?: string[];
}
