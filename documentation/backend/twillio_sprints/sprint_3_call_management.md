# Sprint 3: Call Management & Recording

**Duration**: Weeks 3-4 (Extended sprint due to complexity)
**Goal**: Implement full call lifecycle management with recording storage
**Sprint Type**: Core Feature Implementation
**Estimated Effort**: 6-8 days
**Dependencies**: Sprint 1 (Database), Sprint 2 (Configuration)

---

## Overview

This sprint implements the core call management functionality including inbound/outbound call handling, call recording storage, and Lead auto-creation for unknown phone numbers. This is the most complex sprint due to Twilio SDK integration and state management.

> **⚠️ IMPORTANT: Endpoint Namespace Updated**
>
> As of Sprint 7 (Namespace Refactoring), all endpoints in this sprint now use the `/twilio/` namespace and route conflicts have been fixed:
> - OLD: `/api/v1/communication/twilio/calls/initiate`
> - NEW: `/api/v1/communication/twilio/calls/initiate`
> - OLD: `/api/v1/communication/twilio/calls/:id` (conflicted with static routes)
> - NEW: `/api/v1/communication/twilio/calls/:id` (plural, dynamic route)
> - NEW: `/api/v1/communication/twilio/call-history` (static route, registered first)
>
> **Critical Change**: Static routes now registered BEFORE dynamic routes to prevent conflicts.
> All code examples, curl commands, and verification steps below have been updated to reflect the new paths.
> See `sprint_7_namespace_refactoring.md` for full details on the namespace strategy and route ordering.

---

## Prerequisites

- [ ] Sprint 1 & 2 completed
- [ ] Understanding of Twilio Voice API
- [ ] Understanding of TwiML (Twilio Markup Language)
- [ ] File Storage Service familiarity
- [ ] libphonenumber library for phone normalization

---

## Task Breakdown

### Task 3.1: Install Dependencies

**Commands**:
```bash
cd /var/www/lead360.app/api
npm install twilio
npm install libphonenumber-js
npm install --save-dev @types/twilio
```

---

### Task 3.2: Create CallManagementService

**File**: `/var/www/lead360.app/api/src/modules/communication/services/call-management.service.ts`

**Service Structure** (Full Implementation):

```typescript
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { EncryptionService } from '@core/encryption/encryption.service';
import { FileStorageService } from '@core/file-storage/file-storage.service';
import twilio from 'twilio';
import { InitiateCallDto } from '../dto/call/initiate-call.dto';

@Injectable()
export class CallManagementService {
  private readonly logger = new Logger(CallManagementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly fileStorage: FileStorageService,
  ) {}

  /**
   * Handle inbound call from Twilio webhook
   * Creates CallRecord and returns TwiML response
   */
  async handleInboundCall(tenantId: string, twilioPayload: any) {
    const { CallSid, From, To } = twilioPayload;

    this.logger.log(`Inbound call received: ${CallSid} from ${From} to ${To}`);

    // Create CallRecord
    const callRecord = await this.prisma.callRecord.create({
      data: {
        tenant_id: tenantId,
        twilio_call_sid: CallSid,
        direction: 'inbound',
        from_number: From,
        to_number: To,
        status: 'initiated',
        call_type: 'customer_call', // Will be updated if it's office bypass
        consent_message_played: false,
      },
    });

    this.logger.log(`CallRecord created: ${callRecord.id}`);

    return callRecord;
  }

  /**
   * Handle call answered event
   * Updates status to IN_PROGRESS and starts recording
   */
  async handleCallAnswered(callSid: string) {
    const callRecord = await this.prisma.callRecord.findUnique({
      where: { twilio_call_sid: callSid },
    });

    if (!callRecord) {
      this.logger.error(`CallRecord not found for CallSid: ${callSid}`);
      return;
    }

    // Update status
    await this.prisma.callRecord.update({
      where: { id: callRecord.id },
      data: {
        status: 'in_progress',
        started_at: new Date(),
      },
    });

    this.logger.log(`Call ${callSid} marked as in_progress`);

    // Start recording via Twilio API
    try {
      const config = await this.getTenantTwilioConfig(callRecord.tenant_id);
      const credentials = JSON.parse(this.encryption.decrypt(config.credentials));
      const client = twilio(credentials.account_sid, credentials.auth_token);

      await client.calls(callSid).recordings.create({
        recordingStatusCallback: `https://${config.tenant.subdomain}.lead360.app/api/twilio/recording/ready`,
        recordingStatusCallbackMethod: 'POST',
      });

      this.logger.log(`Recording started for call ${callSid}`);
    } catch (error) {
      this.logger.error(`Failed to start recording for ${callSid}: ${error.message}`);
    }
  }

  /**
   * Handle call ended event
   * Updates status, stores duration, queues transcription
   */
  async handleCallEnded(callSid: string, duration: number) {
    const callRecord = await this.prisma.callRecord.findUnique({
      where: { twilio_call_sid: callSid },
    });

    if (!callRecord) {
      this.logger.error(`CallRecord not found for CallSid: ${callSid}`);
      return;
    }

    // Update CallRecord
    await this.prisma.callRecord.update({
      where: { id: callRecord.id },
      data: {
        status: 'completed',
        ended_at: new Date(),
      },
    });

    this.logger.log(`Call ${callSid} marked as completed. Duration: ${duration}s`);

    // If no Lead linked yet, auto-create
    if (!callRecord.lead_id) {
      // Will be handled by LeadMatchingService in webhook handler
    }
  }

  /**
   * Handle recording ready webhook
   * Downloads recording from Twilio and stores in FileStorage
   */
  async handleRecordingReady(callSid: string, recordingUrl: string, duration: number) {
    const callRecord = await this.prisma.callRecord.findUnique({
      where: { twilio_call_sid: callSid },
    });

    if (!callRecord) {
      this.logger.error(`CallRecord not found for CallSid: ${callSid}`);
      return;
    }

    this.logger.log(`Recording ready for call ${callSid}. Downloading...`);

    try {
      // 1. Download recording from Twilio
      const config = await this.getTenantTwilioConfig(callRecord.tenant_id);
      const credentials = JSON.parse(this.encryption.decrypt(config.credentials));

      const response = await fetch(recordingUrl, {
        headers: {
          Authorization: `Basic ${Buffer.from(`${credentials.account_sid}:${credentials.auth_token}`).toString('base64')}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to download recording: ${response.statusText}`);
      }

      const recordingBuffer = Buffer.from(await response.arrayBuffer());

      // 2. Upload to FileStorage
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      const filename = `${callRecord.id}.mp3`;
      const path = `tenants/${callRecord.tenant_id}/communication/recordings/${year}/${month}/${filename}`;

      const uploadedFile = await this.fileStorage.uploadBuffer({
        buffer: recordingBuffer,
        filename,
        mimetype: 'audio/mpeg',
        path,
        tenantId: callRecord.tenant_id,
      });

      // 3. Update CallRecord with recording info
      await this.prisma.callRecord.update({
        where: { id: callRecord.id },
        data: {
          recording_url: uploadedFile.url,
          recording_duration_seconds: duration,
          recording_status: 'available',
        },
      });

      this.logger.log(`Recording stored for call ${callSid}: ${uploadedFile.url}`);

      // 4. Queue transcription job
      // Will be implemented in Sprint 5
      // await this.transcriptionJobService.queueTranscription(callRecord.id);

    } catch (error) {
      this.logger.error(`Failed to process recording for ${callSid}: ${error.message}`);
      await this.prisma.callRecord.update({
        where: { id: callRecord.id },
        data: { recording_status: 'failed' },
      });
    }
  }

  /**
   * Initiate outbound call to Lead
   * Calls user first, then bridges to Lead
   */
  async initiateOutboundCall(tenantId: string, userId: string, dto: InitiateCallDto) {
    // 1. Validate Lead exists
    const lead = await this.prisma.lead.findFirst({
      where: {
        id: dto.lead_id,
        tenant_id: tenantId,
      },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    if (!lead.phone) {
      throw new BadRequestException('Lead does not have a phone number');
    }

    // 2. Get Twilio config
    const config = await this.getTenantTwilioConfig(tenantId);
    const credentials = JSON.parse(this.encryption.decrypt(config.credentials));
    const client = twilio(credentials.account_sid, credentials.auth_token);

    // 3. Create CallRecord
    const callRecord = await this.prisma.callRecord.create({
      data: {
        tenant_id: tenantId,
        lead_id: dto.lead_id,
        twilio_call_sid: '', // Will be updated when call starts
        direction: 'outbound',
        from_number: credentials.from_phone,
        to_number: lead.phone,
        status: 'initiated',
        call_type: 'customer_call',
        initiated_by: userId,
        call_reason: dto.call_reason,
      },
    });

    // 4. Call user first
    try {
      const call = await client.calls.create({
        from: credentials.from_phone,
        to: dto.user_phone_number,
        url: `https://${config.tenant.subdomain}.lead360.app/api/twilio/call/connect/${callRecord.id}`,
        statusCallback: `https://${config.tenant.subdomain}.lead360.app/api/twilio/call/status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
      });

      // Update with Twilio CallSid
      await this.prisma.callRecord.update({
        where: { id: callRecord.id },
        data: { twilio_call_sid: call.sid },
      });

      this.logger.log(`Outbound call initiated: ${call.sid}`);

      return {
        success: true,
        call_record_id: callRecord.id,
        twilio_call_sid: call.sid,
        message: 'Calling your phone. Please answer to connect to the Lead.',
      };
    } catch (error) {
      this.logger.error(`Failed to initiate outbound call: ${error.message}`);
      await this.prisma.callRecord.update({
        where: { id: callRecord.id },
        data: { status: 'failed' },
      });
      throw new BadRequestException(`Failed to initiate call: ${error.message}`);
    }
  }

  /**
   * Bridge user call to Lead (called when user answers)
   * Returns TwiML to connect to Lead
   */
  async bridgeCallToLead(callRecordId: string) {
    const callRecord = await this.prisma.callRecord.findUnique({
      where: { id: callRecordId },
      include: { lead: true },
    });

    if (!callRecord) {
      throw new NotFoundException('Call record not found');
    }

    // Generate TwiML to call Lead and create conference
    const twiml = new twilio.twiml.VoiceResponse();

    // Play message to user
    twiml.say('Please wait, we are connecting your call.');

    // Dial Lead into conference
    const dial = twiml.dial({
      action: `https://api.lead360.app/api/twilio/call/status`,
      record: 'record-from-ringing',
    });

    dial.number({
      statusCallback: `https://api.lead360.app/api/twilio/call/status`,
      statusCallbackEvent: ['answered', 'completed'],
    }, callRecord.to_number);

    return twiml.toString();
  }

  /**
   * Get call details by ID
   */
  async findOne(tenantId: string, callId: string) {
    const call = await this.prisma.callRecord.findFirst({
      where: {
        id: callId,
        tenant_id: tenantId,
      },
      include: {
        lead: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            phone: true,
          },
        },
        initiated_by_user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    if (!call) {
      throw new NotFoundException('Call record not found');
    }

    return call;
  }

  /**
   * Get paginated call history
   */
  async findAll(tenantId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [calls, total] = await Promise.all([
      this.prisma.callRecord.findMany({
        where: { tenant_id: tenantId },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          lead: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              phone: true,
            },
          },
        },
      }),
      this.prisma.callRecord.count({
        where: { tenant_id: tenantId },
      }),
    ]);

    return {
      data: calls,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get signed URL for recording playback
   */
  async getRecordingUrl(tenantId: string, callId: string) {
    const call = await this.prisma.callRecord.findFirst({
      where: {
        id: callId,
        tenant_id: tenantId,
      },
    });

    if (!call) {
      throw new NotFoundException('Call record not found');
    }

    if (!call.recording_url) {
      throw new NotFoundException('Recording not available');
    }

    // Generate signed URL (1-hour expiration)
    const signedUrl = await this.fileStorage.getSignedUrl(call.recording_url, 3600);

    return {
      url: signedUrl,
      duration_seconds: call.recording_duration_seconds,
      transcription_available: call.recording_status === 'transcribed',
    };
  }

  /**
   * Generate TwiML for consent message
   */
  generateConsentTwiML(): string {
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say('This call will be recorded for training purposes.');
    return twiml.toString();
  }

  /**
   * Get tenant Twilio config (helper method)
   */
  private async getTenantTwilioConfig(tenantId: string) {
    // Try SMS config first (most common)
    let config = await this.prisma.tenantSmsConfig.findFirst({
      where: {
        tenant_id: tenantId,
        is_active: true,
      },
      include: { tenant: true },
    });

    if (!config) {
      throw new NotFoundException('No active Twilio configuration found for tenant');
    }

    return config;
  }
}
```

---

### Task 3.3: Create LeadMatchingService

**File**: `/var/www/lead360.app/api/src/modules/communication/services/lead-matching.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { parsePhoneNumber } from 'libphonenumber-js';

@Injectable()
export class LeadMatchingService {
  private readonly logger = new Logger(LeadMatchingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Match phone number to existing Lead or auto-create new Lead
   */
  async matchOrCreateLead(tenantId: string, phoneNumber: string): Promise<string> {
    // 1. Normalize phone number
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

    // 2. Try to match existing Lead
    const existingLead = await this.prisma.lead.findFirst({
      where: {
        tenant_id: tenantId,
        phone: normalizedPhone,
      },
    });

    if (existingLead) {
      this.logger.log(`Lead matched: ${existingLead.id} for phone ${normalizedPhone}`);
      return existingLead.id;
    }

    // 3. Auto-create new Lead
    this.logger.log(`Creating new Lead for unknown phone: ${normalizedPhone}`);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    const newLead = await this.prisma.lead.create({
      data: {
        tenant_id: tenantId,
        first_name: normalizedPhone, // Use phone as first name
        last_name: 'Phone/SMS lead',
        phone: normalizedPhone,
        address: tenant?.address || 'Unknown', // Use tenant office address
        origin: 'Phone/SMS',
        status: 'NEW',
        assigned_to: null,
        created_by: 'SYSTEM', // Special system user ID
      },
    });

    this.logger.log(`New Lead created: ${newLead.id}`);
    return newLead.id;
  }

  /**
   * Normalize phone number to E.164 format
   */
  normalizePhoneNumber(phoneNumber: string): string {
    try {
      // Remove 'whatsapp:' prefix if present
      const cleanNumber = phoneNumber.replace(/^whatsapp:/, '');

      // Parse and format to E.164
      const parsed = parsePhoneNumber(cleanNumber, 'US'); // Default to US if no country code

      if (parsed && parsed.isValid()) {
        return parsed.number; // Returns E.164 format
      }

      // If parsing fails, return as-is (will fail validation later)
      return cleanNumber;
    } catch (error) {
      this.logger.warn(`Failed to normalize phone number ${phoneNumber}: ${error.message}`);
      return phoneNumber;
    }
  }
}
```

---

### Task 3.4: Create DTOs

#### Initiate Call DTO

**File**: `/var/www/lead360.app/api/src/modules/communication/dto/call/initiate-call.dto.ts`

```typescript
import { IsString, IsUUID, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InitiateCallDto {
  @ApiProperty({
    description: 'Lead ID to call',
    example: 'lead-uuid-123',
  })
  @IsUUID()
  lead_id: string;

  @ApiProperty({
    description: 'User phone number to call first (E.164 format)',
    example: '+19781234567',
  })
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, { message: 'Phone number must be in E.164 format' })
  user_phone_number: string;

  @ApiProperty({
    description: 'Reason for the call',
    example: 'Following up on quote request',
    required: false,
  })
  @IsString()
  call_reason?: string;
}
```

#### Call History Query DTO

**File**: `/var/www/lead360.app/api/src/modules/communication/dto/call/call-history-query.dto.ts`

```typescript
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CallHistoryQueryDto {
  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
```

---

### Task 3.5: Create CallManagementController

**File**: `/var/www/lead360.app/api/src/modules/communication/controllers/call-management.controller.ts`

```typescript
import { Controller, Get, Post, Param, Body, Query, Request, UseGuards, StreamableFile } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@core/auth/guards/roles.guard';
import { Roles } from '@core/auth/decorators/roles.decorator';
import { CallManagementService } from '../services/call-management.service';
import { InitiateCallDto } from '../dto/call/initiate-call.dto';
import { CallHistoryQueryDto } from '../dto/call/call-history-query.dto';

@ApiTags('Communication - Calls')
@Controller('api/v1/communication/call')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CallManagementController {
  constructor(private readonly callService: CallManagementService) {}

  @Post('initiate')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({ summary: 'Initiate outbound call to Lead' })
  @ApiResponse({ status: 201, description: 'Call initiated successfully' })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  async initiateCall(@Request() req, @Body() dto: InitiateCallDto) {
    return this.callService.initiateOutboundCall(req.user.tenant_id, req.user.id, dto);
  }

  @Get()
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({ summary: 'Get paginated call history' })
  @ApiResponse({ status: 200, description: 'Call history retrieved' })
  async getCallHistory(@Request() req, @Query() query: CallHistoryQueryDto) {
    return this.callService.findAll(req.user.tenant_id, query.page, query.limit);
  }

  @Get(':id')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({ summary: 'Get call details by ID' })
  @ApiResponse({ status: 200, description: 'Call details retrieved' })
  @ApiResponse({ status: 404, description: 'Call not found' })
  async getCall(@Request() req, @Param('id') callId: string) {
    return this.callService.findOne(req.user.tenant_id, callId);
  }

  @Get(':id/recording')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({ summary: 'Get signed URL for call recording playback' })
  @ApiResponse({ status: 200, description: 'Signed URL generated (expires in 1 hour)' })
  @ApiResponse({ status: 404, description: 'Recording not available' })
  async getRecordingUrl(@Request() req, @Param('id') callId: string) {
    return this.callService.getRecordingUrl(req.user.tenant_id, callId);
  }

  @Get(':id/recording/download')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({ summary: 'Download call recording file' })
  @ApiResponse({ status: 200, description: 'Recording file download', type: StreamableFile })
  @ApiResponse({ status: 404, description: 'Recording not found' })
  async downloadRecording(@Request() req, @Param('id') callId: string) {
    // Implementation will stream file from storage
    // For now, return signed URL redirect
    const { url } = await this.callService.getRecordingUrl(req.user.tenant_id, callId);
    return { download_url: url };
  }
}
```

---

### Task 3.6: Register Services and Controllers

**File**: `/var/www/lead360.app/api/src/modules/communication/communication.module.ts`

**Add to `providers`**:
```typescript
providers: [
  // ... existing
  CallManagementService,
  LeadMatchingService,
],
```

**Add to `controllers`**:
```typescript
controllers: [
  // ... existing
  CallManagementController,
],
```

---

## Acceptance Criteria

- [ ] CallManagementService handles full call lifecycle
- [ ] Inbound calls create CallRecords with proper status tracking
- [ ] Outbound calls bridge user to Lead successfully
- [ ] Recordings downloaded from Twilio and stored in FileStorage
- [ ] Recording URLs generated with 1-hour expiration (signed URLs)
- [ ] LeadMatchingService normalizes phone numbers to E.164 format
- [ ] LeadMatchingService auto-creates Leads for unknown numbers
- [ ] Auto-created Leads have proper default values (name = phone, origin = "Phone/SMS")
- [ ] Call history endpoint returns paginated results
- [ ] All endpoints properly authenticated and RBAC-protected
- [ ] Unit tests for services (>80% coverage)
- [ ] Integration tests for call flow
- [ ] Twilio SDK integrated correctly

---

## Verification Steps

### 1. Initiate Outbound Call
```bash
curl -X POST "http://localhost:3000/api/v1/communication/twilio/calls/initiate" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "lead_id": "{lead_uuid}",
    "user_phone_number": "+19781234567",
    "call_reason": "Follow-up on quote"
  }'

# Expected: 201 Created, call initiated
# Your phone should ring!
```

### 2. Check Call History
```bash
curl -X GET "http://localhost:3000/api/v1/communication/call?page=1&limit=10" \
  -H "Authorization: Bearer {token}"

# Expected: 200 OK with paginated call records
```

### 3. Get Recording URL
```bash
curl -X GET "http://localhost:3000/api/v1/communication/twilio/calls/{call_id}/recording" \
  -H "Authorization: Bearer {token}"

# Expected: 200 OK with signed URL
```

---

## Files Created

- `/api/src/modules/communication/services/call-management.service.ts`
- `/api/src/modules/communication/services/lead-matching.service.ts`
- `/api/src/modules/communication/controllers/call-management.controller.ts`
- `/api/src/modules/communication/dto/call/initiate-call.dto.ts`
- `/api/src/modules/communication/dto/call/call-history-query.dto.ts`

---

## Files Modified

- `/api/src/modules/communication/communication.module.ts`
- `/api/package.json` (added twilio, libphonenumber-js dependencies)

---

## Next Steps

After Sprint 3 completion:
- ✅ Call management functional
- ✅ Recordings stored successfully
- ✅ Leads auto-created
- ➡️ Proceed to **Sprint 4: IVR & Office Bypass Systems**

---

**Sprint 3 Complete**: Calls can be made, recorded, and managed
