import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AiTaskType {
  CONTENT_GENERATION = 'content_generation',
  SEO_OPTIMIZATION = 'seo_optimization',
  META_DESCRIPTION = 'meta_description',
  KEYWORD_EXTRACTION = 'keyword_extraction',
  CONTENT_SUMMARY = 'content_summary',
}

export class AiRequestDto {
  @ApiProperty({ enum: AiTaskType, example: AiTaskType.CONTENT_GENERATION })
  @IsEnum(AiTaskType)
  task: AiTaskType;

  @ApiProperty({ example: 'Write a blog post about NestJS best practices' })
  @IsString()
  @MaxLength(2000)
  prompt: string;

  @ApiPropertyOptional({ example: 'Technology, Web Development' })
  @IsOptional()
  @IsString()
  context?: string;

  @ApiPropertyOptional({ example: 500, default: 500 })
  @IsOptional()
  maxTokens?: number;
}
