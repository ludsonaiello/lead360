import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TwilioHealthMonitorService } from '../services/admin/twilio-health-monitor.service';

/**
 * Twilio Health Check Scheduler
 *
 * Proactive System Health Monitoring
 *
 * Responsibilities:
 * - Runs comprehensive health checks every 15 minutes
 * - Monitors Twilio API connectivity and response times
 * - Monitors webhook delivery health
 * - Monitors transcription provider health
 * - Creates alerts when systems degrade or fail
 * - Tracks performance metrics over time
 *
 * Schedule: Every 15 minutes
 * Cron Pattern: At every 15th minute
 *
 * Why Every 15 Minutes:
 * - Balances monitoring frequency with API load
 * - Quick detection of issues (within 15 min)
 * - Sufficient data points for trend analysis (96/day)
 * - Not too aggressive to avoid rate limiting
 *
 * Health Check Components:
 * 1. Twilio API - Tests API connectivity and authentication
 * 2. Webhook Delivery - Verifies webhook endpoints are accessible
 * 3. Transcription Provider - Tests OpenAI Whisper / Oracle API
 *
 * Alerting:
 * - Creates HIGH severity alerts when systems go DOWN
 * - Creates MEDIUM severity alerts when performance degrades
 * - Alerts are viewable in admin dashboard
 * - Can integrate with external alerting systems (PagerDuty, Slack, etc.)
 *
 * @class TwilioHealthCheckScheduler
 * @since Sprint 8
 */
@Injectable()
export class TwilioHealthCheckScheduler {
  private readonly logger = new Logger(TwilioHealthCheckScheduler.name);

  constructor(
    private readonly twilioHealthMonitorService: TwilioHealthMonitorService,
  ) {}

  /**
   * Periodic Health Check Job
   *
   * NOTE: This scheduler is now managed dynamically by DynamicCronManagerService.
   * The Cron decorator has been removed to allow runtime configuration.
   * Schedule is configured via system_settings table.
   * Setting key: twilio_health_check_cron
   *
   * This method is kept for manual triggering via admin endpoint.
   */
  async handleHealthCheck() {
    this.logger.debug('🏥 Running Twilio system health check...');

    const startTime = Date.now();

    try {
      // Run comprehensive health check
      const healthStatus =
        await this.twilioHealthMonitorService.runSystemHealthCheck();

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      // Log health status
      if (healthStatus.isHealthy) {
        this.logger.debug(
          `✅ System health check passed (${duration}s) - All systems HEALTHY`,
        );
      } else {
        this.logger.warn(
          `⚠️  System health check completed (${duration}s) - DEGRADED or DOWN detected`,
        );

        // Log details of failed/degraded checks
        Object.entries(healthStatus.checks).forEach(([checkType, result]) => {
          if (result.status !== 'HEALTHY') {
            this.logger.warn(
              `   ❌ ${checkType}: ${result.status} ${result.error_message ? `- ${result.error_message}` : ''}`,
            );
          }
        });

        // Create alerts for failures
        await this.twilioHealthMonitorService.alertOnFailures(healthStatus);
      }
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      this.logger.error(
        `❌ Health check execution failed after ${duration}s:`,
        error.message,
      );
      this.logger.error('Error stack:', error.stack);

      // Even if health check fails, don't crash - log and continue
      // Next check in 15 minutes will retry
    }
  }

  /**
   * Manual trigger for testing
   *
   * This method can be called manually for testing purposes.
   * In production, use the admin endpoint: GET /admin/communication/health
   *
   * @example
   * // In your test:
   * const result = await scheduler.triggerManualCheck();
   */
  async triggerManualCheck() {
    this.logger.log('Manual health check triggered');
    await this.handleHealthCheck();
  }
}
