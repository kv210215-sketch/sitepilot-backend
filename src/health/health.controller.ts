import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { SkipThrottle } from '@nestjs/throttler';
import { DataSource } from 'typeorm';

@SkipThrottle()
@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check — returns app and DB status with diagnostics' })
  async check() {
    let dbOk = false;
    let dbLatencyMs = -1;

    try {
      if (this.dataSource.isInitialized) {
        const t0 = Date.now();
        await this.dataSource.query('SELECT 1');
        dbLatencyMs = Date.now() - t0;
        dbOk = true;
      }
    } catch {
      dbOk = false;
    }

    const mem = process.memoryUsage();
    const heapUsedMb = parseFloat((mem.heapUsed / 1024 / 1024).toFixed(2));
    const heapTotalMb = parseFloat((mem.heapTotal / 1024 / 1024).toFixed(2));
    const rssMb = parseFloat((mem.rss / 1024 / 1024).toFixed(2));
    const uptime = Math.floor(process.uptime());

    return {
      status: dbOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime,
      // Kept for backward compatibility with Railway healthcheck and existing monitors
      services: {
        database: dbOk ? 'ok' : 'error',
      },
      // Extended diagnostics — additive, does not break existing consumers
      diagnostics: {
        database: {
          status: dbOk ? 'ok' : 'error',
          latencyMs: dbLatencyMs,
        },
        memory: {
          heapUsedMb,
          heapTotalMb,
          rssMb,
        },
        node: {
          version: process.version,
          uptime,
        },
      },
    };
  }
}
