# Sprint 5: Bulk SMS Operations

**Priority:** 🟢 MEDIUM
**Estimated Effort:** 2-3 days
**Developer:** AI Developer #5
**Dependencies:** Sprint 2 (SMS sending endpoint)
**Assigned Date:** February 13, 2026

---

## ⚠️ CRITICAL INSTRUCTIONS

**REVIEW FIRST:**
1. Study Sprint 2 SMS sending implementation
2. Review BullMQ bulk job patterns
3. Check opt-out management (Sprint 1)
4. Understand rate limiting best practices
5. Review existing bulk operations in codebase
6. **YOUR DOCUMENTATION**
   - MUST BE SAVED AT documentation/backend/sms_sprints/

**DO NOT:**
- Create synchronous bulk sending (must be async)
- Skip opt-out checks
- Send without rate limiting
- Ignore Twilio rate limits (10 SMS/second)

---

## Objective

Enable sending SMS to multiple Leads at once (e.g., quote reminders to 50 Leads, announcement to all Leads in a region).

## Requirements

### 1. Bulk SMS DTO

**File:** `api/src/modules/communication/dto/sms/bulk-send-sms.dto.ts` (NEW)

```typescript
import { IsNotEmpty, IsArray, IsString, IsOptional, IsUUID, MaxLength, ArrayMaxSize, ArrayMinSize } from 'class-validator';

export class BulkSendSmsDto {
  @IsNotEmpty()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)  // Limit to 500 Leads per bulk operation
  @IsUUID('4', { each: true })
  lead_ids: string[];

  @IsNotEmpty()
  @IsString()
  @MaxLength(1600)
  text_body: string;

  @IsOptional()
  @IsUUID('4')
  template_id?: string;  // From Sprint 3

  @IsOptional()
  @IsString()
  related_entity_type?: string;

  @IsOptional()
  @IsUUID('4')
  related_entity_id?: string;

  @IsOptional()
  rate_limit_per_second?: number;  // Default: 5/second
}
```

---

### 2. Bulk SMS Service

**File:** `api/src/modules/communication/services/bulk-sms.service.ts` (NEW)

```typescript
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';
import { BulkSendSmsDto } from '../dto/sms/bulk-send-sms.dto';
import { TemplateMergeService } from './template-merge.service';

@Injectable()
export class BulkSmsService {
  private readonly logger = new Logger(BulkSmsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('communication-sms') private readonly smsQueue: Queue,
    private readonly templateMerge: TemplateMergeService,
  ) {}

  /**
   * Queue bulk SMS sending
   * 
   * CRITICAL: 
   * - Filter out opted-out Leads
   * - Validate all Leads belong to tenant
   * - Rate limit to avoid Twilio throttling
   * - Return job tracking info
   */
  async queueBulkSms(
    tenantId: string,
    userId: string,
    dto: BulkSendSmsDto,
  ) {
    // Step 1: Validate tenant has active SMS config
    const smsConfig = await this.prisma.tenant_sms_config.findFirst({
      where: { tenant_id: tenantId, is_active: true, is_verified: true },
    });

    if (!smsConfig) {
      throw new BadRequestException('No active SMS configuration');
    }

    // Step 2: Load all Leads with opt-out status
    // CRITICAL: Multi-tenant isolation + opt-out filtering
    const leads = await this.prisma.lead.findMany({
      where: {
        id: { in: dto.lead_ids },
        tenant_id: tenantId,  // MANDATORY
      },
      select: {
        id: true,
        phone: true,
        first_name: true,
        last_name: true,
        email: true,
        address: true,
        sms_opt_out: true,
      },
    });

    // Step 3: Filter out opted-out and phoneless Leads
    const validLeads = leads.filter(
      (lead) => !lead.sms_opt_out && lead.phone,
    );

    const skippedLeads = leads.length - validLeads.length;

    this.logger.log(
      `Bulk SMS: ${validLeads.length} valid, ${skippedLeads} skipped (opted-out or no phone)`,
    );

    if (validLeads.length === 0) {
      throw new BadRequestException('No valid recipients (all opted out or missing phone)');
    }

    // Step 4: Load template if provided
    let templateBody = dto.text_body;
    if (dto.template_id) {
      const template = await this.prisma.sms_template.findFirst({
        where: {
          id: dto.template_id,
          tenant_id: tenantId,
          is_active: true,
        },
      });

      if (!template) {
        throw new BadRequestException('Template not found');
      }

      templateBody = template.template_body;
    }

    // Step 5: Load tenant and user data for merge
    const [tenant, user] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { company_name: true, phone: true, address: true },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { first_name: true, last_name: true, phone: true, email: true },
      }),
    ]);

    // Step 6: Create communication_event records and queue jobs
    const jobs = [];
    const communicationEventIds = [];
    const rateLimit = dto.rate_limit_per_second || 5;  // Default 5/sec
    let delayMs = 0;

    for (const lead of validLeads) {
      // Merge template with Lead data
      const mergedBody = await this.templateMerge.mergeTemplate(templateBody, {
        lead,
        tenant,
        user,
      });

      // Create communication_event
      const event = await this.prisma.communication_event.create({
        data: {
          tenant_id: tenantId,
          channel: 'sms',
          direction: 'outbound',
          to_phone: lead.phone,
          from_phone: smsConfig.from_phone,
          text_body: mergedBody,
          status: 'pending',
          related_entity_type: dto.related_entity_type,
          related_entity_id: dto.related_entity_id,
          created_by: userId,
        },
      });

      communicationEventIds.push(event.id);

      // Queue job with delay (rate limiting)
      const job = await this.smsQueue.add(
        'send-sms',
        {
          communicationEventId: event.id,
          tenantId,
          toPhone: lead.phone,
          textBody: mergedBody,
        },
        {
          delay: delayMs,
          jobId: `bulk-sms-${event.id}`,
        },
      );

      jobs.push(job.id);

      // Increment delay for rate limiting
      delayMs += Math.floor(1000 / rateLimit);
    }

    this.logger.log(
      `Queued ${jobs.length} bulk SMS jobs for tenant ${tenantId}`,
    );

    return {
      queued_count: jobs.length,
      skipped_count: skippedLeads,
      job_ids: jobs,
      communication_event_ids: communicationEventIds,
      estimated_completion_seconds: Math.ceil(delayMs / 1000),
    };
  }

  /**
   * Get bulk SMS status
   */
  async getBulkSmsStatus(tenantId: string, communicationEventIds: string[]) {
    const events = await this.prisma.communication_event.findMany({
      where: {
        id: { in: communicationEventIds },
        tenant_id: tenantId,
      },
      select: {
        id: true,
        to_phone: true,
        status: true,
        sent_at: true,
        delivered_at: true,
        error_message: true,
      },
    });

    const summary = {
      total: events.length,
      pending: events.filter((e) => e.status === 'pending').length,
      sent: events.filter((e) => e.status === 'sent').length,
      delivered: events.filter((e) => e.status === 'delivered').length,
      failed: events.filter((e) => e.status === 'failed').length,
    };

    return { summary, events };
  }
}
```

---

### 3. Bulk SMS Controller

**File:** `api/src/modules/communication/controllers/sms.controller.ts`

**Add endpoints:**

```typescript
@Post('bulk-send')
@Roles('Owner', 'Admin', 'Manager')  // More restrictive than single send
async bulkSendSms(
  @Req() req: any,
  @Body() dto: BulkSendSmsDto,
) {
  const tenantId = req.user.tenant_id;
  const userId = req.user.id;

  this.logger.log(
    `User ${userId} initiating bulk SMS to ${dto.lead_ids.length} Leads`,
  );

  return await this.bulkSmsService.queueBulkSms(tenantId, userId, dto);
}

@Get('bulk-status')
@Roles('Owner', 'Admin', 'Manager', 'Sales')
async getBulkSmsStatus(
  @Req() req: any,
  @Query('event_ids') eventIds: string,  // Comma-separated
) {
  const tenantId = req.user.tenant_id;
  const eventIdArray = eventIds.split(',');

  return await this.bulkSmsService.getBulkSmsStatus(tenantId, eventIdArray);
}
```

---

## Testing

**Test 1: Bulk Send to 10 Leads**
```json
POST /communication/sms/bulk-send
{
  "lead_ids": ["uuid1", "uuid2", ... "uuid10"],
  "text_body": "Your quote is ready!",
  "rate_limit_per_second": 5
}
```
- Verify: 10 events created
- Verify: Jobs delayed appropriately (0ms, 200ms, 400ms, ...)
- Verify: All SMS delivered

**Test 2: Skip Opted-Out Leads**
- Create 5 Leads, opt-out 2
- Bulk send to all 5
- Verify: Only 3 SMS queued, skipped_count=2

**Test 3: Multi-Tenant Isolation**
- Provide lead_ids from different tenant
- Verify: Only own tenant's Leads processed

**Test 4: Rate Limiting**
- Bulk send to 50 Leads with rate_limit_per_second=10
- Verify: Jobs spread over 5 seconds

**Test 5: Bulk Status Tracking**
- After bulk send, call GET /bulk-status
- Verify: Summary shows pending/sent/delivered counts

**Test 6: Max Limit (500)**
- Try to bulk send to 501 Leads
- Expected: 400 Bad Request (validation error)

---

## Acceptance Criteria

- [ ] BulkSendSmsDto created
- [ ] BulkSmsService implemented
- [ ] Rate limiting enforced
- [ ] Opt-out filtering works
- [ ] Multi-tenant isolation verified
- [ ] Status tracking works
- [ ] RBAC enforced (Owner/Admin/Manager only)
- [ ] All tests pass
- [ ] API documentation updated

---

**END OF SPRINT 5**
