import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule } from '@nestjs/throttler';

// Core modules
import { PrismaModule } from '../../core/database/prisma.module';
import { EncryptionModule } from '../../core/encryption/encryption.module';

// Services
import { JsonSchemaValidatorService } from './services/json-schema-validator.service';
import { CommunicationProviderService } from './services/communication-provider.service';
import { EmailSenderService } from './services/email-sender.service';
import { SmsSenderService } from './services/sms-sender.service';
import { WhatsAppSenderService } from './services/whatsapp-sender.service';
import { WebhookVerificationService } from './services/webhook-verification.service';
import { PlatformEmailConfigService } from './services/platform-email-config.service';
import { TenantEmailConfigService } from './services/tenant-email-config.service';
import { EmailTemplatesService } from './services/email-templates.service';
import { SendEmailService } from './services/send-email.service';
import { CommunicationHistoryService } from './services/communication-history.service';
import { NotificationsService } from './services/notifications.service';
import { NotificationRulesService } from './services/notification-rules.service';
import { WebhooksService } from './services/webhooks.service';

// Controllers
import {
  CommunicationProvidersAdminController,
  PlatformEmailConfigAdminController,
  TenantEmailConfigController,
  EmailTemplatesController,
  SendEmailController,
  CommunicationHistoryController,
  NotificationsController,
  NotificationRulesController,
  WebhooksController,
} from './controllers';

// Processors
import {
  SendCommunicationEmailProcessor,
  SendSmsProcessor,
  SendWhatsAppProcessor,
  NotificationProcessor,
} from './processors';

/**
 * Communication Module
 *
 * Production-ready multi-provider communication system supporting:
 * - Email (SMTP, SendGrid, Amazon SES, Brevo)
 * - SMS (Twilio)
 * - WhatsApp (Twilio)
 * - In-app Notifications
 * - Webhooks (real-time status tracking)
 *
 * Architecture: Provider Registry Pattern with JSON Schema validation
 *
 * Features:
 * - Dynamic provider configuration (no migrations needed for new providers)
 * - JSON Schema validation for provider credentials
 * - Multi-tenant isolation
 * - Webhook signature verification
 * - Async job processing via BullMQ
 * - Template management with Handlebars
 * - Complete audit trail
 *
 * Endpoints: 37 REST API endpoints + 5 webhook receivers
 */
@Module({
  imports: [
    PrismaModule,
    EncryptionModule,

    // Rate limiting configuration
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 second
        limit: 10, // 10 requests per second
      },
      {
        name: 'medium',
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
      {
        name: 'long',
        ttl: 3600000, // 1 hour
        limit: 1000, // 1000 requests per hour
      },
    ]),

    // Register BullMQ queues for async communication
    BullModule.registerQueue(
      { name: 'communication-email' },
      { name: 'communication-sms' },
      { name: 'communication-whatsapp' },
      { name: 'communication-notifications' },
    ),
  ],
  controllers: [
    // Admin Controllers
    CommunicationProvidersAdminController,
    PlatformEmailConfigAdminController,

    // Tenant Controllers
    TenantEmailConfigController,
    EmailTemplatesController,
    SendEmailController,
    CommunicationHistoryController,
    NotificationsController,
    NotificationRulesController,

    // Public Webhooks
    WebhooksController,
  ],
  providers: [
    // Validation
    JsonSchemaValidatorService,

    // Provider Management
    CommunicationProviderService,

    // Senders
    EmailSenderService,
    SmsSenderService,
    WhatsAppSenderService,

    // Configuration
    PlatformEmailConfigService,
    TenantEmailConfigService,

    // Templates
    EmailTemplatesService,

    // Sending
    SendEmailService,

    // History & Tracking
    CommunicationHistoryService,

    // Notifications
    NotificationsService,
    NotificationRulesService,

    // Webhooks
    WebhookVerificationService,
    WebhooksService,

    // BullMQ Processors
    SendCommunicationEmailProcessor,
    SendSmsProcessor,
    SendWhatsAppProcessor,
    NotificationProcessor,
  ],
  exports: [
    // Export core services for use by other modules
    JsonSchemaValidatorService,
    CommunicationProviderService,
    EmailSenderService,
    SmsSenderService,
    WhatsAppSenderService,
    WebhookVerificationService,
    PlatformEmailConfigService,
    TenantEmailConfigService,
    EmailTemplatesService,
    SendEmailService,
    CommunicationHistoryService,
    NotificationsService,
    NotificationRulesService,
    WebhooksService,
  ],
})
export class CommunicationModule {}
