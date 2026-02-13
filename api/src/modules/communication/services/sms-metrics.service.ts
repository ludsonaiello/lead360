import { Injectable } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';

/**
 * SMS Metrics Service
 *
 * Provides methods to track SMS-related metrics for Prometheus monitoring:
 * - SMS sent counter (by tenant)
 * - SMS delivered counter (by tenant)
 * - SMS failed counter (by tenant and error code)
 * - Twilio API duration histogram (by tenant)
 * - Webhook processing duration histogram (by provider)
 *
 * Metrics are exposed at /metrics endpoint for Prometheus scraping.
 *
 * Usage:
 * - Inject this service into components that send SMS or process webhooks
 * - Call appropriate methods to record metric events
 * - Prometheus will scrape the /metrics endpoint automatically
 *
 * @example
 * ```typescript
 * // In SMS processor:
 * this.metrics.incrementSmsSent(tenantId);
 * this.metrics.recordTwilioApiDuration(tenantId, durationSeconds);
 *
 * // In webhook controller:
 * if (status === 'delivered') {
 *   this.metrics.incrementSmsDelivered(tenantId);
 * } else if (status === 'failed') {
 *   this.metrics.incrementSmsFailed(tenantId, errorCode);
 * }
 * ```
 */
@Injectable()
export class SmsMetricsService {
  constructor(
    @InjectMetric('sms_sent_total')
    private readonly smsSentCounter: Counter<string>,

    @InjectMetric('sms_delivered_total')
    private readonly smsDeliveredCounter: Counter<string>,

    @InjectMetric('sms_failed_total')
    private readonly smsFailedCounter: Counter<string>,

    @InjectMetric('twilio_api_duration_seconds')
    private readonly twilioApiDuration: Histogram<string>,

    @InjectMetric('webhook_processing_duration_seconds')
    private readonly webhookDuration: Histogram<string>,
  ) {}

  /**
   * Increment SMS sent counter
   *
   * Called when an SMS is successfully queued/sent via Twilio API.
   * Does NOT wait for delivery confirmation.
   *
   * @param tenantId - Tenant UUID
   */
  incrementSmsSent(tenantId: string): void {
    this.smsSentCounter.inc({ tenant_id: tenantId });
  }

  /**
   * Increment SMS delivered counter
   *
   * Called when Twilio webhook confirms SMS delivery.
   *
   * @param tenantId - Tenant UUID
   */
  incrementSmsDelivered(tenantId: string): void {
    this.smsDeliveredCounter.inc({ tenant_id: tenantId });
  }

  /**
   * Increment SMS failed counter
   *
   * Called when SMS sending fails (either at send time or via webhook).
   *
   * @param tenantId - Tenant UUID
   * @param errorCode - Optional error code from Twilio (e.g., "30008")
   */
  incrementSmsFailed(tenantId: string, errorCode?: string): void {
    this.smsFailedCounter.inc({
      tenant_id: tenantId,
      error_code: errorCode || 'unknown',
    });
  }

  /**
   * Record Twilio API call duration
   *
   * Tracks how long Twilio API calls take (for performance monitoring).
   * Histogram allows calculating percentiles (p50, p95, p99).
   *
   * @param tenantId - Tenant UUID
   * @param durationSeconds - Duration in seconds (convert from milliseconds: ms / 1000)
   */
  recordTwilioApiDuration(tenantId: string, durationSeconds: number): void {
    this.twilioApiDuration.observe({ tenant_id: tenantId }, durationSeconds);
  }

  /**
   * Record webhook processing duration
   *
   * Tracks how long webhook processing takes.
   *
   * @param provider - Provider name (e.g., "twilio")
   * @param durationSeconds - Duration in seconds (convert from milliseconds: ms / 1000)
   */
  recordWebhookProcessing(provider: string, durationSeconds: number): void {
    this.webhookDuration.observe({ provider }, durationSeconds);
  }
}
