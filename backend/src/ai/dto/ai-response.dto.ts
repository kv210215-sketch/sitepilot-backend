import { ApiProperty } from '@nestjs/swagger';
import { AiTaskType } from './ai-request.dto';

export class AiResponseDto {
  @ApiProperty({ enum: AiTaskType })
  task: AiTaskType;

  @ApiProperty()
  result: string;

  @ApiProperty()
  tokensUsed: number;

  @ApiProperty()
  generatedAt: Date;
}
