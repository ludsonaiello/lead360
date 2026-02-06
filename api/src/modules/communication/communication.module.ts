import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule } from '@nestjs/throttler';

// Core modules
import { PrismaModule } from '../../core/database/prisma.module';
import { EncryptionModule } from '../../core/encryption/encryption.module';
import { FilesModule } from '../files/files.module';

// Services
import { JsonSchemaValidatorService } from './services/json-schema-validator.service';
import { CommunicationProviderService } from './services/communication-provider.service';
import { EmailSenderService } from './services/email-sender.service';
import { SmsSenderService } from './services/sms-sender.service';
import { WhatsAppSenderService } from './services/whatsapp-sender.service';
import { WebhookVerificationService } from './services/webhook-verification.service';
import { PlatformEmailConfigService } from './services/platform-email-config.service';
import { TenantEmailConfigService } from './services/tenant-email-config.service';
import { TenantSmsConfigService } from './services/tenant-sms-config.service';
import { TenantWhatsAppConfigService } from './services/tenant-whatsapp-config.service';
import { EmailTemplatesService } from './services/email-templates.service';
import { SendEmailService } from './services/send-email.service';
import { CommunicationHistoryService } from './services/communication-history.service';
import { NotificationsService } from './services/notifications.service';
import { NotificationRulesService } from './services/notification-rules.service';
import { WebhooksService } from './services/webhooks.service';
import { CallManagementService } from './services/call-management.service';
import { LeadMatchingService } from './services/lead-matching.service';
import { IvrConfigurationService } from './services/ivr-configuration.service';
import { OfficeBypassService } from './services/office-bypass.service';
import { TranscriptionProviderService } from './services/transcription-provider.service';
import { TranscriptionJobService } from './services/transcription-job.service';

// Admin Services (Sprint 8)
import { TwilioAdminService } from './services/admin/twilio-admin.service';
import { TwilioUsageTrackingService } from './services/admin/twilio-usage-tracking.service';
import { TwilioHealthMonitorService } from './services/admin/twilio-health-monitor.service';
import { TwilioProviderManagementService } from './services/admin/twilio-provider-management.service';
import { DynamicCronManagerService } from './services/admin/dynamic-cron-manager.service';

// Schedulers (Sprint 8)
import { TwilioUsageSyncScheduler } from './schedulers/twilio-usage-sync.scheduler';
import { TwilioHealthCheckScheduler } from './schedulers/twilio-health-check.scheduler';

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
import { TenantSmsConfigController } from './controllers/tenant-sms-config.controller';
import { TenantWhatsAppConfigController } from './controllers/tenant-whatsapp-config.controller';
import { CallManagementController } from './controllers/call-management.controller';
import { IvrConfigurationController } from './controllers/ivr-configuration.controller';
import { OfficeBypassController } from './controllers/office-bypass.controller';
import { TwilioWebhooksController } from './controllers/twilio-webhooks.controller';
import { TwilioAdminController } from './controllers/admin/twilio-admin.controller';

// Processors
import {
  SendCommunicationEmailProcessor,
  SendSmsProcessor,
  SendWhatsAppProcessor,
  NotificationProcessor,
} from './processors';
import { TranscriptionJobProcessor } from './processors/transcription-job.processor';

/**
 * Communication Module
 *
 * Production-ready multi-provider communication system supporting:
 * - Email (SMTP, SendGrid, Amazon SES, Brevo)
 * - SMS (Twilio)
 * - WhatsApp (Twilio)
 * - Voice Calls (Twilio) - Sprint 3
 * - IVR (Interactive Voice Response) - Sprint 4
 * - Office Bypass (Whitelisted outbound calls) - Sprint 4
 * - Call Transcription (OpenAI Whisper) - NEW: Sprint 5
 * - Twilio Webhooks (SMS, Call, Recording, IVR) - NEW: Sprint 5
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
 * - Call recording storage and retrieval
 * - Lead auto-matching and creation
 * - IVR menu system with DTMF input routing
 * - Office bypass whitelist for authorized outbound calling
 * - Complete audit trail
 * - Admin Control Panel (Sprint 8) - 34 admin endpoints
 * - Usage Tracking (Sprint 8) - Nightly sync from Twilio API (AC-18)
 * - System Health Monitoring (Sprint 8) - Every 15 minutes
 * - Cross-Tenant Visibility (Sprint 8) - View all activity (AC-16)
 *
 * Endpoints: 79+ REST API endpoints + 16 webhook receivers
 * - Tenant/User endpoints: 45+
 * - Admin endpoints: 34 (Sprint 8)
 * - Public webhooks: 16
 */
@Module({
  imports: [
    PrismaModule,
    EncryptionModule,
    FilesModule,

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
      { name: 'communication-call-transcription' },
      { name: 'communication-twilio-usage-sync' },
    ),
  ],
  controllers: [
    // Admin Controllers
    CommunicationProvidersAdminController,
    PlatformEmailConfigAdminController,
    TwilioAdminController, // Sprint 8: 34 admin endpoints

    // Tenant Controllers
    // - Email Configuration & Templates
    TenantEmailConfigController,
    EmailTemplatesController,
    SendEmailController,
    CommunicationHistoryController,
    NotificationsController,
    NotificationRulesController,

    // - Twilio Configuration (Sprint 2)
    TenantSmsConfigController,           // /communication/twilio/sms-config
    TenantWhatsAppConfigController,      // /communication/twilio/whatsapp-config

    // - Twilio Call Management (Sprint 3)
    // CRITICAL: CallManagementController has static routes registered BEFORE dynamic routes
    // to prevent route conflicts (e.g., /call-history must come before /calls/:id)
    CallManagementController,            // /communication/twilio/calls, /communication/twilio/call-history

    // - Twilio IVR & Office Bypass (Sprint 4)
    IvrConfigurationController,          // /communication/twilio/ivr
    OfficeBypassController,              // /communication/twilio/office-whitelist

    // Public Webhooks (No authentication)
    WebhooksController,
    TwilioWebhooksController,            // /api/twilio/* (called by Twilio)
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
    TenantSmsConfigService,
    TenantWhatsAppConfigService,

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

    // Call Management (Sprint 3)
    CallManagementService,
    LeadMatchingService,

    // IVR & Office Bypass (Sprint 4)
    IvrConfigurationService,
    OfficeBypassService,

    // Transcription (Sprint 5)
    TranscriptionProviderService,
    TranscriptionJobService,

    // Admin Services (Sprint 8)
    TwilioAdminService,
    TwilioUsageTrackingService,
    TwilioHealthMonitorService,
    TwilioProviderManagementService,
    DynamicCronManagerService,

    // Schedulers (Sprint 8) - Now managed by DynamicCronManagerService
    TwilioUsageSyncScheduler,
    TwilioHealthCheckScheduler,

    // BullMQ Processors
    SendCommunicationEmailProcessor,
    SendSmsProcessor,
    SendWhatsAppProcessor,
    NotificationProcessor,
    TranscriptionJobProcessor,
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
    TenantSmsConfigService,
    TenantWhatsAppConfigService,
    EmailTemplatesService,
    SendEmailService,
    CommunicationHistoryService,
    NotificationsService,
    NotificationRulesService,
    WebhooksService,
    CallManagementService,
    LeadMatchingService,
    IvrConfigurationService,
    OfficeBypassService,
    TranscriptionProviderService,
    TranscriptionJobService,
    // Admin Services (Sprint 8) - for use by Admin Module
    TwilioAdminService,
    TwilioUsageTrackingService,
    TwilioHealthMonitorService,
    TwilioProviderManagementService,
    DynamicCronManagerService,
  ],
})
export class CommunicationModule {}
