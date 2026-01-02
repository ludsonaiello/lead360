import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../modules/auth/decorators';

@ApiTags('Health')
@Controller('health')
export class HealthController {
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
}
