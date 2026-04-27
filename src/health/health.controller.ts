import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check — returns app and DB status' })
  async check() {
    let dbOk = false;

    try {
      if (this.dataSource.isInitialized) {
        await this.dataSource.query('SELECT 1');
        dbOk = true;
      }
    } catch {
      dbOk = false;
    }

    return {
      status: dbOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      services: {
        database: dbOk ? 'ok' : 'error',
      },
    };
  }
}
