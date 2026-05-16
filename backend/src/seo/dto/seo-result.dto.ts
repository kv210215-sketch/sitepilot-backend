import { ApiProperty } from '@nestjs/swagger';

export class SeoCheckResult {
  @ApiProperty()
  check: string;

  @ApiProperty()
  passed: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty({ required: false })
  value?: string;
}

export class SeoResultDto {
  @ApiProperty()
  url: string;

  @ApiProperty()
  score: number;

  @ApiProperty({ type: [SeoCheckResult] })
  results: SeoCheckResult[];

  @ApiProperty()
  analyzedAt: Date;
}
