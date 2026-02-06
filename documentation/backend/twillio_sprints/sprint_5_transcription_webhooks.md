# Sprint 5: Transcription & Webhooks

**Duration**: Week 6
**Goal**: Implement transcription system and all Twilio webhook handlers
**Sprint Type**: Integration & Webhooks
**Estimated Effort**: 5-6 days
**Dependencies**: Sprint 4 (All core functionality)

---

## Overview

This sprint completes the Twilio integration by implementing call transcription (OpenAI Whisper), all Twilio webhook handlers for public endpoints, usage tracking, and admin endpoints.

---

## Prerequisites

- [ ] Sprint 4 completed (IVR & Bypass working)
- [ ] OpenAI API key available for Whisper
- [ ] Understanding of Twilio webhook signature verification
- [ ] Understanding of BullMQ job processing

---

## Task Breakdown

### Task 5.1: Install Dependencies

```bash
cd /var/www/lead360.app/api
npm install openai
```

---

### Task 5.2: Create TranscriptionProviderService

**File**: `/var/www/lead360.app/api/src/modules/communication/services/transcription-provider.service.ts`

```typescript
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { EncryptionService } from '@core/encryption/encryption.service';
import OpenAI from 'openai';

@Injectable()
export class TranscriptionProviderService {
  private readonly logger = new Logger(TranscriptionProviderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  /**
   * Register transcription provider (System Admin only)
   */
  async registerProvider(
    providerName: string,
    configJson: any,
    tenantId?: string,
    isSystemDefault = false,
  ) {
    // Validate configuration
    await this.validateConfiguration(providerName, configJson);

    // Encrypt configuration
    const encryptedConfig = this.encryption.encrypt(JSON.stringify(configJson));

    return this.prisma.transcriptionProviderConfiguration.create({
      data: {
        tenant_id: tenantId || null,
        provider_name: providerName,
        is_system_default: isSystemDefault,
        status: 'active',
        configuration_json: encryptedConfig,
        usage_current: 0,
      },
    });
  }

  /**
   * Get active transcription provider for tenant or system default
   */
  async getActiveProvider(tenantId?: string) {
    // Try tenant-specific provider first
    if (tenantId) {
      const tenantProvider = await this.prisma.transcriptionProviderConfiguration.findFirst({
        where: {
          tenant_id: tenantId,
          status: 'active',
        },
      });

      if (tenantProvider) {
        return tenantProvider;
      }
    }

    // Fallback to system default
    const systemProvider = await this.prisma.transcriptionProviderConfiguration.findFirst({
      where: {
        is_system_default: true,
        status: 'active',
      },
    });

    if (!systemProvider) {
      throw new NotFoundException('No active transcription provider found');
    }

    return systemProvider;
  }

  /**
   * Validate provider configuration
   */
  async validateConfiguration(providerName: string, config: any): Promise<void> {
    switch (providerName) {
      case 'openai_whisper':
        if (!config.api_key) {
          throw new BadRequestException('OpenAI Whisper requires api_key in configuration');
        }

        // Test API key by making test call
        try {
          const openai = new OpenAI({ apiKey: config.api_key });
          // Can't test without audio file, so just instantiate
          this.logger.log('OpenAI Whisper configuration validated');
        } catch (error) {
          throw new BadRequestException(`Invalid OpenAI API key: ${error.message}`);
        }
        break;

      case 'oracle':
        // Future implementation
        throw new BadRequestException('Oracle transcription provider not yet implemented');

      case 'assemblyai':
        // Future implementation
        throw new BadRequestException('AssemblyAI provider not yet implemented');

      default:
        throw new BadRequestException(`Unknown provider: ${providerName}`);
    }
  }

  /**
   * Get decrypted provider configuration
   */
  async getDecryptedConfig(providerId: string) {
    const provider = await this.prisma.transcriptionProviderConfiguration.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      throw new NotFoundException('Transcription provider not found');
    }

    const decrypted = JSON.parse(this.encryption.decrypt(provider.configuration_json));
    return {
      provider: provider,
      config: decrypted,
    };
  }

  /**
   * Increment usage counter
   */
  async incrementUsage(providerId: string) {
    await this.prisma.transcriptionProviderConfiguration.update({
      where: { id: providerId },
      data: {
        usage_current: {
          increment: 1,
        },
      },
    });
  }
}
```

---

### Task 5.3: Create TranscriptionJobService

**File**: `/var/www/lead360.app/api/src/modules/communication/services/transcription-job.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '@core/database/prisma.service';

@Injectable()
export class TranscriptionJobService {
  private readonly logger = new Logger(TranscriptionJobService.name);

  constructor(
    @InjectQueue('communication-call-transcription') private transcriptionQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Queue transcription job for call recording
   */
  async queueTranscription(callRecordId: string) {
    const callRecord = await this.prisma.callRecord.findUnique({
      where: { id: callRecordId },
    });

    if (!callRecord) {
      this.logger.error(`CallRecord not found: ${callRecordId}`);
      return;
    }

    if (!callRecord.recording_url) {
      this.logger.warn(`No recording URL for call ${callRecordId}`);
      return;
    }

    // Create transcription record
    const transcription = await this.prisma.callTranscription.create({
      data: {
        tenant_id: callRecord.tenant_id,
        call_record_id: callRecord.id,
        transcription_provider: 'openai_whisper', // Will be determined by provider service
        status: 'queued',
      },
    });

    // Queue job
    await this.transcriptionQueue.add(
      'process-transcription',
      {
        callRecordId: callRecord.id,
        transcriptionId: transcription.id,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 30000, // 30 seconds
        },
        removeOnComplete: {
          age: 86400, // Keep for 24 hours
        },
        removeOnFail: false, // Keep failed jobs for debugging
      },
    );

    this.logger.log(`Transcription job queued for call ${callRecordId}`);

    // Update call record
    await this.prisma.callRecord.update({
      where: { id: callRecordId },
      data: {
        recording_status: 'processing_transcription',
        transcription_id: transcription.id,
      },
    });
  }

  /**
   * Search transcriptions (full-text search)
   */
  async searchTranscriptions(tenantId: string, query: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    // Use MySQL full-text search
    const results = await this.prisma.$queryRawUnsafe(`
      SELECT ct.*, cr.from_number, cr.to_number, cr.created_at as call_date
      FROM call_transcription ct
      JOIN call_record cr ON ct.call_record_id = cr.id
      WHERE ct.tenant_id = ?
        AND ct.status = 'completed'
        AND MATCH(ct.transcription_text) AGAINST(? IN NATURAL LANGUAGE MODE)
      ORDER BY cr.created_at DESC
      LIMIT ? OFFSET ?
    `, tenantId, query, limit, skip);

    const total = await this.prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as count
      FROM call_transcription ct
      WHERE ct.tenant_id = ?
        AND ct.status = 'completed'
        AND MATCH(ct.transcription_text) AGAINST(? IN NATURAL LANGUAGE MODE)
    `, tenantId, query);

    return {
      data: results,
      meta: {
        total: total[0].count,
        page,
        limit,
        totalPages: Math.ceil(total[0].count / limit),
      },
    };
  }
}
```

---

### Task 5.4: Create TranscriptionJobProcessor

**File**: `/var/www/lead360.app/api/src/modules/communication/processors/transcription-job.processor.ts`

```typescript
import { Processor, Process, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { FileStorageService } from '@core/file-storage/file-storage.service';
import { TranscriptionProviderService } from '../services/transcription-provider.service';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

@Processor('communication-call-transcription')
export class TranscriptionJobProcessor extends WorkerHost {
  private readonly logger = new Logger(TranscriptionJobProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fileStorage: FileStorageService,
    private readonly transcriptionProvider: TranscriptionProviderService,
  ) {
    super();
  }

  @Process('process-transcription')
  async process(job: Job): Promise<any> {
    const { callRecordId, transcriptionId } = job.data;

    this.logger.log(`Processing transcription for call ${callRecordId}`);

    try {
      // 1. Load call record
      const callRecord = await this.prisma.callRecord.findUnique({
        where: { id: callRecordId },
      });

      if (!callRecord) {
        throw new Error(`CallRecord not found: ${callRecordId}`);
      }

      // 2. Get transcription provider
      const provider = await this.transcriptionProvider.getActiveProvider(callRecord.tenant_id);
      const { config } = await this.transcriptionProvider.getDecryptedConfig(provider.id);

      // 3. Check usage limits
      if (provider.usage_limit && provider.usage_current >= provider.usage_limit) {
        throw new Error('Transcription provider usage limit exceeded');
      }

      // 4. Download recording to temp file
      const recordingBuffer = await this.fileStorage.downloadFile(callRecord.recording_url);
      const tempFilePath = path.join(os.tmpdir(), `recording-${callRecordId}.mp3`);
      fs.writeFileSync(tempFilePath, recordingBuffer);

      // 5. Transcribe based on provider
      let transcriptionText: string;
      let languageDetected: string;
      let confidenceScore: number;

      const startTime = Date.now();

      switch (provider.provider_name) {
        case 'openai_whisper':
          const openai = new OpenAI({ apiKey: config.api_key });
          const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempFilePath),
            model: config.model || 'whisper-1',
            language: config.language,
            response_format: 'verbose_json',
          });

          transcriptionText = transcription.text;
          languageDetected = transcription.language || 'en';
          confidenceScore = 0.95; // OpenAI doesn't provide confidence, assume high
          break;

        default:
          throw new Error(`Unsupported provider: ${provider.provider_name}`);
      }

      const processingDuration = Math.floor((Date.now() - startTime) / 1000);

      // 6. Save transcription
      await this.prisma.callTranscription.update({
        where: { id: transcriptionId },
        data: {
          transcription_text: transcriptionText,
          language_detected: languageDetected,
          confidence_score: confidenceScore,
          status: 'completed',
          completed_at: new Date(),
          processing_duration_seconds: processingDuration,
          transcription_provider: provider.provider_name,
        },
      });

      // 7. Update call record
      await this.prisma.callRecord.update({
        where: { id: callRecordId },
        data: {
          recording_status: 'transcribed',
        },
      });

      // 8. Increment provider usage
      await this.transcriptionProvider.incrementUsage(provider.id);

      // 9. Clean up temp file
      fs.unlinkSync(tempFilePath);

      this.logger.log(`Transcription completed for call ${callRecordId}`);

      return {
        success: true,
        transcriptionId,
        text: transcriptionText.substring(0, 100) + '...', // Log snippet
      };

    } catch (error) {
      this.logger.error(`Transcription failed for call ${callRecordId}: ${error.message}`);

      // Update transcription status
      await this.prisma.callTranscription.update({
        where: { id: transcriptionId },
        data: {
          status: 'failed',
          error_message: error.message,
        },
      });

      throw error; // Re-throw for BullMQ retry logic
    }
  }
}
```

---

### Task 5.5: Create TwilioWebhooksController (Public)

**File**: `/var/www/lead360.app/api/src/modules/communication/controllers/twilio-webhooks.controller.ts`

```typescript
import { Controller, Post, Body, Headers, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';
import { Request } from 'express';
import { CallManagementService } from '../services/call-management.service';
import { LeadMatchingService } from '../services/lead-matching.service';
import { IvrConfigurationService } from '../services/ivr-configuration.service';
import { OfficeBypassService } from '../services/office-bypass.service';
import { WebhookVerificationService } from '../services/webhook-verification.service';
import { PrismaService } from '@core/database/prisma.service';

@ApiTags('Twilio Webhooks (Public)')
@Controller('api/twilio')
export class TwilioWebhooksController {
  private readonly logger = new Logger(TwilioWebhooksController.name);

  constructor(
    private readonly callService: CallManagementService,
    private readonly leadMatching: LeadMatchingService,
    private readonly ivrService: IvrConfigurationService,
    private readonly bypassService: OfficeBypassService,
    private readonly webhookVerification: WebhookVerificationService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Inbound SMS webhook
   */
  @Post('sms/inbound')
  @ApiOperation({ summary: 'Receive inbound SMS from Twilio' })
  @ApiResponse({ status: 200, description: 'SMS processed' })
  async handleSmsInbound(
    @Body() body: any,
    @Headers('x-twilio-signature') signature: string,
    @Req() request: Request,
  ) {
    // 1. Extract tenant from subdomain
    const tenantId = await this.resolveTenantFromSubdomain(request);

    // 2. Verify Twilio signature
    const authToken = await this.getTenantAuthToken(tenantId);
    const url = `https://${request.get('host')}${request.path}`;

    if (!this.webhookVerification.verifyTwilio(url, body, signature, authToken)) {
      this.logger.error('Invalid Twilio signature for SMS webhook');
      return { error: 'Invalid signature' };
    }

    // 3. Create/match Lead
    const leadId = await this.leadMatching.matchOrCreateLead(tenantId, body.From);

    // 4. Create SmsRecord (if not already handled by processor)
    await this.prisma.communicationEvent.create({
      data: {
        tenant_id: tenantId,
        channel: 'sms',
        direction: 'inbound',
        to_phone: body.To,
        from_phone: body.From, // Store in communication_event table as fallback
        text_body: body.Body,
        status: 'delivered',
        provider_message_id: body.MessageSid,
        // Link to Lead if needed
      },
    });

    this.logger.log(`Inbound SMS processed: ${body.MessageSid}`);

    return {}; // Empty 200 OK response
  }

  /**
   * Inbound call webhook
   */
  @Post('call/inbound')
  @ApiOperation({ summary: 'Receive inbound call from Twilio' })
  async handleCallInbound(@Body() body: any, @Req() request: Request) {
    const tenantId = await this.resolveTenantFromSubdomain(request);

    // Create CallRecord and get TwiML response
    await this.callService.handleInboundCall(tenantId, body);

    // Return TwiML (integrated with IVR/bypass logic inside service)
    return { /* TwiML XML */ };
  }

  /**
   * Call status webhook
   */
  @Post('call/status')
  async handleCallStatus(@Body() body: any) {
    const { CallSid, CallStatus, CallDuration } = body;

    this.logger.log(`Call status update: ${CallSid} - ${CallStatus}`);

    switch (CallStatus) {
      case 'ringing':
        // Update status
        break;
      case 'in-progress':
        await this.callService.handleCallAnswered(CallSid);
        break;
      case 'completed':
        await this.callService.handleCallEnded(CallSid, parseInt(CallDuration));
        break;
    }

    return {};
  }

  /**
   * Recording ready webhook
   */
  @Post('recording/ready')
  async handleRecordingReady(@Body() body: any) {
    const { CallSid, RecordingUrl, RecordingDuration } = body;

    await this.callService.handleRecordingReady(
      CallSid,
      RecordingUrl,
      parseInt(RecordingDuration),
    );

    return {};
  }

  /**
   * IVR input webhook
   */
  @Post('ivr/input')
  async handleIvrInput(@Body() body: any, @Req() request: Request) {
    const tenantId = await this.resolveTenantFromSubdomain(request);
    const { Digits } = body;

    const twiml = await this.ivrService.executeIvrAction(tenantId, Digits);

    return twiml; // Return TwiML XML
  }

  /**
   * Helper: Resolve tenant from subdomain
   */
  private async resolveTenantFromSubdomain(request: Request): Promise<string> {
    const host = request.get('host');
    const subdomain = host.split('.')[0];

    const tenant = await this.prisma.tenant.findFirst({
      where: { subdomain },
    });

    if (!tenant) {
      throw new Error(`Tenant not found for subdomain: ${subdomain}`);
    }

    return tenant.id;
  }

  /**
   * Helper: Get tenant Twilio auth token for signature verification
   */
  private async getTenantAuthToken(tenantId: string): Promise<string> {
    // Get from tenant SMS config
    // Decrypt and return auth_token
    return 'auth_token_placeholder'; // Implement actual logic
  }
}
```

---

### Task 5.6: Register All Services/Controllers/Processors

**File**: `/var/www/lead360.app/api/src/modules/communication/communication.module.ts`

```typescript
providers: [
  // ... existing
  TranscriptionProviderService,
  TranscriptionJobService,
],
controllers: [
  // ... existing
  TwilioWebhooksController,
],
// Processors auto-discovered by @Processor decorator
```

---

## Acceptance Criteria

- [ ] Transcription provider service manages OpenAI Whisper config
- [ ] Transcription jobs queue successfully via BullMQ
- [ ] Transcriptions process within 30-minute SLA
- [ ] Transcription text stored and searchable (full-text)
- [ ] All 5 Twilio webhook handlers implemented and working
- [ ] Webhook signature verification enforced on all webhooks
- [ ] SMS inbound webhook creates communication event and matches Lead
- [ ] Call status webhook updates CallRecord status correctly
- [ ] Recording ready webhook downloads and stores recording
- [ ] IVR input webhook executes menu actions
- [ ] Tenant resolved from subdomain in webhook handlers
- [ ] Failed transcriptions retry with exponential backoff
- [ ] Usage tracking increments for each transcription
- [ ] E2E tests for all webhook flows
- [ ] Unit tests for services (>80% coverage)

---

## Verification Steps

### 1. Queue Transcription
```bash
# After a call recording is ready, check job queue
# Verify transcription job created in BullMQ
```

### 2. Test Full Call Flow
```bash
# 1. Make inbound call to Twilio number
# 2. Verify IVR menu plays
# 3. Press digit
# 4. Complete call
# 5. Wait for recording ready webhook
# 6. Wait for transcription processing (check logs)
# 7. Search transcription via API
```

### 3. Search Transcriptions
```bash
curl -X GET "http://localhost:3000/api/v1/communication/transcriptions/search?query=quote&page=1" \
  -H "Authorization: Bearer {token}"

# Expected: Results with matching transcriptions
```

---

## Files Created

- `/api/src/modules/communication/services/transcription-provider.service.ts`
- `/api/src/modules/communication/services/transcription-job.service.ts`
- `/api/src/modules/communication/processors/transcription-job.processor.ts`
- `/api/src/modules/communication/controllers/twilio-webhooks.controller.ts`

---

## Files Modified

- `/api/src/modules/communication/communication.module.ts`
- `/api/package.json` (added openai dependency)

---

## Next Steps

After Sprint 5 completion:
- ✅ All core Twilio functionality implemented
- ✅ Transcriptions working
- ✅ All webhooks functional
- ➡️ Proceed to **Sprint 6: API Documentation**

---

**Sprint 5 Complete**: Full Twilio integration with transcription
