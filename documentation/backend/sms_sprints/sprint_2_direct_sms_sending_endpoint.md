# Sprint 2: Direct SMS Sending Endpoint

**Priority:** 🔴 CRITICAL
**Estimated Effort:** 3-5 hours
**Developer:** AI Developer #2
**Dependencies:** None (can run in parallel with Sprint 1)
**Assigned Date:** February 13, 2026

---

## ⚠️ CRITICAL INSTRUCTIONS - READ CAREFULLY

### Before You Write ANY Code:

1. **REVIEW THE ENTIRE SMS SENDING FLOW**
   - Study `api/src/modules/communication/services/sms-sender.service.ts`
   - Study `api/src/modules/communication/processors/send-sms.processor.ts`
   - Understand the BullMQ queue architecture
   - Review how `communication_event` records are created
   - Check existing DTO patterns in `dto/` folder

2. **DO NOT RECREATE EXISTING LOGIC**
   - SMS sending logic already exists - USE IT
   - Queue processor already exists - USE IT
   - DO NOT create new Twilio client instances
   - DO NOT duplicate credential decryption logic
   - DO NOT create new queue patterns

3. **USE EXISTING PATTERNS EXACTLY**
   - Review existing REST endpoints for patterns
   - Follow the same error handling style
   - Use the same validation decorators
   - Follow the same response structure
   - Use the same logging format

4. **VERIFY PROPERTY NAMES IN PRISMA**
   - Check `communication_event` table fields
   - Check `lead` table fields
   - Use EXACT names from schema (snake_case in DB, camelCase in code)
   - Review existing queries for property access patterns

5. **MULTI-TENANT ISOLATION**
   - Always use `req.user.tenant_id` from JWT
   - Never allow cross-tenant SMS sending
   - Verify Lead belongs to tenant before sending

6. **RBAC ENFORCEMENT**
   - Review existing communication endpoints for role patterns
   - Use appropriate roles (likely Owner, Admin, Manager, Sales)
   - Protect endpoint with guards

7. **YOUR DOCUMENTATION**
   - MUST BE SAVED AT documentation/backend/sms_sprints/

---

## Sprint Objective

Create a REST endpoint that allows tenants to send SMS directly from the frontend UI (e.g., "Send SMS" button on Lead detail page).

### Why This Is Critical

**Frontend Blocker:** Currently, there is no way for the frontend to trigger SMS sending via API. The backend has all the SMS sending logic (queue, processor, Twilio integration) but no public REST endpoint exposes it.

**Current State:** SMS can only be resent via `/history/:id/resend` for failed messages.

**Desired State:** Tenants can send new SMS to Leads on-demand.

---

## Requirements

### 1. Create Send SMS DTO

**File:** `api/src/modules/communication/dto/sms/send-sms.dto.ts` (NEW FILE)

**IMPORTANT: Review existing DTO patterns in the dto/ folder first**

```typescript
import { IsNotEmpty, IsString, IsOptional, IsUUID, IsPhoneNumber, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for sending SMS
 *
 * CRITICAL: Review existing DTOs for validation patterns
 * IMPORTANT: Phone number validation must match E.164 format
 */
export class SendSmsDto {
  @ApiProperty({
    description: 'Recipient phone number in E.164 format',
    example: '+12025551234',
  })
  @IsNotEmpty()
  @IsString()
  @IsPhoneNumber(null, { message: 'Phone number must be in E.164 format (e.g., +12025551234)' })
  to_phone: string;

  @ApiProperty({
    description: 'SMS message body (max 1600 characters for segmentation)',
    example: 'Hi John, your quote is ready! View it here: https://...',
    maxLength: 1600,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(1600, {
    message: 'SMS message cannot exceed 1600 characters',
  })
  text_body: string;

  @ApiProperty({
    description: 'Optional: Related entity type (lead, quote, invoice, etc.)',
    example: 'lead',
    required: false,
  })
  @IsOptional()
  @IsString()
  related_entity_type?: string;

  @ApiProperty({
    description: 'Optional: Related entity UUID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    required: false,
  })
  @IsOptional()
  @IsUUID('4')
  related_entity_id?: string;

  @ApiProperty({
    description: 'Optional: Lead UUID (if sending to a Lead)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    required: false,
  })
  @IsOptional()
  @IsUUID('4')
  lead_id?: string;
}
```

---

### 2. Send SMS Response DTO

**File:** `api/src/modules/communication/dto/sms/send-sms-response.dto.ts` (NEW FILE)

```typescript
import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO for SMS sending
 *
 * IMPORTANT: Review existing response DTOs for consistency
 */
export class SendSmsResponseDto {
  @ApiProperty({
    description: 'Communication event UUID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  communication_event_id: string;

  @ApiProperty({
    description: 'Job ID for tracking in queue',
    example: 'job-12345',
  })
  job_id: string;

  @ApiProperty({
    description: 'Current status',
    example: 'queued',
  })
  status: string;

  @ApiProperty({
    description: 'Success message',
    example: 'SMS queued for delivery',
  })
  message: string;

  @ApiProperty({
    description: 'Recipient phone number',
    example: '+12025551234',
  })
  to_phone: string;

  @ApiProperty({
    description: 'Sender phone number (from tenant config)',
    example: '+19781234567',
  })
  from_phone: string;
}
```

---

### 3. SMS Sending Service

**File:** `api/src/modules/communication/services/sms-sending.service.ts` (NEW FILE)

**CRITICAL: This service orchestrates the flow but DOES NOT duplicate existing logic**

```typescript
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';
import { SendSmsDto } from '../dto/sms/send-sms.dto';
import { SendSmsResponseDto } from '../dto/sms/send-sms-response.dto';

/**
 * SMS Sending Service
 *
 * CRITICAL INSTRUCTIONS:
 * - This service ORCHESTRATES the flow
 * - It DOES NOT send SMS directly (that's done by existing SmsSenderService)
 * - It DOES NOT create Twilio clients (that's done by existing processor)
 * - It USES existing queue architecture
 * - It CREATES communication_event records
 *
 * REVIEW THESE FILES FIRST:
 * 1. api/src/modules/communication/processors/send-sms.processor.ts
 * 2. api/src/modules/communication/services/sms-sender.service.ts
 * 3. Existing queue registration in communication.module.ts
 */
@Injectable()
export class SmsSendingService {
  private readonly logger = new Logger(SmsSendingService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('communication-sms') private readonly smsQueue: Queue,
  ) {}

  /**
   * Send SMS to a recipient
   *
   * CRITICAL STEPS:
   * 1. Validate tenant has active SMS config
   * 2. Validate Lead belongs to tenant (if lead_id provided)
   * 3. Check opt-out status (if Sprint 1 is complete)
   * 4. Create communication_event record
   * 5. Queue SMS job
   *
   * @param tenantId - Tenant UUID from JWT token
   * @param userId - User UUID from JWT token
   * @param dto - SMS sending data
   */
  async sendSms(
    tenantId: string,
    userId: string,
    dto: SendSmsDto,
  ): Promise<SendSmsResponseDto> {
    // Step 1: Validate tenant has active SMS configuration
    // IMPORTANT: Review tenant_sms_config table structure
    const smsConfig = await this.prisma.tenant_sms_config.findFirst({
      where: {
        tenant_id: tenantId,
        is_active: true,
      },
      select: {
        id: true,
        from_phone: true,
        is_verified: true,
      },
    });

    if (!smsConfig) {
      throw new NotFoundException(
        'No active SMS configuration found. Please configure Twilio settings first.',
      );
    }

    if (!smsConfig.is_verified) {
      throw new BadRequestException(
        'SMS configuration is not verified. Please test your configuration first.',
      );
    }

    // Step 2: If lead_id provided, validate Lead belongs to tenant
    let lead = null;
    if (dto.lead_id) {
      // CRITICAL: Multi-tenant isolation - check tenant_id
      lead = await this.prisma.lead.findFirst({
        where: {
          id: dto.lead_id,
          tenant_id: tenantId, // MANDATORY: Prevent cross-tenant access
        },
        select: {
          id: true,
          phone: true,
          sms_opt_out: true, // Check opt-out status (Sprint 1 field)
          first_name: true,
          last_name: true,
        },
      });

      if (!lead) {
        throw new NotFoundException(
          'Lead not found or does not belong to your organization',
        );
      }

      // Step 3: Check opt-out status (if Sprint 1 is deployed)
      // IMPORTANT: This field may not exist yet if Sprint 1 is not complete
      // Add conditional check
      if (lead.sms_opt_out === true) {
        throw new ForbiddenException(
          'Cannot send SMS: recipient has opted out (replied STOP)',
        );
      }

      // If to_phone not provided, use Lead's phone
      if (!dto.to_phone && lead.phone) {
        dto.to_phone = lead.phone;
      }
    }

    // Step 4: Validate phone number
    if (!dto.to_phone) {
      throw new BadRequestException(
        'Recipient phone number is required (provide to_phone or lead_id with phone)',
      );
    }

    // Step 5: Create communication_event record
    // CRITICAL: Review communication_event table schema in Prisma
    // Use EXACT field names
    const communicationEvent = await this.prisma.communication_event.create({
      data: {
        tenant_id: tenantId,
        channel: 'sms',
        direction: 'outbound',
        to_phone: dto.to_phone,
        from_phone: smsConfig.from_phone,
        text_body: dto.text_body,
        status: 'pending', // Initial status
        related_entity_type: dto.related_entity_type,
        related_entity_id: dto.related_entity_id,
        created_by: userId,
        // IMPORTANT: Review if these fields exist in schema
        // Add any other required fields based on schema
      },
    });

    this.logger.log(
      `Created communication_event ${communicationEvent.id} for SMS to ${dto.to_phone}`,
    );

    // Step 6: Queue SMS job
    // CRITICAL: Review existing queue job structure in send-sms.processor.ts
    // Match the EXACT job data structure expected by processor
    const job = await this.smsQueue.add('send-sms', {
      communicationEventId: communicationEvent.id,
      tenantId: tenantId,
      toPhone: dto.to_phone,
      textBody: dto.text_body,
      // IMPORTANT: Review processor to see what fields it expects
    });

    this.logger.log(
      `Queued SMS job ${job.id} for communication_event ${communicationEvent.id}`,
    );

    // Step 7: Return response
    return {
      communication_event_id: communicationEvent.id,
      job_id: job.id as string,
      status: 'queued',
      message: 'SMS queued for delivery',
      to_phone: dto.to_phone,
      from_phone: smsConfig.from_phone,
    };
  }
}
```

---

### 4. SMS Controller Endpoint

**File:** `api/src/modules/communication/controllers/sms.controller.ts` (NEW FILE)

```typescript
import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../../core/auth/roles.guard';
import { Roles } from '../../../core/auth/roles.decorator';
import { SmsSendingService } from '../services/sms-sending.service';
import { SendSmsDto } from '../dto/sms/send-sms.dto';
import { SendSmsResponseDto } from '../dto/sms/send-sms-response.dto';

/**
 * SMS Sending Controller
 *
 * CRITICAL: Review existing controllers for exact patterns
 * IMPORTANT: RBAC - who should be able to send SMS?
 * Recommended: Owner, Admin, Manager, Sales (NOT Employee unless specified)
 */
@ApiTags('Communication - SMS')
@Controller('communication/sms')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SmsController {
  private readonly logger = new Logger(SmsController.name);

  constructor(private readonly smsSendingService: SmsSendingService) {}

  /**
   * Send SMS to a recipient
   *
   * Queues SMS for delivery via Twilio
   *
   * @param req - Request object (contains JWT user data)
   * @param dto - SMS sending data
   */
  @Post('send')
  @Roles('Owner', 'Admin', 'Manager', 'Sales') // REVIEW: Confirm role requirements
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send SMS to a recipient' })
  @ApiResponse({
    status: 201,
    description: 'SMS queued successfully',
    type: SendSmsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request (validation error, invalid config, etc.)',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden (recipient opted out or insufficient permissions)',
  })
  @ApiResponse({
    status: 404,
    description: 'Not found (no SMS config, Lead not found, etc.)',
  })
  async sendSms(
    @Req() req: any,
    @Body() dto: SendSmsDto,
  ): Promise<SendSmsResponseDto> {
    const tenantId = req.user.tenant_id; // CRITICAL: From JWT token
    const userId = req.user.id; // CRITICAL: From JWT token

    this.logger.log(
      `User ${userId} (tenant ${tenantId}) sending SMS to ${dto.to_phone}`,
    );

    return await this.smsSendingService.sendSms(tenantId, userId, dto);
  }
}
```

---

### 5. Module Registration

**File:** `api/src/modules/communication/communication.module.ts`

**IMPORTANT: Review existing module configuration**

```typescript
import { SmsSendingService } from './services/sms-sending.service';
import { SmsController } from './controllers/sms.controller';

@Module({
  // ... existing imports ...

  // IMPORTANT: Verify queue is already registered
  // If not, add queue registration (review BullModule patterns)
  imports: [
    // ... existing imports ...
    BullModule.registerQueue({
      name: 'communication-sms', // MUST match queue name in processor
    }),
  ],

  providers: [
    // ... existing providers ...
    SmsSendingService, // ADD THIS
  ],

  controllers: [
    // ... existing controllers ...
    SmsController, // ADD THIS
  ],

  // ... rest of module config ...
})
```

---

## Testing Requirements

### Manual Testing Checklist

**Test 1: Send SMS with Lead ID**

Request:
```bash
POST /api/v1/communication/sms/send
Authorization: Bearer <token>
Content-Type: application/json

{
  "lead_id": "uuid-of-lead",
  "text_body": "Hi! Your quote is ready."
}
```

Expected Response:
```json
{
  "communication_event_id": "uuid",
  "job_id": "job-12345",
  "status": "queued",
  "message": "SMS queued for delivery",
  "to_phone": "+12025551234",
  "from_phone": "+19781234567"
}
```

Verify:
- `communication_event` record created with status='pending'
- BullMQ job queued
- SMS delivered via Twilio
- Status updated to 'sent' → 'delivered'

**Test 2: Send SMS with Direct Phone Number**

Request:
```json
{
  "to_phone": "+12025551234",
  "text_body": "Test message"
}
```

Verify:
- Works without lead_id
- SMS delivered

**Test 3: Send SMS with Related Entity**

Request:
```json
{
  "lead_id": "uuid",
  "text_body": "Your quote #123 is ready!",
  "related_entity_type": "quote",
  "related_entity_id": "quote-uuid"
}
```

Verify:
- `communication_event.related_entity_type` = 'quote'
- `communication_event.related_entity_id` = quote UUID

**Test 4: Error - No SMS Config**

Setup: Deactivate tenant's SMS config

Request: Try to send SMS

Expected: 404 Not Found with message "No active SMS configuration found"

**Test 5: Error - Lead Not Found**

Request: Send SMS with invalid lead_id

Expected: 404 Not Found with message "Lead not found"

**Test 6: Error - Cross-Tenant Access**

Setup: Get lead_id from Tenant A

Request: Send SMS as Tenant B user

Expected: 404 Not Found (Lead not found or doesn't belong to tenant)

**Test 7: Error - Opted Out Lead (if Sprint 1 complete)**

Setup: Opt out Lead via STOP keyword

Request: Try to send SMS to opted-out Lead

Expected: 403 Forbidden with message "recipient has opted out"

**Test 8: RBAC - Employee Cannot Send SMS**

Setup: Login as Employee role

Request: Try to send SMS

Expected: 403 Forbidden (role not authorized)

**Test 9: Long Message (Segmentation)**

Request:
```json
{
  "to_phone": "+12025551234",
  "text_body": "<1600 character message>"
}
```

Verify:
- Message accepted
- Twilio segments message correctly (check provider_metadata)

**Test 10: Invalid Phone Number**

Request:
```json
{
  "to_phone": "123-456-7890",
  "text_body": "Test"
}
```

Expected: 400 Bad Request (phone number validation error)

---

## API Documentation to Update

**File:** `api/documentation/communication_twillio_REST_API.md`

Add new section:

### Send SMS

**`POST /api/v1/communication/sms/send`**

Sends an SMS message to a recipient. Message is queued for delivery via Twilio.

**Authentication:** Required (Bearer token)

**RBAC:** Owner, Admin, Manager, Sales

#### Request Body

```json
{
  "to_phone": "+12025551234",
  "text_body": "Your quote is ready! View it here: https://...",
  "related_entity_type": "quote",
  "related_entity_id": "uuid",
  "lead_id": "uuid"
}
```

#### Request Body Fields

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| to_phone | string | Conditional | E.164 format | Recipient phone number. Required if lead_id not provided or Lead has no phone. |
| text_body | string | Yes | Max 1600 chars | SMS message body |
| related_entity_type | string | No | - | Entity type (lead, quote, invoice, etc.) |
| related_entity_id | string (UUID) | No | Valid UUID v4 | Related entity UUID |
| lead_id | string (UUID) | No | Valid UUID v4 | Lead UUID (auto-fills to_phone if Lead has phone) |

#### Success Response (201 Created)

```json
{
  "communication_event_id": "uuid",
  "job_id": "job-12345",
  "status": "queued",
  "message": "SMS queued for delivery",
  "to_phone": "+12025551234",
  "from_phone": "+19781234567"
}
```

#### Error Responses

**400 Bad Request** - Validation error
```json
{
  "statusCode": 400,
  "message": "Phone number must be in E.164 format",
  "error": "Bad Request"
}
```

**403 Forbidden** - Recipient opted out
```json
{
  "statusCode": 403,
  "message": "Cannot send SMS: recipient has opted out (replied STOP)",
  "error": "Forbidden"
}
```

**404 Not Found** - No SMS config or Lead not found
```json
{
  "statusCode": 404,
  "message": "No active SMS configuration found. Please configure Twilio settings first.",
  "error": "Not Found"
}
```

---

## Acceptance Criteria

- [ ] SendSmsDto created with proper validation
- [ ] SendSmsResponseDto created
- [ ] SmsSendingService implemented
- [ ] SmsController endpoint created
- [ ] Module registration updated
- [ ] Multi-tenant isolation verified (Lead ownership check)
- [ ] RBAC enforced (Owner, Admin, Manager, Sales only)
- [ ] Opt-out check integrated (if Sprint 1 deployed)
- [ ] All manual tests pass
- [ ] API documentation updated
- [ ] Swagger/OpenAPI annotations complete
- [ ] All existing tests still pass (NO BREAKING CHANGES)

---

## Files to Review Before Starting

**MANDATORY - Read these files first:**

1. `api/src/modules/communication/services/sms-sender.service.ts` - SMS sending logic
2. `api/src/modules/communication/processors/send-sms.processor.ts` - Queue processor
3. `api/prisma/schema.prisma` - communication_event, tenant_sms_config, lead tables
4. `api/src/modules/communication/communication.module.ts` - Module configuration
5. `api/src/modules/communication/controllers/` - Controller patterns
6. `api/src/modules/communication/dto/` - DTO patterns
7. `api/src/core/auth/roles.guard.ts` - RBAC implementation

---

## Deliverables

1. ✅ All new files created
2. ✅ Module registration updated
3. ✅ API documentation updated
4. ✅ Testing checklist completed
5. ✅ Swagger annotations added
6. ✅ Git commit: "feat: add direct SMS sending REST endpoint"

---

## Common Mistakes to Avoid

❌ **DON'T:** Recreate Twilio client - use existing SmsSenderService
❌ **DON'T:** Duplicate queue logic - use existing BullMQ queue
❌ **DON'T:** Skip tenant_id validation on Lead lookup
❌ **DON'T:** Allow cross-tenant SMS sending
❌ **DON'T:** Guess communication_event field names - check schema
❌ **DON'T:** Skip opt-out check (if Sprint 1 deployed)

✅ **DO:** Review existing queue job structure
✅ **DO:** Use exact field names from Prisma schema
✅ **DO:** Test multi-tenant isolation thoroughly
✅ **DO:** Verify RBAC with different roles
✅ **DO:** Add comprehensive error handling
✅ **DO:** Log all SMS sending attempts

---

**END OF SPRINT 2**
