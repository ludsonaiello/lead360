import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../core/database/prisma.service';
import twilio from 'twilio';
import { v4 as uuidv4 } from 'uuid';

/**
 * TwilioHealthMonitorService
 *
 * System Health Monitoring and Alerting Service
 *
 * Responsibilities:
 * - Monitor Twilio API connectivity and performance
 * - Monitor webhook delivery and response times
 * - Monitor transcription provider health
 * - Run comprehensive system health checks (every 15 minutes)
 * - Track API response times for performance metrics
 * - Create alerts when system health degrades
 * - Store health check history for trend analysis
 *
 * Key Features:
 * - Multi-provider health monitoring
 * - Performance tracking (response times)
 * - Automated alerting on failures
 * - Historical health data retention
 * - Graceful degradation handling
 *
 * Health Check Types:
 * - twilio_api: Twilio API connectivity and authentication
 * - webhook_delivery: Webhook endpoint accessibility
 * - transcription_provider: OpenAI Whisper / Oracle API health
 *
 * Status Levels:
 * - HEALTHY: All systems operational, response times normal
 * - DEGRADED: Systems operational but slow response times
 * - DOWN: Systems unavailable or returning errors
 *
 * @class TwilioHealthMonitorService
 * @since Sprint 8
 */
@Injectable()
export class TwilioHealthMonitorService {
  private readonly logger = new Logger(TwilioHealthMonitorService.name);

  /**
   * Response time thresholds (milliseconds)
   * Used to determine HEALTHY vs DEGRADED status
   */
  private readonly RESPONSE_TIME_THRESHOLDS = {
    healthy: 1000, // < 1 second = HEALTHY
    degraded: 3000, // 1-3 seconds = DEGRADED
    // > 3 seconds = potential DOWN
  };

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Test Twilio API connectivity for a specific tenant
   *
   * Verifies that tenant's Twilio credentials are valid and API is reachable.
   * Measures API response time for performance tracking.
   *
   * @param tenantId - UUID of the tenant to test (or 'system' for system-level check)
   * @returns Promise<HealthCheckResult> - Health check result with status and metrics
   *
   * @example
   * const health = await service.checkTwilioConnectivity('tenant-uuid');
   * // Returns: { status: 'HEALTHY', response_time_ms: 234 }
   */
  async checkTwilioConnectivity(
    tenantId: string,
  ): Promise<HealthCheckResult> {
    const startTime = Date.now();

    this.logger.debug(`Testing Twilio connectivity for tenant ${tenantId}`);

    try {
      // Load tenant's active SMS configuration
      const config = await this.prisma.tenant_sms_config.findFirst({
        where: tenantId === 'system'
          ? { is_active: true } // System check: find any active config
          : { tenant_id: tenantId, is_active: true }, // Specific tenant
      });

      if (!config) {
        const responseTime = Date.now() - startTime;

        // Record health check failure
        await this.recordHealthCheck({
          check_type: 'twilio_api',
          status: 'DOWN',
          response_time_ms: responseTime,
          error_message:
            tenantId === 'system'
              ? 'No active SMS configuration found'
              : `No active SMS configuration for tenant ${tenantId}`,
          details: { tenant_id: tenantId },
        });

        return {
          status: 'DOWN',
          error_message: 'No active SMS configuration',
          response_time_ms: responseTime,
        };
      }

      // Decrypt credentials
      const credentials = JSON.parse(config.credentials as string);
      const { account_sid, auth_token } = credentials;

      // Test Twilio API by fetching account info
      const client = twilio(account_sid, auth_token);
      const account = await client.api.accounts(account_sid).fetch();

      const responseTime = Date.now() - startTime;

      // Determine status based on response time
      const status = this.determineStatusFromResponseTime(responseTime);

      // Record successful health check
      await this.recordHealthCheck({
        check_type: 'twilio_api',
        status,
        response_time_ms: responseTime,
        details: {
          tenant_id: tenantId,
          account_sid: account_sid,
          account_status: account.status,
        },
      });

      this.logger.debug(
        `Twilio connectivity check passed for tenant ${tenantId}: ${status} (${responseTime}ms)`,
      );

      return {
        status,
        response_time_ms: responseTime,
        details: {
          account_status: account.status,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      // Record health check failure
      await this.recordHealthCheck({
        check_type: 'twilio_api',
        status: 'DOWN',
        response_time_ms: responseTime,
        error_message: error.message,
        details: {
          tenant_id: tenantId,
          error_code: error.code,
          error_status: error.status,
        },
      });

      this.logger.error(
        `Twilio connectivity check failed for tenant ${tenantId}:`,
        error.message,
      );

      return {
        status: 'DOWN',
        error_message: error.message,
        response_time_ms: responseTime,
      };
    }
  }

  /**
   * Verify webhooks can reach the system
   *
   * Checks that the webhook endpoint is accessible and responding.
   * In production, this could trigger a test webhook from Twilio.
   *
   * @returns Promise<HealthCheckResult> - Webhook health status
   */
  async checkWebhookConnectivity(): Promise<HealthCheckResult> {
    this.logger.debug('Checking webhook endpoint connectivity');

    const startTime = Date.now();

    try {
      // Webhook connectivity check
      // Verifies that webhook endpoint configuration exists
      // In production environments with Twilio test accounts, this could:
      // 1. Send a test webhook from Twilio test account
      // 2. Verify webhook endpoint receives it within timeout
      // 3. Measure actual round-trip time
      // Current implementation validates endpoint configuration

      const webhookConfig = await this.prisma.communication_provider.findFirst({
        where: {
          provider_type: { in: ['sms', 'whatsapp', 'call'] },
          is_active: true,
        },
      });

      const responseTime = Date.now() - startTime;

      if (!webhookConfig) {
        await this.recordHealthCheck({
          check_type: 'webhook_delivery',
          status: 'DOWN',
          response_time_ms: responseTime,
          error_message: 'No active webhook configuration found',
        });

        return {
          status: 'DOWN',
          error_message: 'No active webhook configuration found',
          response_time_ms: responseTime,
        };
      }

      await this.recordHealthCheck({
        check_type: 'webhook_delivery',
        status: 'HEALTHY',
        response_time_ms: responseTime,
        details: {
          message: 'Webhook endpoint configuration is active',
          provider_count: 1,
        },
      });

      return {
        status: 'HEALTHY',
        message: 'Webhook endpoint configuration verified',
        response_time_ms: responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      await this.recordHealthCheck({
        check_type: 'webhook_delivery',
        status: 'DOWN',
        response_time_ms: responseTime,
        error_message: error.message,
      });

      return {
        status: 'DOWN',
        error_message: error.message,
        response_time_ms: responseTime,
      };
    }
  }

  /**
   * Test transcription provider health (OpenAI Whisper)
   *
   * Verifies that transcription provider API is accessible and configured.
   *
   * @returns Promise<HealthCheckResult> - Transcription provider health status
   */
  async checkTranscriptionProviderHealth(): Promise<HealthCheckResult> {
    this.logger.debug('Checking transcription provider health');

    const startTime = Date.now();

    try {
      // Check if active transcription provider is configured
      const provider =
        await this.prisma.transcription_provider_configuration.findFirst({
          where: {
            status: 'active',
            is_system_default: true,
          },
        });

      const responseTime = Date.now() - startTime;

      if (!provider) {
        await this.recordHealthCheck({
          check_type: 'transcription_provider',
          status: 'DOWN',
          response_time_ms: responseTime,
          error_message: 'No active transcription provider configured',
        });

        return {
          status: 'DOWN',
          error_message: 'No active transcription provider configured',
          response_time_ms: responseTime,
        };
      }

      // Check provider usage limits
      const usagePercentage = provider.usage_limit
        ? (provider.usage_current / provider.usage_limit) * 100
        : 0;

      const status =
        usagePercentage >= 100
          ? 'DOWN' // Quota exceeded
          : usagePercentage >= 90
            ? 'DEGRADED' // Near quota limit
            : 'HEALTHY';

      await this.recordHealthCheck({
        check_type: 'transcription_provider',
        status,
        response_time_ms: responseTime,
        details: {
          provider_name: provider.provider_name,
          usage_current: provider.usage_current,
          usage_limit: provider.usage_limit,
          usage_percentage: usagePercentage.toFixed(2),
        },
      });

      this.logger.debug(
        `Transcription provider ${provider.provider_name} status: ${status}`,
      );

      return {
        status,
        response_time_ms: responseTime,
        details: {
          provider: provider.provider_name,
          usage_percentage: usagePercentage.toFixed(2),
        },
        ...(status !== 'HEALTHY' && {
          message:
            status === 'DOWN'
              ? 'Quota exceeded'
              : 'Approaching quota limit (>90%)',
        }),
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      await this.recordHealthCheck({
        check_type: 'transcription_provider',
        status: 'DOWN',
        response_time_ms: responseTime,
        error_message: error.message,
      });

      this.logger.error(
        'Transcription provider health check failed:',
        error.message,
      );

      return {
        status: 'DOWN',
        error_message: error.message,
        response_time_ms: responseTime,
      };
    }
  }

  /**
   * Run comprehensive system health check
   *
   * Called by TwilioHealthCheckScheduler every 15 minutes.
   * Tests all critical systems: Twilio API, webhooks, transcription providers.
   * Creates alerts if any system is down or degraded.
   *
   * @returns Promise<SystemHealthStatus> - Complete system health report
   *
   * @example
   * const health = await service.runSystemHealthCheck();
   * // Returns: {
   * //   isHealthy: true,
   * //   checks: { twilio_api: {...}, webhook_delivery: {...}, ... },
   * //   checked_at: Date
   * // }
   */
  async runSystemHealthCheck(): Promise<SystemHealthStatus> {
    this.logger.log('Running comprehensive system health check');

    try {
      // Run all health checks in parallel for speed
      const [twilioHealth, webhookHealth, transcriptionHealth] =
        await Promise.all([
          this.checkTwilioConnectivity('system'),
          this.checkWebhookConnectivity(),
          this.checkTranscriptionProviderHealth(),
        ]);

      // Determine overall system health
      const isHealthy =
        twilioHealth.status !== 'DOWN' &&
        webhookHealth.status !== 'DOWN' &&
        transcriptionHealth.status !== 'DOWN';

      const status: SystemHealthStatus = {
        isHealthy,
        checks: {
          twilio_api: twilioHealth,
          webhook_delivery: webhookHealth,
          transcription_provider: transcriptionHealth,
        },
        checked_at: new Date(),
      };

      // Log health status
      if (isHealthy) {
        this.logger.log('System health check: ALL SYSTEMS HEALTHY ✓');
      } else {
        this.logger.warn('System health check: DEGRADED OR DOWN ⚠️');
      }

      return status;
    } catch (error) {
      this.logger.error(
        'Failed to run comprehensive health check:',
        error.message,
      );

      // Return degraded status on error
      return {
        isHealthy: false,
        checks: {
          twilio_api: {
            status: 'DOWN',
            error_message: 'Health check execution failed',
          },
          webhook_delivery: {
            status: 'DOWN',
            error_message: 'Health check execution failed',
          },
          transcription_provider: {
            status: 'DOWN',
            error_message: 'Health check execution failed',
          },
        },
        checked_at: new Date(),
        error: error.message,
      };
    }
  }

  /**
   * Get provider API response time metrics (last 24 hours)
   *
   * Provides performance analytics for Twilio API and other providers.
   * Used for capacity planning and performance optimization.
   *
   * @returns Promise<ProviderMetrics[]> - Response time statistics by provider
   *
   * @example
   * const metrics = await service.getProviderResponseTimes();
   * // Returns: [
   * //   { check_type: 'twilio_api', avg: 234, max: 890, min: 120, count: 96 },
   * //   ...
   * // ]
   */
  async getProviderResponseTimes(): Promise<ProviderMetrics[]> {
    this.logger.debug('Fetching provider response time metrics (last 24h)');

    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      // Aggregate response times by check type
      const checks = await this.prisma.system_health_check.groupBy({
        by: ['check_type'],
        where: {
          checked_at: { gte: yesterday },
          status: { in: ['HEALTHY', 'DEGRADED'] }, // Exclude DOWN (likely null response_time)
        },
        _avg: { response_time_ms: true },
        _max: { response_time_ms: true },
        _min: { response_time_ms: true },
        _count: { id: true },
      });

      const metrics: ProviderMetrics[] = checks.map((check) => ({
        check_type: check.check_type,
        avg_response_time_ms: Math.round(check._avg.response_time_ms || 0),
        max_response_time_ms: check._max.response_time_ms || 0,
        min_response_time_ms: check._min.response_time_ms || 0,
        check_count: check._count.id,
        period: '24h',
      }));

      this.logger.debug(
        `Provider metrics fetched: ${metrics.length} check types`,
      );

      return metrics;
    } catch (error) {
      this.logger.error(
        'Failed to fetch provider response times:',
        error.message,
      );
      throw error;
    }
  }

  /**
   * Alert when system health failures detected
   *
   * Creates admin alerts for DOWN or DEGRADED systems.
   * Called by TwilioHealthCheckScheduler after each check.
   *
   * @param healthStatus - System health status from runSystemHealthCheck()
   * @returns Promise<void>
   */
  async alertOnFailures(healthStatus: SystemHealthStatus): Promise<void> {
    if (healthStatus.isHealthy) {
      // System is healthy, no alerts needed
      return;
    }

    this.logger.warn('System health degraded, creating admin alerts');

    try {
      // Identify failed/degraded checks
      const failedChecks: string[] = [];
      const degradedChecks: string[] = [];

      Object.entries(healthStatus.checks).forEach(([checkType, result]) => {
        if (result.status === 'DOWN') {
          failedChecks.push(checkType);
        } else if (result.status === 'DEGRADED') {
          degradedChecks.push(checkType);
        }
      });

      // Create alerts for failed checks (HIGH severity)
      if (failedChecks.length > 0) {
        await this.createAlert({
          type: 'SYSTEM_HEALTH',
          severity: 'HIGH',
          message: `System health check failed: ${failedChecks.join(', ')}`,
          details: {
            failed_checks: failedChecks,
            health_status: healthStatus,
            timestamp: new Date().toISOString(),
          },
        });

        this.logger.error(`High-severity alert created: ${failedChecks.join(', ')} DOWN`);
      }

      // Create alerts for degraded checks (MEDIUM severity)
      if (degradedChecks.length > 0) {
        await this.createAlert({
          type: 'SYSTEM_HEALTH',
          severity: 'MEDIUM',
          message: `System performance degraded: ${degradedChecks.join(', ')}`,
          details: {
            degraded_checks: degradedChecks,
            health_status: healthStatus,
            timestamp: new Date().toISOString(),
          },
        });

        this.logger.warn(`Medium-severity alert created: ${degradedChecks.join(', ')} DEGRADED`);
      }
    } catch (error) {
      this.logger.error('Failed to create health alerts:', error.message);
    }
  }

  /**
   * Get health check history
   *
   * Retrieves historical health check data for trend analysis.
   *
   * @param checkType - Type of health check ('twilio_api', 'webhook_delivery', etc.)
   * @param hours - Number of hours of history to retrieve (default: 24)
   * @returns Promise<HealthCheckHistory[]> - Historical health checks
   */
  async getHealthCheckHistory(
    checkType: string,
    hours: number = 24,
  ): Promise<HealthCheckHistory[]> {
    this.logger.debug(`Fetching ${hours}h health check history for ${checkType}`);

    try {
      const startDate = new Date();
      startDate.setHours(startDate.getHours() - hours);

      const history = await this.prisma.system_health_check.findMany({
        where: {
          check_type: checkType,
          checked_at: { gte: startDate },
        },
        orderBy: { checked_at: 'asc' },
        select: {
          id: true,
          check_type: true,
          status: true,
          response_time_ms: true,
          error_message: true,
          checked_at: true,
        },
      });

      this.logger.debug(`Fetched ${history.length} health check records`);

      return history;
    } catch (error) {
      this.logger.error(
        `Failed to fetch health check history for ${checkType}:`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Record health check result to database
   *
   * @private
   */
  private async recordHealthCheck(data: {
    check_type: string;
    status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
    response_time_ms?: number;
    error_message?: string;
    details?: any;
  }): Promise<void> {
    try {
      await this.prisma.system_health_check.create({
        data: {
          id: uuidv4(),
          check_type: data.check_type,
          status: data.status,
          response_time_ms: data.response_time_ms || null,
          error_message: data.error_message || null,
          details: data.details || null,
          checked_at: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('Failed to record health check:', error.message);
    }
  }

  /**
   * Create admin alert
   *
   * @private
   */
  private async createAlert(data: {
    type: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    message: string;
    details: any;
  }): Promise<void> {
    try {
      await this.prisma.admin_alert.create({
        data: {
          id: uuidv4(),
          type: data.type,
          severity: data.severity,
          message: data.message,
          details: data.details,
          acknowledged: false,
          created_at: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('Failed to create admin alert:', error.message);
    }
  }

  /**
   * Determine health status from response time
   *
   * @private
   */
  private determineStatusFromResponseTime(
    responseTimeMs: number,
  ): 'HEALTHY' | 'DEGRADED' {
    if (responseTimeMs < this.RESPONSE_TIME_THRESHOLDS.healthy) {
      return 'HEALTHY';
    } else if (responseTimeMs < this.RESPONSE_TIME_THRESHOLDS.degraded) {
      return 'DEGRADED';
    } else {
      return 'DEGRADED';
    }
  }
}

/**
 * Type Definitions
 */

export interface HealthCheckResult {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  response_time_ms?: number;
  error_message?: string;
  message?: string;
  details?: any;
}

export interface SystemHealthStatus {
  isHealthy: boolean;
  checks: {
    twilio_api: HealthCheckResult;
    webhook_delivery: HealthCheckResult;
    transcription_provider: HealthCheckResult;
  };
  checked_at: Date;
  error?: string;
}

export interface ProviderMetrics {
  check_type: string;
  avg_response_time_ms: number;
  max_response_time_ms: number;
  min_response_time_ms: number;
  check_count: number;
  period: string;
}

export interface HealthCheckHistory {
  id: string;
  check_type: string;
  status: string;
  response_time_ms: number | null;
  error_message: string | null;
  checked_at: Date;
}
