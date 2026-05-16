import { Test, TestingModule } from '@nestjs/testing';
import { SeoService } from './seo.service';

describe('SeoService', () => {
  let service: SeoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SeoService],
    }).compile();

    service = module.get<SeoService>(SeoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('analyzeUrl', () => {
    it('should return SEO analysis results', async () => {
      const result = await service.analyzeUrl({ url: 'https://example.com' });

      expect(result).toHaveProperty('url', 'https://example.com');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('analyzedAt');
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should run specific checks when provided', async () => {
      const result = await service.analyzeUrl({
        url: 'https://example.com',
        checks: ['title', 'meta'],
      });

      expect(result.results).toHaveLength(2);
      expect(result.results.map((r) => r.check)).toEqual(['title', 'meta']);
    });
  });
});
