import { IsString, IsUrl, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSiteDto {
  @ApiProperty({ example: 'My Website' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'https://example.com' })
  @IsUrl()
  domain: string;

  @ApiPropertyOptional({ example: 'My personal website' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'https://example.com/sitemap.xml' })
  @IsOptional()
  @IsUrl()
  sitemapUrl?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  seoEnabled?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  aiEnabled?: boolean;
}
