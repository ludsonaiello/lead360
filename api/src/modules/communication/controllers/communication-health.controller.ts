import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../../auth/decorators';
import { CommunicationHealthService } from '../services/communication-health.service';

/**
 * CommunicationHealthController
 *
 * Health check endpoints for communication module.
 * Provides liveness and readiness probes for Kubernetes/monitoring systems.
 *
 * IMPORTANT: These endpoints do NOT require authentication.
 * They are designed for monitoring systems (Kubernetes, load balancers, etc.)
 *
 * Endpoints:
 * - GET /communication/health - Complete health check (all dependencies)
 * - GET /communication/health/live - Liveness probe (simple check, always returns 200)
 * - GET /communication/health/ready - Readiness probe (full checks, returns 500 if unhealthy)
 *
 * @class CommunicationHealthController
 * @since Sprint 9
 */
@ApiTags('Communication - Health')
@Controller('communication/health')
export class CommunicationHealthController {
  constructor(private readonly healthService: CommunicationHealthService) {}

  /**
   * Complete health check
   *
   * Runs comprehensive health checks on all communication module dependencies:
   * - Database (Prisma)
   * - Redis queue (BullMQ)
   * - Encryption service
   * - Twilio API (optional)
   *
   * Returns detailed status for each check with latency metrics.
   *
   * @returns {Promise<HealthCheckResult>} Complete health check result
   *
   * @example
   * GET /communication/health
   * Response: {
   *   "status": "healthy",
   *   "checks": {
   *     "database": { "status": "up", "latency_ms": 5 },
   *     "redis_queue": { "status": "up", "latency_ms": 3 },
   *     "encryption_service": { "status": "up" },
   *     "twilio_api": { "status": "up", "latency_ms": 120 }
   *   },
   *   "timestamp": "2026-02-13T10:00:00Z"
   * }
   */
  @Get()
  @Public()
  @ApiOperation({ summary: 'Check communication module health' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Health check completed',
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['healthy', 'degraded', 'unhealthy'],
          example: 'healthy',
        },
        checks: {
          type: 'object',
          properties: {
            database: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['up', 'down'], example: 'up' },
                latency_ms: { type: 'number', example: 5 },
                message: { type: 'string', example: 'Optional error message' },
              },
            },
            redis_queue: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['up', 'down'], example: 'up' },
                latency_ms: { type: 'number', example: 3 },
                message: {
                  type: 'string',
                  example: 'Active: 5, Waiting: 10',
                },
              },
            },
            encryption_service: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['up', 'down'], example: 'up' },
                message: { type: 'string', example: 'Optional error message' },
              },
            },
            twilio_api: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['up', 'down'], example: 'up' },
                latency_ms: { type: 'number', example: 120 },
                message: {
                  type: 'string',
                  example: 'No active SMS config (skipped)',
                },
              },
            },
          },
        },
        timestamp: {
          type: 'string',
          format: 'date-time',
          example: '2026-02-13T10:00:00Z',
        },
      },
    },
  })
  async checkHealth() {
    return await this.healthService.checkHealth();
  }

  /**
   * Liveness probe
   *
   * Simple endpoint that always returns 200 OK if the server is running.
   * Used by Kubernetes liveness probes to determine if the pod should be restarted.
   *
   * Does NOT check dependencies - only verifies the process is alive.
   *
   * @returns {{ status: string }} Simple status object
   *
   * @example
   * GET /communication/health/live
   * Response: { "status": "ok" }
   */
  @Get('live')
  @Public()
  @ApiOperation({ summary: 'Liveness probe (simple check)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Server is running',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
      },
    },
  })
  liveness() {
    return { status: 'ok' };
  }

  /**
   * Readiness probe
   *
   * Full health check that determines if the service is ready to accept traffic.
   * Used by Kubernetes readiness probes and load balancers.
   *
   * Returns 200 OK if healthy or degraded.
   * Returns 500 Internal Server Error if unhealthy (critical systems down).
   *
   * @returns {Promise<HealthCheckResult>} Complete health check result
   * @throws {Error} If system is unhealthy
   *
   * @example
   * GET /communication/health/ready
   * Response (healthy): {
   *   "status": "healthy",
   *   "checks": { ... },
   *   "timestamp": "2026-02-13T10:00:00Z"
   * }
   *
   * Response (unhealthy): HTTP 500 with error message
   */
  @Get('ready')
  @Public()
  @ApiOperation({ summary: 'Readiness probe (full checks)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Service is ready to accept traffic',
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['healthy', 'degraded'],
          example: 'healthy',
        },
        checks: { type: 'object' },
        timestamp: {
          type: 'string',
          format: 'date-time',
          example: '2026-02-13T10:00:00Z',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Service is not ready (critical systems down)',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: { type: 'string', example: 'System unhealthy' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async readiness() {
    const health = await this.healthService.checkHealth();

    if (health.status === 'unhealthy') {
      throw new Error('System unhealthy');
    }

    return health;
  }
}
