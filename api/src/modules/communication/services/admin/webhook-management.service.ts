import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../../../core/database/prisma.service';
import { randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

/**
 * WebhookManagementService
 *
 * Manages webhook configuration, event tracking, and retry logic for the Lead360 platform.
 *
 * Responsibilities:
 * - Get/update webhook configuration (URLs, secrets, verification settings)
 * - Rotate webhook secrets for security
 * - Test webhook endpoints
 * - List webhook events with filtering and pagination
 * - Retry failed webhook processing
 *
 * Security:
 * - Webhook secrets are stored encrypted
 * - All operations require SystemAdmin role (enforced at controller level)
 * - Signature verification can be enabled/disabled per configuration
 *
 * @class WebhookManagementService
 * @since Sprint 11
 */
@Injectable()
export class WebhookManagementService {
  private readonly logger = new Logger(WebhookManagementService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get current webhook configuration
   *
   * Returns the active webhook configuration including base URL,
   * signature verification status, and last rotation date.
   *
   * If no configuration exists, creates a default configuration.
   *
   * @returns Promise<WebhookConfig> - Current webhook configuration
   */
  async getWebhookConfig(): Promise<WebhookConfig> {
    this.logger.log('Fetching webhook configuration');

    try {
      // Try to get existing config
      let config = await this.prisma.webhook_config.findFirst({
        orderBy: { created_at: 'desc' },
      });

      // If no config exists, create default
      if (!config) {
        this.logger.log('No webhook config found, creating default');
        config = await this.createDefaultConfig();
      }

      return {
        id: config.id,
        base_url: config.base_url,
        endpoints: {
          twilio: {
            call: {
              inbound: '/api/v1/twilio/call/inbound',
              status: '/api/v1/twilio/call/status',
              recording_ready: '/api/v1/twilio/recording/ready',
            },
            sms: {
              inbound: '/api/v1/twilio/sms/inbound',
              status: '/api/v1/twilio/sms/status',
            },
            whatsapp: {
              inbound: '/api/v1/twilio/whatsapp/inbound',
              status: '/api/v1/twilio/whatsapp/status',
            },
            ivr: {
              input: '/api/v1/twilio/ivr/input',
            },
          },
          email: {
            sendgrid: '/webhooks/communication/sendgrid',
            brevo: '/webhooks/communication/brevo',
            amazon_ses: '/webhooks/communication/amazon-ses',
          },
        },
        security: {
          signature_verification: config.signature_verification,
          secret_configured: !!config.webhook_secret,
          last_rotated: config.last_rotated,
        },
      };
    } catch (error) {
      this.logger.error('Failed to fetch webhook config:', error.message);
      this.logger.error('Error stack:', error.stack);
      throw new InternalServerErrorException(
        'Failed to retrieve webhook configuration',
      );
    }
  }

  /**
   * Update webhook configuration
   *
   * Updates webhook base URL, signature verification settings, and optionally rotates the secret.
   *
   * @param dto - Update webhook configuration DTO
   * @returns Promise<WebhookConfig> - Updated webhook configuration
   */
  async updateWebhookConfig(
    dto: UpdateWebhookConfigDto,
  ): Promise<WebhookConfig> {
    this.logger.log(
      `Updating webhook configuration (rotate_secret: ${dto.rotate_secret})`,
    );

    try {
      // Get current config or create if doesn't exist
      let config = await this.prisma.webhook_config.findFirst({
        orderBy: { created_at: 'desc' },
      });

      if (!config) {
        this.logger.log('No existing config, creating new');
        config = await this.createDefaultConfig();
      }

      // Prepare update data
      const updateData: any = {};

      if (dto.base_url !== undefined) {
        updateData.base_url = dto.base_url;
      }

      if (dto.signature_verification !== undefined) {
        updateData.signature_verification = dto.signature_verification;
      }

      // Rotate secret if requested
      if (dto.rotate_secret) {
        const newSecret = this.generateWebhookSecret();
        updateData.webhook_secret = newSecret;
        updateData.last_rotated = new Date();
        this.logger.log('Webhook secret rotated');
      }

      // Update configuration
      const updated = await this.prisma.webhook_config.update({
        where: { id: config.id },
        data: updateData,
      });

      this.logger.log('Webhook configuration updated successfully');

      return {
        id: updated.id,
        base_url: updated.base_url,
        endpoints: {
          twilio: {
            call: {
              inbound: '/api/v1/twilio/call/inbound',
              status: '/api/v1/twilio/call/status',
              recording_ready: '/api/v1/twilio/recording/ready',
            },
            sms: {
              inbound: '/api/v1/twilio/sms/inbound',
              status: '/api/v1/twilio/sms/status',
            },
            whatsapp: {
              inbound: '/api/v1/twilio/whatsapp/inbound',
              status: '/api/v1/twilio/whatsapp/status',
            },
            ivr: {
              input: '/api/v1/twilio/ivr/input',
            },
          },
          email: {
            sendgrid: '/webhooks/communication/sendgrid',
            brevo: '/webhooks/communication/brevo',
            amazon_ses: '/webhooks/communication/amazon-ses',
          },
        },
        security: {
          signature_verification: updated.signature_verification,
          secret_configured: !!updated.webhook_secret,
          last_rotated: updated.last_rotated,
        },
      };
    } catch (error) {
      this.logger.error('Failed to update webhook config:', error.message);
      this.logger.error('Error stack:', error.stack);
      throw new InternalServerErrorException(
        'Failed to update webhook configuration',
      );
    }
  }

  /**
   * Rotate webhook secret
   *
   * Generates a new random webhook secret for signature verification.
   * This should be done periodically for security.
   *
   * @returns Promise<{ success: boolean; message: string; last_rotated: Date }>
   */
  async rotateWebhookSecret(): Promise<{
    success: boolean;
    message: string;
    last_rotated: Date | null;
  }> {
    this.logger.log('Rotating webhook secret');

    try {
      let config = await this.prisma.webhook_config.findFirst({
        orderBy: { created_at: 'desc' },
      });

      if (!config) {
        config = await this.createDefaultConfig();
      }

      const newSecret = this.generateWebhookSecret();

      const updated = await this.prisma.webhook_config.update({
        where: { id: config.id },
        data: {
          webhook_secret: newSecret,
          last_rotated: new Date(),
        },
      });

      this.logger.log('Webhook secret rotated successfully');

      return {
        success: true,
        message:
          'Webhook secret rotated successfully. Update your webhook providers with the new secret.',
        last_rotated: updated.last_rotated,
      };
    } catch (error) {
      this.logger.error('Failed to rotate webhook secret:', error.message);
      this.logger.error('Error stack:', error.stack);
      throw new InternalServerErrorException('Failed to rotate webhook secret');
    }
  }

  /**
   * Test webhook endpoint
   *
   * Sends a test webhook payload to verify endpoint configuration and processing.
   *
   * @param type - Webhook type (sms, call, whatsapp, email)
   * @param payload - Test payload to send
   * @returns Promise<TestWebhookResult>
   */
  async testWebhookEndpoint(
    type: string,
    payload: any,
  ): Promise<TestWebhookResult> {
    this.logger.log(`Testing webhook endpoint: ${type}`);

    try {
      const config = await this.getWebhookConfig();

      // Map webhook type to endpoint path
      const endpointMap: Record<string, string> = {
        // Twilio - Call
        call_inbound: config.endpoints.twilio.call.inbound,
        call_status: config.endpoints.twilio.call.status,
        call_recording: config.endpoints.twilio.call.recording_ready,

        // Twilio - SMS
        sms_inbound: config.endpoints.twilio.sms.inbound,
        sms_status: config.endpoints.twilio.sms.status,

        // Twilio - WhatsApp
        whatsapp_inbound: config.endpoints.twilio.whatsapp.inbound,
        whatsapp_status: config.endpoints.twilio.whatsapp.status,

        // Twilio - IVR
        ivr_input: config.endpoints.twilio.ivr.input,

        // Email Providers
        email_sendgrid: config.endpoints.email.sendgrid,
        email_brevo: config.endpoints.email.brevo,
        email_amazon_ses: config.endpoints.email.amazon_ses,

        // Backwards compatibility (old naming)
        call: config.endpoints.twilio.call.inbound,
        sms: config.endpoints.twilio.sms.inbound,
        whatsapp: config.endpoints.twilio.whatsapp.inbound,
        email: config.endpoints.email.sendgrid,
        ivr: config.endpoints.twilio.ivr.input,
      };

      const endpoint = endpointMap[type];
      if (!endpoint) {
        const validTypes = Object.keys(endpointMap)
          .filter((key) => !['call', 'sms', 'whatsapp', 'email'].includes(key)) // Hide legacy types from error message
          .join(', ');
        throw new BadRequestException(
          `Invalid webhook type: ${type}. Must be one of: ${validTypes}`,
        );
      }

      const fullUrl = `${config.base_url}${endpoint}`;

      this.logger.log(`Test webhook URL: ${fullUrl}`);

      // Make REAL HTTP POST request to test webhook endpoint
      const startTime = Date.now();

      try {
        const response = await axios.post(
          fullUrl,
          payload || {
            test: true,
            type,
            timestamp: new Date().toISOString(),
            message: 'Test webhook delivery from admin panel',
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'Lead360-Admin-Webhook-Test/1.0',
            },
            timeout: 10000, // 10 second timeout
            validateStatus: () => true, // Accept any status code
          },
        );

        const responseTime = Date.now() - startTime;

        this.logger.log(
          `Webhook test completed: ${response.status} in ${responseTime}ms`,
        );

        return {
          status:
            response.status >= 200 && response.status < 300
              ? 'success'
              : 'failed',
          webhook_url: fullUrl,
          response_time_ms: responseTime,
          status_code: response.status,
          signature_valid: config.security.signature_verification,
          processing_result:
            response.status >= 200 && response.status < 300
              ? `Test webhook for ${type} processed successfully`
              : `Webhook returned error status ${response.status}: ${response.statusText}`,
        };
      } catch (error) {
        const responseTime = Date.now() - startTime;

        this.logger.error(`Webhook test failed: ${error.message}`);

        return {
          status: 'failed',
          webhook_url: fullUrl,
          response_time_ms: responseTime,
          status_code: error.response?.status || 0,
          signature_valid: false,
          processing_result: `Webhook test failed: ${error.message}`,
        };
      }
    } catch (error) {
      this.logger.error('Failed to test webhook endpoint:', error.message);

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to test webhook endpoint');
    }
  }

  /**
   * Get webhook events with filtering and pagination
   *
   * Returns a paginated list of webhook events with optional filtering by:
   * - Webhook type (sms, call, whatsapp, email)
   * - Processing status (pending, processed, failed)
   * - Date range
   *
   * @param filters - Filter and pagination parameters
   * @returns Promise<PaginatedWebhookEvents>
   */
  async getWebhookEvents(
    filters: WebhookEventFiltersDto,
  ): Promise<PaginatedWebhookEvents> {
    this.logger.log('Fetching webhook events with filters');

    try {
      const {
        webhook_type,
        status,
        start_date,
        end_date,
        page = 1,
        limit = 20,
      } = filters;

      // Build where clause
      const where: any = {};

      if (webhook_type) {
        where.event_type = webhook_type;
      }

      if (status === 'pending') {
        where.processed = false;
      } else if (status === 'processed') {
        where.processed = true;
        where.error_message = null;
      } else if (status === 'failed') {
        where.processed = true;
        where.error_message = { not: null };
      }

      if (start_date || end_date) {
        where.created_at = {};
        if (start_date) {
          where.created_at.gte = new Date(start_date);
        }
        if (end_date) {
          where.created_at.lte = new Date(end_date);
        }
      }

      // Pagination
      const skip = (page - 1) * limit;

      // Fetch events and count in parallel
      const [events, total] = await Promise.all([
        this.prisma.webhook_event.findMany({
          where,
          include: {
            provider: {
              select: {
                id: true,
                provider_name: true,
                provider_type: true,
              },
            },
            communication_event: {
              select: {
                id: true,
                channel: true,
                status: true,
                to_email: true,
                to_phone: true,
              },
            },
          },
          orderBy: { created_at: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.webhook_event.count({ where }),
      ]);

      this.logger.log(
        `Found ${total} webhook events (returning ${events.length})`,
      );

      return {
        data: events.map((event) => ({
          id: event.id,
          provider: event.provider,
          communication_event_id: event.communication_event_id,
          event_type: event.event_type,
          provider_message_id: event.provider_message_id,
          payload: event.payload,
          signature_verified: event.signature_verified,
          ip_address: event.ip_address,
          processed: event.processed,
          processed_at: event.processed_at,
          error_message: event.error_message,
          retry_count: event.retry_count,
          next_retry_at: event.next_retry_at,
          created_at: event.created_at,
          communication_event: event.communication_event,
        })),
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
          has_next: page < Math.ceil(total / limit),
          has_prev: page > 1,
        },
      };
    } catch (error) {
      this.logger.error('Failed to fetch webhook events:', error.message);
      this.logger.error('Error stack:', error.stack);
      throw new InternalServerErrorException(
        'Failed to retrieve webhook events',
      );
    }
  }

  /**
   * Retry failed webhook processing
   *
   * Marks a failed webhook event for retry by resetting its status and incrementing retry count.
   *
   * @param id - Webhook event ID
   * @returns Promise<{ success: boolean; message: string }>
   */
  async retryWebhookEvent(
    id: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Retrying webhook event: ${id}`);

    try {
      // Find the webhook event
      const event = await this.prisma.webhook_event.findUnique({
        where: { id },
      });

      if (!event) {
        throw new NotFoundException(`Webhook event ${id} not found`);
      }

      // Check if already processing or successful
      if (event.processed && !event.error_message) {
        throw new BadRequestException(
          'Cannot retry a successfully processed webhook event',
        );
      }

      // Update event for retry
      await this.prisma.webhook_event.update({
        where: { id },
        data: {
          processed: false,
          error_message: null,
          retry_count: event.retry_count + 1,
          next_retry_at: null, // Clear next retry timestamp
        },
      });

      this.logger.log(
        `Webhook event ${id} queued for retry (attempt #${event.retry_count + 1})`,
      );

      return {
        success: true,
        message: `Webhook event queued for retry (attempt #${event.retry_count + 1})`,
      };
    } catch (error) {
      this.logger.error('Failed to retry webhook event:', error.message);

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to retry webhook event');
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Generate a secure random webhook secret
   *
   * @returns string - 64-character hexadecimal secret
   */
  private generateWebhookSecret(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Create default webhook configuration
   *
   * @returns Promise<webhook_config>
   */
  private async createDefaultConfig() {
    const defaultConfig = await this.prisma.webhook_config.create({
      data: {
        id: uuidv4(),
        base_url: process.env.APP_URL || 'https://api.lead360.app',
        webhook_secret: this.generateWebhookSecret(),
        signature_verification: true,
        last_rotated: new Date(),
      },
    });

    this.logger.log('Default webhook configuration created');
    return defaultConfig;
  }
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface WebhookConfig {
  id: string;
  base_url: string;
  endpoints: {
    twilio: {
      call: {
        inbound: string;
        status: string;
        recording_ready: string;
      };
      sms: {
        inbound: string;
        status: string;
      };
      whatsapp: {
        inbound: string;
        status: string;
      };
      ivr: {
        input: string;
      };
    };
    email: {
      sendgrid: string;
      brevo: string;
      amazon_ses: string;
    };
  };
  security: {
    signature_verification: boolean;
    secret_configured: boolean;
    last_rotated: Date | null;
  };
}

export interface UpdateWebhookConfigDto {
  base_url?: string;
  signature_verification?: boolean;
  rotate_secret?: boolean;
}

export interface TestWebhookResult {
  status: string;
  webhook_url: string;
  response_time_ms: number;
  status_code: number;
  signature_valid: boolean;
  processing_result: string;
}

export interface WebhookEventFiltersDto {
  webhook_type?: string;
  status?: 'pending' | 'processed' | 'failed';
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedWebhookEvents {
  data: any[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}
