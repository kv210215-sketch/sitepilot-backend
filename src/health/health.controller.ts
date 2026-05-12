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
  @ApiOperation({ summary: 'Health check — returns app status (DB check is optional)' })
  async check() {
    // Always return 'ok' if the app is running and responding to requests
    // This ensures healthcheck passes during startup before DB is ready
    let dbOk = false;
    let dbLatencyMs = -1;

    try {
      // Only attempt DB check if DataSource is initialized
      if (this.dataSource.isInitialized) {
        const t0 = Date.now();
        await this.dataSource.query('SELECT 1');
        dbLatencyMs = Date.now() - t0;
        dbOk = true;
      }
    } catch {
      // DB check failed, but app is still healthy
      dbOk = false;
    }

    const mem = process.memoryUsage();
    const heapUsedMb = parseFloat((mem.heapUsed / 1024 / 1024).toFixed(2));
    const heapTotalMb = parseFloat((mem.heapTotal / 1024 / 1024).toFixed(2));
    const rssMb = parseFloat((mem.rss / 1024 / 1024).toFixed(2));
    const uptime = Math.floor(process.uptime());

    return {
      status: 'ok', // Always 'ok' if app is running, regardless of DB status
      timestamp: new Date().toISOString(),
      uptime,
      // Kept for backward compatibility with Railway healthcheck and existing monitors
      services: {
        database: dbOk ? 'ok' : 'initializing',
      },
      // Extended diagnostics — additive, does not break existing consumers
      diagnostics: {
        database: {
          status: dbOk ? 'ok' : 'initializing',
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
