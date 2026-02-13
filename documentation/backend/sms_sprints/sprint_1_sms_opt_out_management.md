# Sprint 1: SMS Opt-Out Management (TCPA Compliance)

**Priority:** 🔴 CRITICAL
**Estimated Effort:** 2-3 days
**Developer:** AI Developer #1
**Dependencies:** None
**Assigned Date:** February 13, 2026

---

## ⚠️ CRITICAL INSTRUCTIONS - READ CAREFULLY

### Before You Write ANY Code:

1. **REVIEW THE ENTIRE CODEBASE FIRST**
   - Read ALL existing communication module files
   - Understand the current SMS flow (inbound/outbound)
   - Review existing database schema in `prisma/schema.prisma`
   - Study existing DTOs, services, and controllers
   - Understand the multi-tenant architecture
   - Review RBAC implementation patterns

2. **DO NOT BREAK EXISTING FUNCTIONALITY**
   - This is a production system with A+ (98/100) code quality
   - All existing tests MUST continue to pass
   - DO NOT modify existing endpoints without explicit instruction
   - DO NOT change existing database fields
   - DO NOT alter existing RBAC rules

3. **USE EXISTING PATTERNS AND CONVENTIONS**
   - Follow the exact same code style as existing files
   - Use the same dependency injection patterns
   - Follow the same error handling patterns
   - Use the same validation patterns (class-validator decorators)
   - Follow the same logging patterns

4. **DO NOT GUESS PROPERTY NAMES OR VARIABLE NAMES**
   - Review existing `lead` table schema carefully
   - Review existing `communication_event` table schema carefully
   - Use EXACT property names from Prisma models
   - Check existing services for property access patterns
   - Review existing DTOs for naming conventions

5. **MULTI-TENANT ISOLATION IS MANDATORY**
   - Every query MUST include `tenant_id` filter
   - Use the tenant from JWT token (`req.user.tenant_id`)
   - Never expose data across tenants
   - Test with multiple tenant IDs

6. **FOLLOW RBAC RULES**
   - Check existing RBAC guards in other controllers
   - Use the same role names: `Owner`, `Admin`, `Manager`, `Sales`, `Employee`
   - Protect configuration endpoints to Owner/Admin only
   - Allow read access to appropriate roles

---

## Sprint Objective

Implement SMS opt-out/unsubscribe management to ensure TCPA compliance and prevent sending SMS to users who have opted out.

### Why This Is Critical

**Legal Compliance:** Under TCPA (Telephone Consumer Protection Act), businesses MUST:
- Honor opt-out requests within 24 hours
- Provide clear opt-out mechanism (STOP keyword)
- Maintain opt-out list
- Block SMS to opted-out numbers

**Failure to comply:** Fines up to $1,500 per violation

---

## Requirements

### 1. Database Schema Changes

**Add fields to `lead` table:**

```prisma
// In prisma/schema.prisma

model lead {
  // ... existing fields ...

  // SMS Opt-Out Management (NEW FIELDS)
  sms_opt_out         Boolean   @default(false)
  sms_opt_out_at      DateTime?
  sms_opt_in_at       DateTime? // For re-subscription
  sms_opt_out_reason  String?   @db.VarChar(255) // Optional reason

  // ... rest of existing fields ...
}
```

**Migration file:** Create new migration via Prisma

```bash
npx prisma migrate dev --name add_sms_opt_out_to_lead
```

---

### 2. Keyword Detection Service

**File:** `api/src/modules/communication/services/sms-keyword-detection.service.ts`

**Purpose:** Detect STOP/START/HELP keywords in inbound SMS

**Required Keywords:**
- **STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT** → Opt-out
- **START, UNSTOP, YES** → Opt-in (re-subscribe)
- **HELP, INFO** → Auto-reply with help text

**Implementation:**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

export enum SmsKeywordAction {
  OPT_OUT = 'opt_out',
  OPT_IN = 'opt_in',
  HELP = 'help',
  NONE = 'none',
}

export interface KeywordDetectionResult {
  action: SmsKeywordAction;
  keyword: string | null;
  autoReplyMessage: string | null;
}

@Injectable()
export class SmsKeywordDetectionService {
  private readonly logger = new Logger(SmsKeywordDetectionService.name);

  // IMPORTANT: Review existing patterns for static data
  private readonly OPT_OUT_KEYWORDS = [
    'STOP',
    'STOPALL',
    'UNSUBSCRIBE',
    'CANCEL',
    'END',
    'QUIT',
  ];

  private readonly OPT_IN_KEYWORDS = ['START', 'UNSTOP', 'YES'];

  private readonly HELP_KEYWORDS = ['HELP', 'INFO'];

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Detect keyword in SMS message body
   * IMPORTANT: Review existing SMS inbound flow to understand context
   */
  detectKeyword(messageBody: string): KeywordDetectionResult {
    const trimmed = messageBody.trim().toUpperCase();

    // Check opt-out keywords
    if (this.OPT_OUT_KEYWORDS.includes(trimmed)) {
      return {
        action: SmsKeywordAction.OPT_OUT,
        keyword: trimmed,
        autoReplyMessage:
          "You've been unsubscribed from SMS messages. Reply START to resume.",
      };
    }

    // Check opt-in keywords
    if (this.OPT_IN_KEYWORDS.includes(trimmed)) {
      return {
        action: SmsKeywordAction.OPT_IN,
        keyword: trimmed,
        autoReplyMessage:
          "You've been re-subscribed to SMS messages. Reply STOP to unsubscribe.",
      };
    }

    // Check help keywords
    if (this.HELP_KEYWORDS.includes(trimmed)) {
      return {
        action: SmsKeywordAction.HELP,
        keyword: trimmed,
        autoReplyMessage:
          'Reply STOP to unsubscribe, START to resume messages.',
      };
    }

    return {
      action: SmsKeywordAction.NONE,
      keyword: null,
      autoReplyMessage: null,
    };
  }

  /**
   * Process opt-out for a Lead
   * IMPORTANT: Review Lead table schema - use EXACT field names from Prisma
   */
  async processOptOut(
    tenantId: string,
    leadId: string,
    reason?: string,
  ): Promise<void> {
    // CRITICAL: Review existing Lead update patterns in codebase
    // Use the EXACT field names from prisma/schema.prisma
    await this.prisma.lead.update({
      where: {
        id: leadId,
        tenant_id: tenantId, // Multi-tenant isolation MANDATORY
      },
      data: {
        sms_opt_out: true,
        sms_opt_out_at: new Date(),
        sms_opt_out_reason: reason,
        sms_opt_in_at: null, // Clear previous opt-in
      },
    });

    this.logger.log(
      `Lead ${leadId} opted out of SMS for tenant ${tenantId}. Reason: ${reason || 'User requested'}`,
    );
  }

  /**
   * Process opt-in (re-subscription) for a Lead
   */
  async processOptIn(tenantId: string, leadId: string): Promise<void> {
    await this.prisma.lead.update({
      where: {
        id: leadId,
        tenant_id: tenantId,
      },
      data: {
        sms_opt_out: false,
        sms_opt_in_at: new Date(),
        sms_opt_out_reason: null, // Clear reason
      },
    });

    this.logger.log(`Lead ${leadId} opted back in to SMS for tenant ${tenantId}`);
  }

  /**
   * Check if Lead has opted out
   * IMPORTANT: This will be used by SMS sending service
   */
  async isOptedOut(tenantId: string, leadId: string): Promise<boolean> {
    const lead = await this.prisma.lead.findUnique({
      where: {
        id: leadId,
        tenant_id: tenantId,
      },
      select: {
        sms_opt_out: true,
      },
    });

    return lead?.sms_opt_out || false;
  }
}
```

---

### 3. Modify Inbound SMS Webhook Handler

**File:** `api/src/modules/communication/controllers/twilio-webhooks.controller.ts`

**CRITICAL: DO NOT REWRITE THIS FILE - ONLY ADD KEYWORD DETECTION**

**Locate the inbound SMS handler method (something like `handleSmsInbound`):**

```typescript
// EXISTING METHOD - REVIEW CAREFULLY
async handleSmsInbound(@Body() body: any, @Req() req: Request) {
  // ... existing code ...

  // ADD THIS SECTION AFTER LEAD MATCHING/CREATION:

  // Step: Detect SMS keywords (opt-out/opt-in/help)
  const keywordResult = this.smsKeywordDetection.detectKeyword(body.Body);

  if (keywordResult.action !== SmsKeywordAction.NONE) {
    this.logger.log(
      `Keyword detected: ${keywordResult.keyword} (action: ${keywordResult.action})`,
    );

    // Process action
    if (keywordResult.action === SmsKeywordAction.OPT_OUT) {
      await this.smsKeywordDetection.processOptOut(
        tenantId,
        lead.id,
        `User sent: ${keywordResult.keyword}`,
      );
    } else if (keywordResult.action === SmsKeywordAction.OPT_IN) {
      await this.smsKeywordDetection.processOptIn(tenantId, lead.id);
    }

    // Send auto-reply if configured
    if (keywordResult.autoReplyMessage) {
      // IMPORTANT: Review existing SMS sending pattern in codebase
      // Use the EXACT same pattern to send auto-reply
      await this.sendAutoReplySms(
        tenantId,
        body.From,
        keywordResult.autoReplyMessage,
      );
    }
  }

  // ... rest of existing code ...
}
```

**Add auto-reply helper method:**

```typescript
private async sendAutoReplySms(
  tenantId: string,
  toPhone: string,
  message: string,
): Promise<void> {
  // CRITICAL: Review existing SMS sending flow
  // Use existing SmsSenderService - DO NOT create new sending logic
  // Queue the SMS via BullMQ (review existing queue pattern)

  // Example (REVIEW ACTUAL IMPLEMENTATION):
  // await this.smsQueue.add('send-sms', {
  //   tenantId,
  //   to_phone: toPhone,
  //   text_body: message,
  //   direction: 'outbound',
  //   channel: 'sms',
  //   is_auto_reply: true,
  // });
}
```

---

### 4. Modify SMS Sending Service to Block Opted-Out Leads

**File:** `api/src/modules/communication/services/sms-sender.service.ts` OR wherever SMS sending is triggered

**CRITICAL: REVIEW THE EXISTING SENDING FLOW CAREFULLY**

**Before sending SMS, add opt-out check:**

```typescript
// FIND THE METHOD THAT SENDS SMS (e.g., `send()` or in the queue processor)

async send(
  provider: Provider,
  encryptedCredentials: any,
  sms: SmsPayload,
): Promise<SmsSendResult> {

  // ADD OPT-OUT CHECK HERE (BEFORE TWILIO API CALL):

  // If this SMS is related to a Lead, check opt-out status
  if (sms.lead_id && sms.tenant_id) {
    const isOptedOut = await this.smsKeywordDetection.isOptedOut(
      sms.tenant_id,
      sms.lead_id,
    );

    if (isOptedOut) {
      this.logger.warn(
        `Blocked SMS to Lead ${sms.lead_id} - user has opted out`,
      );
      throw new BadRequestException(
        'Cannot send SMS: recipient has opted out (replied STOP)',
      );
    }
  }

  // ... existing sending logic ...
}
```

**IMPORTANT:** Review if `SmsPayload` interface already has `lead_id` and `tenant_id`. If not, you may need to pass them from the caller.

---

### 5. Admin Opt-Out Management Endpoints

**File:** `api/src/modules/communication/controllers/admin/sms-opt-out-admin.controller.ts` (NEW FILE)

**Purpose:** Allow System Admin to view and manage opt-outs across tenants

```typescript
import {
  Controller,
  Get,
  Query,
  Param,
  Patch,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../../../core/auth/roles.guard';
import { Roles } from '../../../../core/auth/roles.decorator';
import { PrismaService } from '../../../../core/database/prisma.service';
import { SmsKeywordDetectionService } from '../../services/sms-keyword-detection.service';

/**
 * Admin SMS Opt-Out Management
 *
 * CRITICAL: This is ADMIN-ONLY (SystemAdmin role)
 * REVIEW existing admin controllers for exact patterns
 */
@Controller('admin/communication/sms/opt-outs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SystemAdmin')
export class SmsOptOutAdminController {
  private readonly logger = new Logger(SmsOptOutAdminController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly smsKeywordDetection: SmsKeywordDetectionService,
  ) {}

  /**
   * Get all opted-out Leads (cross-tenant)
   *
   * IMPORTANT: Review existing admin endpoints for pagination patterns
   */
  @Get()
  async getOptedOutLeads(
    @Query('tenant_id') tenantId?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    const skip = (page - 1) * limit;
    const take = Math.min(limit, 100); // Max 100 per page

    const where: any = {
      sms_opt_out: true,
    };

    // Filter by tenant if provided
    if (tenantId) {
      where.tenant_id = tenantId;
    }

    const [leads, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        select: {
          id: true,
          tenant_id: true,
          first_name: true,
          last_name: true,
          phone: true,
          sms_opt_out: true,
          sms_opt_out_at: true,
          sms_opt_out_reason: true,
          sms_opt_in_at: true,
          tenant: {
            select: {
              company_name: true,
            },
          },
        },
        orderBy: {
          sms_opt_out_at: 'desc',
        },
        skip,
        take,
      }),
      this.prisma.lead.count({ where }),
    ]);

    return {
      data: leads,
      meta: {
        total,
        page,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  /**
   * Manually opt-in a Lead (override opt-out)
   *
   * USE CASE: Admin resolves customer complaint, re-enables SMS
   */
  @Patch(':leadId/opt-in')
  async manualOptIn(
    @Param('leadId') leadId: string,
    @Query('tenant_id') tenantId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('tenant_id query parameter is required');
    }

    await this.smsKeywordDetection.processOptIn(tenantId, leadId);

    this.logger.log(
      `Admin manually opted in Lead ${leadId} for tenant ${tenantId}`,
    );

    return {
      success: true,
      message: 'Lead opted back in to SMS',
    };
  }
}
```

---

### 6. Tenant Opt-Out Viewing Endpoint

**File:** `api/src/modules/communication/controllers/sms-opt-out.controller.ts` (NEW FILE)

**Purpose:** Allow tenants to view their own opted-out Leads

```typescript
import {
  Controller,
  Get,
  Query,
  UseGuards,
  Req,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../../core/auth/roles.guard';
import { Roles } from '../../../core/auth/roles.decorator';
import { PrismaService } from '../../../core/database/prisma.service';

/**
 * Tenant SMS Opt-Out Viewing
 *
 * RBAC: All roles can view opted-out Leads within their tenant
 * CRITICAL: Multi-tenant isolation via req.user.tenant_id
 */
@Controller('communication/sms/opt-outs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
export class SmsOptOutController {
  private readonly logger = new Logger(SmsOptOutController.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get opted-out Leads for current tenant
   *
   * IMPORTANT: Filter by req.user.tenant_id - NEVER allow cross-tenant access
   */
  @Get()
  async getOptedOutLeads(
    @Req() req: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    const tenantId = req.user.tenant_id; // CRITICAL: Use tenant from JWT
    const skip = (page - 1) * limit;
    const take = Math.min(limit, 100);

    const where = {
      tenant_id: tenantId, // Multi-tenant isolation
      sms_opt_out: true,
    };

    const [leads, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        select: {
          id: true,
          first_name: true,
          last_name: true,
          phone: true,
          sms_opt_out: true,
          sms_opt_out_at: true,
          sms_opt_out_reason: true,
        },
        orderBy: {
          sms_opt_out_at: 'desc',
        },
        skip,
        take,
      }),
      this.prisma.lead.count({ where }),
    ]);

    return {
      data: leads,
      meta: {
        total,
        page,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    };
  }
}
```

---

### 7. Module Registration

**File:** `api/src/modules/communication/communication.module.ts`

**Add new services and controllers:**

```typescript
import { SmsKeywordDetectionService } from './services/sms-keyword-detection.service';
import { SmsOptOutController } from './controllers/sms-opt-out.controller';
import { SmsOptOutAdminController } from './controllers/admin/sms-opt-out-admin.controller';

@Module({
  // ... existing imports ...

  providers: [
    // ... existing providers ...
    SmsKeywordDetectionService, // ADD THIS
  ],

  controllers: [
    // ... existing controllers ...
    SmsOptOutController, // ADD THIS
    SmsOptOutAdminController, // ADD THIS
  ],

  // ... rest of module config ...
})
```

---

## Testing Requirements

### Manual Testing Checklist

**Test 1: Opt-Out via STOP Keyword**
1. Send SMS from external phone to tenant's Twilio number
2. Message body: "STOP"
3. Verify:
   - Lead record updated: `sms_opt_out = true`, `sms_opt_out_at` populated
   - Auto-reply received: "You've been unsubscribed..."
   - Future SMS to this Lead are blocked

**Test 2: Opt-In via START Keyword**
1. Send SMS with "START" after opting out
2. Verify:
   - Lead record updated: `sms_opt_out = false`, `sms_opt_in_at` populated
   - Auto-reply received: "You've been re-subscribed..."
   - SMS sending works again

**Test 3: HELP Keyword**
1. Send SMS with "HELP"
2. Verify auto-reply with instructions

**Test 4: Multi-Tenant Isolation**
1. Create two tenants with same phone number (different Leads)
2. Opt-out in Tenant A
3. Verify SMS still works for Tenant B

**Test 5: Admin Endpoints**
1. Login as SystemAdmin
2. Call `GET /admin/communication/sms/opt-outs`
3. Verify cross-tenant visibility
4. Manually opt-in a Lead
5. Verify Lead can receive SMS again

**Test 6: Tenant Endpoints**
1. Login as Tenant Owner/Admin
2. Call `GET /communication/sms/opt-outs`
3. Verify only own tenant's opt-outs visible

---

## API Documentation to Update

**File:** `api/documentation/communication_twillio_REST_API.md`

Add new sections:

### SMS Opt-Out Endpoints

#### GET /communication/sms/opt-outs
Get opted-out Leads for current tenant

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "first_name": "John",
      "last_name": "Doe",
      "phone": "+12025551234",
      "sms_opt_out": true,
      "sms_opt_out_at": "2026-02-13T10:30:00Z",
      "sms_opt_out_reason": "User sent: STOP"
    }
  ],
  "meta": {
    "total": 5,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

## Acceptance Criteria

- [ ] Database migration created and applied
- [ ] Keyword detection service implemented
- [ ] Inbound SMS webhook updated to detect keywords
- [ ] SMS sending service blocks opted-out Leads
- [ ] Admin endpoints implemented (cross-tenant opt-out viewing)
- [ ] Tenant endpoints implemented (own opt-out viewing)
- [ ] Auto-reply messages sent for STOP/START/HELP
- [ ] All manual tests pass
- [ ] Multi-tenant isolation verified
- [ ] RBAC rules enforced
- [ ] API documentation updated
- [ ] All existing tests still pass (NO BREAKING CHANGES)

---

## Files to Review Before Starting

**MANDATORY - Read these files first:**

1. `api/prisma/schema.prisma` - Understand Lead model
2. `api/src/modules/communication/controllers/twilio-webhooks.controller.ts` - Inbound SMS flow
3. `api/src/modules/communication/services/sms-sender.service.ts` - SMS sending
4. `api/src/modules/communication/processors/send-sms.processor.ts` - Queue processor
5. `api/src/modules/communication/controllers/admin/twilio-admin.controller.ts` - Admin patterns
6. `api/src/modules/communication/dto/` - DTO patterns
7. `api/src/core/auth/roles.guard.ts` - RBAC implementation

---

## Deliverables

1. ✅ All new files created
2. ✅ Existing files modified (marked with comments)
3. ✅ Database migration file
4. ✅ Updated API documentation
5. ✅ Testing checklist completed
6. ✅ Git commit with message: "feat: implement SMS opt-out management (TCPA compliance)"

---

## Common Mistakes to Avoid

❌ **DON'T:** Create new SMS sending logic - use existing
❌ **DON'T:** Guess property names - review Prisma schema
❌ **DON'T:** Skip tenant_id filtering - ALWAYS enforce multi-tenant
❌ **DON'T:** Hardcode role names - use existing patterns
❌ **DON'T:** Modify existing endpoints without reviewing
❌ **DON'T:** Skip testing with multiple tenants

✅ **DO:** Review existing code thoroughly first
✅ **DO:** Follow existing patterns exactly
✅ **DO:** Test with multiple tenants
✅ **DO:** Verify all existing tests pass
✅ **DO:** Use exact field names from Prisma
✅ **DO:** Add comprehensive logging

---

**END OF SPRINT 1**
