import { PartialType } from '@nestjs/mapped-types';
import { CreateSiteDto } from './create-site.dto';
import { IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SiteStatus } from '../entities/site.entity';

export class UpdateSiteDto extends PartialType(CreateSiteDto) {
  @ApiPropertyOptional({ enum: SiteStatus })
  @IsOptional()
  @IsEnum(SiteStatus)
  status?: SiteStatus;
}
