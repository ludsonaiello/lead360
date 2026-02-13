import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule } from '@nestjs/throttler';
import {
  makeCounterProvider,
  makeHistogramProvider,
} from '@willsoto/nestjs-prometheus';

// Core modules
import { PrismaModule } from '../../core/database/prisma.module';
import { EncryptionModule } from '../../core/encryption/encryption.module';
import { FilesModule } from '../files/files.module';
import { AuditModule } from '../audit/audit.module';

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
import { AudioProcessingService } from './services/audio-processing.service';
import { SpeakerLabelResolverService } from './services/speaker-label-resolver.service';
import { TranscriptMergerService } from './services/transcript-merger.service';
import { SmsKeywordDetectionService } from './services/sms-keyword-detection.service';
import { SmsSendingService } from './services/sms-sending.service';
import { BulkSmsService } from './services/bulk-sms.service';
import { TemplateMergeService } from './services/template-merge.service';
import { SmsTemplateService } from './services/sms-template.service';
import { SmsAnalyticsService } from './services/sms-analytics.service';
import { WebhookRetryService } from './services/webhook-retry.service';
import { SmsMetricsService } from './services/sms-metrics.service';
import { CommunicationHealthService } from './services/communication-health.service';
import { SmsExportService } from './services/sms-export.service';

// Admin Services (Sprint 8)
import { TwilioAdminService } from './services/admin/twilio-admin.service';
import { TwilioUsageTrackingService } from './services/admin/twilio-usage-tracking.service';
import { TwilioHealthMonitorService } from './services/admin/twilio-health-monitor.service';
import { TwilioProviderManagementService } from './services/admin/twilio-provider-management.service';
import { DynamicCronManagerService } from './services/admin/dynamic-cron-manager.service';

// Admin Services (Sprint 11)
import { WebhookManagementService } from './services/admin/webhook-management.service';
import { AlertManagementService } from './services/admin/alert-management.service';
import { TranscriptionProviderManagementService } from './services/admin/transcription-provider-management.service';
import { TenantAssistanceService } from './services/admin/tenant-assistance.service';
import { BulkOperationsService } from './services/admin/bulk-operations.service';
import { CommunicationEventManagementService } from './services/admin/communication-event-management.service';

// Schedulers (Sprint 8)
import { TwilioUsageSyncScheduler } from './schedulers/twilio-usage-sync.scheduler';
import { TwilioHealthCheckScheduler } from './schedulers/twilio-health-check.scheduler';
import { WebhookRetryScheduler } from './schedulers/webhook-retry.scheduler';
import { ExportCleanupScheduler } from './schedulers/export-cleanup.scheduler';

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
import { TranscriptionController } from './controllers/transcription.controller';
import { SmsOptOutController } from './controllers/sms-opt-out.controller';
import { SmsOptOutAdminController } from './controllers/admin/sms-opt-out-admin.controller';
import { SmsController } from './controllers/sms.controller';
import { SmsTemplateController } from './controllers/sms-template.controller';
import { SmsAnalyticsController } from './controllers/sms-analytics.controller';
import { SmsAnalyticsAdminController } from './controllers/admin/sms-analytics-admin.controller';
import { CommunicationHealthController } from './controllers/communication-health.controller';
import { SmsExportController } from './controllers/sms-export.controller';

// Processors
import {
  SendCommunicationEmailProcessor,
  SendSmsProcessor,
  SendWhatsAppProcessor,
  NotificationProcessor,
} from './processors';
import { TranscriptionJobProcessor } from './processors/transcription-job.processor';
import { WebhookRetryProcessor } from './processors/webhook-retry.processor';

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
 * - Webhook Retry System (Automatic retry with exponential backoff) - NEW: Sprint 7
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
 * - Webhook Retry System (Sprint 7) - Automatic exponential backoff (1min, 5min, 15min, 1hr, 24hr)
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
    AuditModule,

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
      { name: 'webhook-retry' },
    ),
  ],
  controllers: [
    // Admin Controllers
    CommunicationProvidersAdminController,
    PlatformEmailConfigAdminController,
    TwilioAdminController, // Sprint 8: 34 admin endpoints
    SmsOptOutAdminController, // Sprint 1 (SMS): SMS opt-out management (TCPA compliance)
    SmsAnalyticsAdminController, // Sprint 6 (SMS): SMS analytics dashboard (cross-tenant)

    // Tenant Controllers
    // - Email Configuration & Templates
    TenantEmailConfigController,
    EmailTemplatesController,
    SendEmailController,
    CommunicationHistoryController,
    NotificationsController,
    NotificationRulesController,

    // - Twilio Configuration (Sprint 2)
    TenantSmsConfigController, // /communication/twilio/sms-config
    TenantWhatsAppConfigController, // /communication/twilio/whatsapp-config

    // - Twilio Call Management (Sprint 3)
    // CRITICAL: CallManagementController has static routes registered BEFORE dynamic routes
    // to prevent route conflicts (e.g., /call-history must come before /calls/:id)
    CallManagementController, // /communication/twilio/calls, /communication/twilio/call-history
    TranscriptionController, // /communication/transcriptions (Sprint 5 - with retry support)

    // - Twilio IVR & Office Bypass (Sprint 4)
    IvrConfigurationController, // /communication/twilio/ivr
    OfficeBypassController, // /communication/twilio/office-whitelist

    // - SMS Opt-Out Management (Sprint 1 - TCPA Compliance)
    SmsOptOutController, // /communication/sms/opt-outs

    // - SMS Sending (Sprint 2)
    SmsController, // /communication/sms/send

    // - SMS Templates (Sprint 3)
    SmsTemplateController, // /communication/sms/templates

    // - SMS Analytics (Sprint 6)
    SmsAnalyticsController, // /communication/sms/analytics

    // - SMS Export (Sprint 10)
    SmsExportController, // /communication/sms/export

    // - Health Check (Sprint 9)
    CommunicationHealthController, // /communication/health

    // Public Webhooks (No authentication)
    WebhooksController,
    TwilioWebhooksController, // /api/twilio/* (called by Twilio)
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

    // SMS Keyword Detection (TCPA Compliance)
    SmsKeywordDetectionService,

    // SMS Sending (Sprint 2)
    SmsSendingService,

    // Bulk SMS (Sprint 5)
    BulkSmsService,

    // SMS Templates (Sprint 3)
    TemplateMergeService,
    SmsTemplateService,

    // SMS Analytics (Sprint 6)
    SmsAnalyticsService,

    // SMS Export (Sprint 10)
    SmsExportService,

    // Webhook Retry (Sprint 7)
    WebhookRetryService,

    // Prometheus Metrics (Sprint 8)
    makeCounterProvider({
      name: 'sms_sent_total',
      help: 'Total SMS messages sent',
      labelNames: ['tenant_id'],
    }),
    makeCounterProvider({
      name: 'sms_delivered_total',
      help: 'Total SMS messages delivered',
      labelNames: ['tenant_id'],
    }),
    makeCounterProvider({
      name: 'sms_failed_total',
      help: 'Total SMS messages failed',
      labelNames: ['tenant_id', 'error_code'],
    }),
    makeHistogramProvider({
      name: 'twilio_api_duration_seconds',
      help: 'Twilio API call duration',
      labelNames: ['tenant_id'],
      buckets: [0.1, 0.5, 1, 2, 5],
    }),
    makeHistogramProvider({
      name: 'webhook_processing_duration_seconds',
      help: 'Webhook processing duration',
      labelNames: ['provider'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1],
    }),
    SmsMetricsService,

    // Health Check (Sprint 9)
    CommunicationHealthService,

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
    AudioProcessingService,
    SpeakerLabelResolverService,
    TranscriptMergerService,

    // Admin Services (Sprint 8)
    TwilioAdminService,
    TwilioUsageTrackingService,
    TwilioHealthMonitorService,
    TwilioProviderManagementService,
    DynamicCronManagerService,

    // Admin Services (Sprint 11)
    WebhookManagementService,
    AlertManagementService,
    TranscriptionProviderManagementService,
    TenantAssistanceService,
    BulkOperationsService,
    CommunicationEventManagementService,

    // Schedulers (Sprint 8) - Now managed by DynamicCronManagerService
    TwilioUsageSyncScheduler,
    TwilioHealthCheckScheduler,
    WebhookRetryScheduler,
    ExportCleanupScheduler, // Sprint 10: Cleanup old export files hourly

    // BullMQ Processors
    SendCommunicationEmailProcessor,
    SendSmsProcessor,
    SendWhatsAppProcessor,
    NotificationProcessor,
    TranscriptionJobProcessor,
    WebhookRetryProcessor,
  ],
  exports: [
    // Export core services for use by other modules
    JsonSchemaValidatorService,
    CommunicationProviderService,
    EmailSenderService,
    SmsSenderService,
    WhatsAppSenderService,
    SmsKeywordDetectionService,
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
    WebhookRetryService,
    SmsMetricsService,
    // Admin Services (Sprint 8) - for use by Admin Module
    TwilioAdminService,
    TwilioUsageTrackingService,
    TwilioHealthMonitorService,
    TwilioProviderManagementService,
    DynamicCronManagerService,
    // Admin Services (Sprint 11)
    WebhookManagementService,
    AlertManagementService,
    TranscriptionProviderManagementService,
    TenantAssistanceService,
    BulkOperationsService,
    CommunicationEventManagementService,
  ],
})
export class CommunicationModule {}
