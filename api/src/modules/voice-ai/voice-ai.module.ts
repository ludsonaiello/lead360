import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../core/database/prisma.module';
import { EncryptionModule } from '../../core/encryption/encryption.module';
import { LeadsModule } from '../leads/leads.module';
import { CalendarModule } from '../calendar/calendar.module'; // Sprint 18: book_appointment tool

// Processors — Sprint B10
import { VoiceAiQuotaResetProcessor } from './processors/voice-ai-quota-reset.processor';
import { VoiceAiUsageSyncProcessor } from './processors/voice-ai-usage-sync.processor';
import { VoiceAiStuckCallCleanupProcessor } from './processors/voice-ai-stuck-call-cleanup.processor';

// Schedulers — Sprint B10
import { VoiceAiJobsScheduler } from './schedulers/voice-ai-jobs.scheduler';

// Controllers — Admin
import { VoiceAiProvidersController } from './controllers/admin/voice-ai-providers.controller';
import { VoiceAiCredentialsController } from './controllers/admin/voice-ai-credentials.controller';
import { VoiceAiGlobalConfigController } from './controllers/admin/voice-ai-global-config.controller';
import { VoiceAiPlanConfigController } from './controllers/admin/voice-ai-plan-config.controller';
import { VoiceAiAdminCallLogsController } from './controllers/admin/voice-ai-admin-call-logs.controller';
import { VoiceAiMonitoringController } from './controllers/admin/voice-ai-monitoring.controller';
import { VoiceAiGlobalAgentProfilesController } from './controllers/admin/voice-ai-global-agent-profiles.controller';

// Controllers — Tenant
import { VoiceAiSettingsController } from './controllers/tenant/voice-ai-settings.controller';
import { VoiceTransferNumbersController } from './controllers/tenant/voice-transfer-numbers.controller';
import { VoiceAiCallLogsController } from './controllers/tenant/voice-ai-call-logs.controller';
import { VoiceAgentProfilesController } from './controllers/tenant/voice-agent-profiles.controller';

// Controllers — Internal (Python agent)
import { VoiceAiInternalController } from './controllers/internal/voice-ai-internal.controller';

// Controllers — Webhooks
import { VoiceAiWebhookController } from './controllers/voice-ai-webhook.controller';

// Guards
import { VoiceAgentKeyGuard } from './guards/voice-agent-key.guard';
import { LiveKitWebhookGuard } from './guards/livekit-webhook.guard';

// Services
import { VoiceAiProvidersService } from './services/voice-ai-providers.service';
import { VoiceAiCredentialsService } from './services/voice-ai-credentials.service';
import { VoiceAiGlobalConfigService } from './services/voice-ai-global-config.service';
import { VoiceAiPlanConfigService } from './services/voice-ai-plan-config.service';
import { VoiceAiSettingsService } from './services/voice-ai-settings.service';
import { VoiceAiContextBuilderService } from './services/voice-ai-context-builder.service';
import { VoiceTransferNumbersService } from './services/voice-transfer-numbers.service';
import { VoiceAiInternalService } from './services/voice-ai-internal.service';
import { VoiceCallLogService } from './services/voice-call-log.service';
import { VoiceUsageService } from './services/voice-usage.service';
import { VoiceAiSipService } from './services/voice-ai-sip.service';
import { VoiceAiMonitoringService } from './services/voice-ai-monitoring.service';
import { VoiceAiWebhookService } from './services/voice-ai-webhook.service';
import { VoiceAgentService } from './agent/voice-agent.service';
import { VoiceAiGlobalAgentProfilesService } from './services/voice-ai-global-agent-profiles.service';
import { VoiceAgentProfilesService } from './services/voice-agent-profiles.service';
import { VoiceAiCallMetadataService } from './services/voice-ai-call-metadata.service';

/**
 * VoiceAiModule
 *
 * Voice AI feature module — manages AI provider registry, credentials,
 * global configuration, subscription plan voice settings, and tenant behavior settings.
 *
 * Sprint B02a: Providers CRUD (admin-only) ✅
 * Sprint B02b: Credentials CRUD (admin-only) ✅
 * Sprint B03:  Global config + plan config (admin-only) ✅
 * Sprint B04:  Tenant settings + Context Builder ✅
 * Sprint B05:  Transfer numbers (tenant) ✅
 * Sprint B06a: Internal agent endpoints — guard + context ✅
 * Sprint B06b: Internal agent endpoints — call lifecycle ✅
 * Sprint B06c: Internal agent endpoints — tool dispatch
 * Sprint B07:  Call logs & usage (full tenant/admin endpoints) ✅
 * Sprint B10:  BullMQ background jobs — monthly quota reset + daily usage sync ✅
 * Sprint B11:  Admin tenant override ✅
 * Sprint B14:  LiveKit webhook handler (room_started / room_finished safety net) ✅
 * Sprint BAS19: Agent worker setup (LiveKit NestJS OnModuleInit) ✅
 * Sprint BAS24: Agent pipeline (STT→LLM→TTS full flow) ✅
 */
@Module({
  imports: [
    PrismaModule,
    EncryptionModule,
    LeadsModule, // Sprint BAS24: Required for LeadsService and LeadPhonesService (agent tools)
    CalendarModule, // Sprint 18: Required for book_appointment tool (SlotCalculationService, AppointmentsService, AppointmentTypesService)
    // BullMQ queues for background jobs (Sprint B10 + stuck call cleanup)
    BullModule.registerQueue(
      { name: 'voice-ai-quota-reset' },
      { name: 'voice-ai-usage-sync' },
      { name: 'voice-ai-stuck-call-cleanup' },
    ),
  ],
  controllers: [
    // Admin controllers
    VoiceAiProvidersController,
    VoiceAiCredentialsController,
    VoiceAiGlobalConfigController,
    VoiceAiPlanConfigController,
    VoiceAiAdminCallLogsController, // B07: cross-tenant call logs + usage report
    VoiceAiMonitoringController, // B11: tenant overview + admin override
    VoiceAiGlobalAgentProfilesController, // Sprint 16: global agent profiles (admin)
    // Tenant controllers
    VoiceAiSettingsController,
    VoiceTransferNumbersController,
    VoiceAiCallLogsController, // B07: tenant call history + usage summary
    VoiceAgentProfilesController, // Sprint 17: tenant agent profile overrides
    // Internal (Python agent) controllers — authenticated via VoiceAgentKeyGuard, not JWT
    VoiceAiInternalController,
    // Webhook controllers — authenticated via HMAC signature, not JWT
    VoiceAiWebhookController, // B14: LiveKit webhook handler
  ],
  providers: [
    VoiceAiProvidersService,
    VoiceAiCredentialsService,
    VoiceAiGlobalConfigService,
    VoiceAiPlanConfigService,
    VoiceAiSettingsService,
    VoiceAiContextBuilderService,
    VoiceTransferNumbersService,
    VoiceAgentKeyGuard, // guard for /internal/voice-ai/* routes
    LiveKitWebhookGuard, // guard for /webhooks/voice-ai/livekit — B14
    VoiceUsageService, // per-call per-provider usage record creation + quota/summary
    VoiceCallLogService, // call lifecycle: start, complete, list, detail
    VoiceAiInternalService, // backs internal context + access + call lifecycle endpoints
    VoiceAiSipService, // B08: IVR voice_ai action — SIP routing + fallback TwiML
    VoiceAiMonitoringService, // B11: cross-tenant monitoring + admin override
    VoiceAiWebhookService, // B14: LiveKit webhook event handler
    VoiceAgentService, // BAS19: LiveKit agent worker (OnModuleInit)
    VoiceAiGlobalAgentProfilesService, // Sprint 16: global agent profiles service
    VoiceAgentProfilesService, // Sprint 17: tenant agent profile overrides service
    VoiceAiCallMetadataService, // Sprint 6: Call metadata storage (Redis) for multi-lingual routing
    // Sprint B10: BullMQ processors + cron scheduler + stuck call cleanup
    VoiceAiQuotaResetProcessor,
    VoiceAiUsageSyncProcessor,
    VoiceAiStuckCallCleanupProcessor,
    VoiceAiJobsScheduler,
  ],
  exports: [
    VoiceAiProvidersService,
    VoiceAiCredentialsService, // used by context builder (internal, B06)
    VoiceAiGlobalConfigService, // used by context builder (internal, B06)
    VoiceAiSettingsService, // used by admin tenant override (B11)
    VoiceAiContextBuilderService, // used by internal agent endpoint (B06a)
    VoiceTransferNumbersService, // used by context builder (B05)
    VoiceAgentKeyGuard, // exported for reuse in B06b and B06c controllers
    VoiceCallLogService, // used by B09 quota guard and B07 tenant/admin endpoints
    VoiceUsageService, // used by B09 quota guard and B07 usage endpoints
    VoiceAiSipService, // used by CommunicationModule IvrConfigurationService (B08)
    VoiceAiCallMetadataService, // used by CommunicationModule IvrConfigurationService + VoiceAiInternalService
  ],
})
export class VoiceAiModule {}
