import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  private readonly heapThresholdBytes: number;
  private readonly rssThresholdBytes: number;

  constructor(
    private health: HealthCheckService,
    private memory: MemoryHealthIndicator,
    private db: TypeOrmHealthIndicator,
    private config: ConfigService,
  ) {
    const mb = 1024 * 1024;
    this.heapThresholdBytes = this.config.get<number>('MEMORY_HEAP_THRESHOLD_MB', 300) * mb;
    this.rssThresholdBytes  = this.config.get<number>('MEMORY_RSS_THRESHOLD_MB',  300) * mb;
  }

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.memory.checkHeap('memory_heap', this.heapThresholdBytes),
      () => this.memory.checkRSS('memory_rss',   this.rssThresholdBytes),
    ]);
  }
}
