import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';
import { AiTaskType } from './dto/ai-request.dto';

describe('AiService', () => {
  let service: AiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AiService],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processRequest', () => {
    it('should process a content generation request', async () => {
      const result = await service.processRequest({
        task: AiTaskType.CONTENT_GENERATION,
        prompt: 'Write about NestJS',
      });

      expect(result).toHaveProperty('task', AiTaskType.CONTENT_GENERATION);
      expect(result).toHaveProperty('result');
      expect(result).toHaveProperty('tokensUsed');
      expect(result).toHaveProperty('generatedAt');
      expect(result.result).toBeTruthy();
    });

    it('should process a keyword extraction request', async () => {
      const result = await service.processRequest({
        task: AiTaskType.KEYWORD_EXTRACTION,
        prompt: 'SEO automation platform',
      });

      expect(result.task).toBe(AiTaskType.KEYWORD_EXTRACTION);
      expect(result.result).toBeTruthy();
    });

    it('should respect maxTokens limit', async () => {
      const result = await service.processRequest({
        task: AiTaskType.CONTENT_GENERATION,
        prompt: 'Short prompt',
        maxTokens: 10,
      });

      expect(result.tokensUsed).toBeLessThanOrEqual(10);
    });
  });
});
