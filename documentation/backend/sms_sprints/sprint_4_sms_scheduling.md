# Sprint 4: SMS Scheduling

**Priority:** 🟡 HIGH
**Estimated Effort:** 1-2 days
**Developer:** AI Developer #4
**Dependencies:** Sprint 2 (SMS sending endpoint)
**Assigned Date:** February 13, 2026

---

## ⚠️ CRITICAL INSTRUCTIONS

**REVIEW FIRST:**
1. Study `communication_event` table schema
2. Review BullMQ delayed job patterns
3. Check existing queue processor logic
4. Understand multi-tenant isolation
5. Review RBAC patterns
6. **YOUR DOCUMENTATION**
   - MUST BE SAVED AT documentation/backend/sms_sprints/

**DO NOT:**
- Recreate queue logic
- Modify existing SMS sending
- Break existing immediate sending
- Change communication_event structure

---

## Objective

Add ability to schedule SMS for future delivery (e.g., send quote follow-up in 3 days, appointment reminder 24 hours before).

## Requirements

### 1. Database Schema Change

```prisma
model communication_event {
  // ... existing fields ...
  
  // NEW FIELDS:
  scheduled_at       DateTime?  // When to send
  scheduled_by       String?    @db.Char(36)  // User who scheduled
  
  // ... rest of fields ...
}
```

**Migration:**
```bash
npx prisma migrate dev --name add_scheduled_at_to_communication_event
```

---

### 2. Update SendSmsDto

**File:** `api/src/modules/communication/dto/sms/send-sms.dto.ts`

```typescript
@IsOptional()
@IsDateString()
scheduled_at?: string;  // ISO 8601 format
```

---

### 3. Update SmsSendingService

**File:** `api/src/modules/communication/services/sms-sending.service.ts`

**Modify `sendSms()` method:**

```typescript
async sendSms(tenantId: string, userId: string, dto: SendSmsDto) {
  // ... existing validation ...

  // Parse scheduled_at if provided
  let scheduledAt: Date | null = null;
  if (dto.scheduled_at) {
    scheduledAt = new Date(dto.scheduled_at);
    
    // Validate not in past
    if (scheduledAt <= new Date()) {
      throw new BadRequestException('scheduled_at must be in the future');
    }
    
    // Optional: Validate not too far in future (e.g., max 90 days)
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 90);
    if (scheduledAt > maxDate) {
      throw new BadRequestException('scheduled_at cannot be more than 90 days in future');
    }
  }

  // Create communication_event with scheduled_at
  const communicationEvent = await this.prisma.communication_event.create({
    data: {
      // ... existing fields ...
      scheduled_at: scheduledAt,
      scheduled_by: scheduledAt ? userId : null,
      status: scheduledAt ? 'scheduled' : 'pending',  // New status
    },
  });

  // Queue SMS job with delay
  const delay = scheduledAt 
    ? scheduledAt.getTime() - Date.now() 
    : 0;

  const job = await this.smsQueue.add(
    'send-sms',
    {
      communicationEventId: communicationEvent.id,
      tenantId,
      // ... rest of job data ...
    },
    {
      delay,  // BullMQ delay in milliseconds
      jobId: `sms-${communicationEvent.id}`,  // For tracking
    },
  );

  return {
    // ... existing response ...
    scheduled_at: scheduledAt?.toISOString(),
  };
}
```

---

### 4. Update Processor to Handle Scheduled SMS

**File:** `api/src/modules/communication/processors/send-sms.processor.ts`

**In the processor method:**

```typescript
async process(job: Job) {
  const { communicationEventId, tenantId } = job.data;

  // Fetch communication_event
  const event = await this.prisma.communication_event.findUnique({
    where: { id: communicationEventId },
  });

  if (!event) {
    throw new Error('Communication event not found');
  }

  // If scheduled, check if time has arrived
  if (event.scheduled_at) {
    const now = new Date();
    if (event.scheduled_at > now) {
      // Not time yet - requeue with remaining delay
      const remainingDelay = event.scheduled_at.getTime() - now.getTime();
      throw new Error(`SMS not ready - scheduled for ${event.scheduled_at}`);
      // BullMQ will retry based on retry settings
    }
  }

  // Continue with existing sending logic...
}
```

---

### 5. Cancel Scheduled SMS Endpoint

**File:** `api/src/modules/communication/controllers/sms.controller.ts`

```typescript
@Delete('scheduled/:id/cancel')
@Roles('Owner', 'Admin', 'Manager', 'Sales')
async cancelScheduledSms(
  @Req() req: any,
  @Param('id') communicationEventId: string,
) {
  const tenantId = req.user.tenant_id;

  // Find event
  const event = await this.prisma.communication_event.findFirst({
    where: {
      id: communicationEventId,
      tenant_id: tenantId,
      status: 'scheduled',
    },
  });

  if (!event) {
    throw new NotFoundException('Scheduled SMS not found');
  }

  // Remove from queue
  const jobId = `sms-${communicationEventId}`;
  const job = await this.smsQueue.getJob(jobId);
  if (job) {
    await job.remove();
  }

  // Update event status
  await this.prisma.communication_event.update({
    where: { id: communicationEventId },
    data: { status: 'cancelled' },
  });

  return { success: true, message: 'Scheduled SMS cancelled' };
}
```

---

### 6. List Scheduled SMS Endpoint

```typescript
@Get('scheduled')
@Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
async getScheduledSms(
  @Req() req: any,
  @Query('page') page: number = 1,
  @Query('limit') limit: number = 20,
) {
  const tenantId = req.user.tenant_id;
  const skip = (page - 1) * limit;
  const take = Math.min(limit, 100);

  const [events, total] = await Promise.all([
    this.prisma.communication_event.findMany({
      where: {
        tenant_id: tenantId,
        channel: 'sms',
        status: 'scheduled',
      },
      orderBy: { scheduled_at: 'asc' },
      skip,
      take,
    }),
    this.prisma.communication_event.count({
      where: {
        tenant_id: tenantId,
        channel: 'sms',
        status: 'scheduled',
      },
    }),
  ]);

  return { data: events, meta: { total, page, limit: take } };
}
```

---

## Testing

**Test 1: Schedule SMS**
```json
POST /communication/sms/send
{
  "lead_id": "uuid",
  "text_body": "Reminder: Your appointment is tomorrow!",
  "scheduled_at": "2026-02-14T09:00:00Z"
}
```
- Verify: Event created with status='scheduled'
- Verify: Job queued with delay
- Wait for scheduled time, verify SMS sent

**Test 2: Schedule in Past (Error)**
```json
{
  "scheduled_at": "2025-01-01T00:00:00Z"
}
```
- Expected: 400 Bad Request

**Test 3: Cancel Scheduled SMS**
- Schedule SMS for 1 hour from now
- Call DELETE /scheduled/:id/cancel
- Verify: Status = 'cancelled', job removed

**Test 4: List Scheduled SMS**
- Create 3 scheduled SMS
- Call GET /scheduled
- Verify: Only scheduled SMS returned

---

## Acceptance Criteria

- [ ] Database migration created
- [ ] SendSmsDto updated with scheduled_at
- [ ] SmsSendingService supports scheduling
- [ ] BullMQ jobs delayed correctly
- [ ] Cancel scheduled SMS works
- [ ] List scheduled SMS works
- [ ] Multi-tenant isolation verified
- [ ] All tests pass
- [ ] API documentation updated

---

**END OF SPRINT 4**
