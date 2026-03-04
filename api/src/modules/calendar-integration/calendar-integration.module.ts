import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaService } from '../../core/database/prisma.service';
import { EncryptionModule } from '../../core/encryption/encryption.module';
import { CommunicationModule } from '../communication/communication.module';
import { GoogleCalendarService } from './services/google-calendar.service';
import { CalendarProviderConnectionService } from './services/calendar-provider-connection.service';
import { CalendarSyncLogService } from './services/calendar-sync-log.service';
import { GoogleCalendarSyncService } from './services/google-calendar-sync.service';
import { ConflictDetectionService } from './services/conflict-detection.service';
import { GoogleIntegrationController } from './controllers/google-integration.controller';
import { CalendarIntegrationStatusController } from './controllers/calendar-integration-status.controller';
import { GoogleCalendarWebhookController } from './controllers/google-calendar-webhook.controller';
import { SyncLogsController } from './controllers/sync-logs.controller';
import { GoogleCalendarSyncProcessor } from './processors/google-calendar-sync.processor';
import { TokenRefreshScheduler } from './schedulers/token-refresh.scheduler';
import { WebhookRenewalScheduler } from './schedulers/webhook-renewal.scheduler';
import { PeriodicSyncScheduler } from './schedulers/periodic-sync.scheduler';

/**
 * Calendar Integration Module
 * Sprint 12: Outbound Sync - Appointment to Google Calendar Event
 * Sprint 13a: Inbound Sync - Google Calendar Webhook Handler
 * Sprint 14: Token Refresh & Webhook Renewal
 * Sprint 15: Periodic Full Sync & Conflict Detection
 * Sprint 16: Sync Logging & Health Monitoring
 *
 * Responsibilities:
 * - Google OAuth 2.0 flow
 * - Calendar connection management
 * - Outbound sync: Lead360 appointments → Google Calendar events
 * - Inbound sync: Google Calendar webhooks → external blocks
 * - Automatic OAuth token refresh (every 10 minutes)
 * - Automatic webhook channel renewal (every 6 hours)
 * - Periodic full sync (every 6 hours) - Sprint 15
 * - Conflict detection between external blocks and appointments - Sprint 15
 * - Sync logging and monitoring - Sprint 16
 * - Health check endpoint - Sprint 16
 */
@Module({
  imports: [
    ConfigModule,
    EncryptionModule,
    forwardRef(() => CommunicationModule), // Sprint 15: Import for NotificationsService (forwardRef to break circular dependency)
    BullModule.registerQueue({ name: 'calendar-sync' }),
  ],
  controllers: [
    GoogleIntegrationController,
    CalendarIntegrationStatusController,
    GoogleCalendarWebhookController,
    SyncLogsController,
  ],
  providers: [
    GoogleCalendarService,
    CalendarProviderConnectionService,
    CalendarSyncLogService,
    GoogleCalendarSyncService,
    ConflictDetectionService, // Sprint 15
    GoogleCalendarSyncProcessor,
    TokenRefreshScheduler,
    WebhookRenewalScheduler,
    PeriodicSyncScheduler, // Sprint 15
    PrismaService,
  ],
  exports: [
    GoogleCalendarService,
    CalendarProviderConnectionService,
    CalendarSyncLogService,
    GoogleCalendarSyncService,
    ConflictDetectionService, // Sprint 15
  ],
})
export class CalendarIntegrationModule {
  constructor(
    // CRITICAL FIX: Inject processor to force instantiation
    // NestJS lazy-loads providers - they're only instantiated when injected
    // By injecting here, we force the constructor to run, which starts BullMQ worker
    private readonly syncProcessor: GoogleCalendarSyncProcessor,
  ) {}
}
