import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { EncryptionService } from '../../../core/encryption/encryption.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import twilio from 'twilio';

/**
 * CommunicationHealthService
 *
 * Health check service for communication module dependencies.
 * Provides liveness and readiness probes for Kubernetes/monitoring.
 *
 * Checks:
 * - Database connectivity (Prisma)
 * - Redis queue connectivity (BullMQ)
 * - Encryption service functionality
 * - Twilio API connectivity (optional, based on config availability)
 *
 * Status Levels:
 * - healthy: All critical systems operational
 * - degraded: Some systems operational but with issues
 * - unhealthy: Critical systems down
 *
 * @class CommunicationHealthService
 * @since Sprint 9
 */
export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    [key: string]: {
      status: 'up' | 'down';
      message?: string;
      latency_ms?: number;
    };
  };
  timestamp: string;
}

@Injectable()
export class CommunicationHealthService {
  private readonly logger = new Logger(CommunicationHealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    @InjectQueue('communication-sms') private readonly smsQueue: Queue,
  ) {}

  /**
   * Comprehensive health check for communication module
   *
   * Runs all health checks in parallel and aggregates results.
   * Used by /communication/health endpoint.
   *
   * @returns Promise<HealthCheckResult> - Complete health status
   *
   * @example
   * const health = await service.checkHealth();
   * // Returns: {
   * //   status: 'healthy',
   * //   checks: { database: { status: 'up', latency_ms: 5 }, ... },
   * //   timestamp: '2026-02-13T10:00:00Z'
   * // }
   */
  async checkHealth(): Promise<HealthCheckResult> {
    this.logger.debug('Running communication module health check');

    const checks: HealthCheckResult['checks'] = {};

    try {
      // Run all health checks in parallel for performance
      const [dbCheck, redisCheck, encryptionCheck, twilioCheck] =
        await Promise.all([
          this.checkDatabase(),
          this.checkRedis(),
          Promise.resolve(this.checkEncryption()),
          this.checkTwilioApi(),
        ]);

      checks.database = dbCheck;
      checks.redis_queue = redisCheck;
      checks.encryption_service = encryptionCheck;
      checks.twilio_api = twilioCheck;

      // Determine overall status
      const isHealthy = Object.values(checks).every((c) => c.status === 'up');
      const hasCriticalFailure =
        checks.database.status === 'down' ||
        checks.redis_queue.status === 'down' ||
        checks.encryption_service.status === 'down';

      const status = isHealthy
        ? 'healthy'
        : hasCriticalFailure
          ? 'unhealthy'
          : 'degraded';

      this.logger.debug(
        `Health check complete: ${status} (${Object.keys(checks).length} checks)`,
      );

      return {
        status,
        checks,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Health check failed:', errorMessage);

      return {
        status: 'unhealthy',
        checks: {
          error: {
            status: 'down',
            message: `Health check execution failed: ${errorMessage}`,
          },
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Check database connectivity
   *
   * Verifies Prisma can connect to the database with a simple query.
   * Critical check - system cannot operate without database.
   *
   * @private
   * @returns Promise<{ status: 'up' | 'down', latency_ms?: number, message?: string }>
   */
  private async checkDatabase() {
    const startTime = Date.now();
    try {
      // Simple query to verify database connectivity
      await this.prisma.$queryRaw`SELECT 1`;

      const latency = Date.now() - startTime;

      this.logger.debug(`Database check: UP (${latency}ms)`);

      return {
        status: 'up' as const,
        latency_ms: latency,
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        `Database check: DOWN (${latency}ms) - ${errorMessage}`,
      );

      return {
        status: 'down' as const,
        message: errorMessage,
        latency_ms: latency,
      };
    }
  }

  /**
   * Check Redis queue connectivity
   *
   * Verifies BullMQ can connect to Redis and retrieve queue status.
   * Critical check - async job processing depends on Redis.
   *
   * @private
   * @returns Promise<{ status: 'up' | 'down', latency_ms?: number, message?: string }>
   */
  private async checkRedis() {
    const startTime = Date.now();
    try {
      // Get queue job counts to verify Redis connectivity
      const jobCounts = await this.smsQueue.getJobCounts();

      const latency = Date.now() - startTime;

      this.logger.debug(
        `Redis queue check: UP (${latency}ms) - Active: ${jobCounts.active}, Waiting: ${jobCounts.waiting}`,
      );

      return {
        status: 'up' as const,
        latency_ms: latency,
        message: `Active: ${jobCounts.active}, Waiting: ${jobCounts.waiting}`,
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        `Redis queue check: DOWN (${latency}ms) - ${errorMessage}`,
      );

      return {
        status: 'down' as const,
        message: errorMessage,
        latency_ms: latency,
      };
    }
  }

  /**
   * Check encryption service functionality
   *
   * Verifies encryption/decryption roundtrip works correctly.
   * Critical check - credentials storage depends on encryption.
   *
   * @private
   * @returns { status: 'up' | 'down', message?: string }
   */
  private checkEncryption() {
    try {
      const testData = 'health-check-test';

      // Test encryption roundtrip
      const encrypted = this.encryption.encrypt(testData);
      const decrypted = this.encryption.decrypt(encrypted);

      if (decrypted !== testData) {
        this.logger.error(
          'Encryption check: DOWN - Encryption/decryption mismatch',
        );

        return {
          status: 'down' as const,
          message: 'Encryption/decryption mismatch',
        };
      }

      this.logger.debug('Encryption check: UP');

      return { status: 'up' as const };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(`Encryption check: DOWN - ${errorMessage}`);

      return {
        status: 'down' as const,
        message: errorMessage,
      };
    }
  }

  /**
   * Check Twilio API connectivity (optional)
   *
   * Verifies Twilio API is reachable if SMS config exists.
   * Non-critical check - system can operate without Twilio (degraded mode).
   *
   * @private
   * @returns Promise<{ status: 'up' | 'down', latency_ms?: number, message?: string }>
   */
  private async checkTwilioApi() {
    const startTime = Date.now();

    try {
      // Get any active SMS config for testing
      const config = await this.prisma.tenant_sms_config.findFirst({
        where: { is_active: true },
      });

      if (!config) {
        const latency = Date.now() - startTime;

        this.logger.debug(
          `Twilio API check: UP (${latency}ms) - No active SMS config (skipped)`,
        );

        return {
          status: 'up' as const,
          message: 'No active SMS config (skipped)',
          latency_ms: latency,
        };
      }

      // Decrypt credentials
      const credentialsData = JSON.parse(
        this.encryption.decrypt(config.credentials),
      ) as { account_sid: string; auth_token: string };

      // Test Twilio API connection
      const client = twilio(
        credentialsData.account_sid,
        credentialsData.auth_token,
      );
      await client.api.accounts(credentialsData.account_sid).fetch();

      const latency = Date.now() - startTime;

      this.logger.debug(`Twilio API check: UP (${latency}ms)`);

      return {
        status: 'up' as const,
        latency_ms: latency,
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.warn(
        `Twilio API check: DOWN (${latency}ms) - ${errorMessage}`,
      );

      return {
        status: 'down' as const,
        message: errorMessage,
        latency_ms: latency,
      };
    }
  }
}
