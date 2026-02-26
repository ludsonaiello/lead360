import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../modules/auth/decorators';
import { PuppeteerProcessManager } from '../core/puppeteer/puppeteer-process-manager.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly puppeteerManager: PuppeteerProcessManager) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        service: { type: 'string', example: 'lead360-api' },
        ts: { type: 'string', example: '2025-01-01T12:00:00.000Z' },
      },
    },
  })
  health() {
    return {
      status: 'ok',
      service: 'lead360-api',
      ts: new Date().toISOString(),
    };
  }

  @Get('puppeteer')
  @Public()
  @ApiOperation({ summary: 'Puppeteer browser health check' })
  @ApiResponse({
    status: 200,
    description: 'Puppeteer browser health status',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        browser_alive: { type: 'boolean', example: true },
        browser_connected: { type: 'boolean', example: true },
        browser_pid: { type: 'number', example: 12345, nullable: true },
        total_chrome_processes: { type: 'number', example: 11 },
        temp_profiles: { type: 'number', example: 1 },
        ts: { type: 'string', example: '2025-01-01T12:00:00.000Z' },
      },
    },
  })
  async puppeteerHealth() {
    const health = await this.puppeteerManager.getProcessHealth();

    return {
      status: health.browser_alive && health.browser_connected ? 'ok' : 'degraded',
      ...health,
      ts: new Date().toISOString(),
    };
  }
}
