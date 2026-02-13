# Sprint 7: Webhook Retry Processor

**Priority:** 🟢 MEDIUM
**Estimated Effort:** 1-2 days
**Developer:** AI Developer #7
**Dependencies:** None (standalone improvement)
**Assigned Date:** February 13, 2026

---

## ⚠️ CRITICAL INSTRUCTIONS

**REVIEW FIRST:**
1. Study `webhook_event` table schema
2. Review existing webhook processing in twilio-webhooks.controller.ts
3. Understand BullMQ cron patterns
4. Check existing retry_count and next_retry_at fields
5. Review webhook verification service
6. **YOUR DOCUMENTATION**
   - MUST BE SAVED AT documentation/backend/sms_sprints/

**DO NOT:**
- Modify existing webhook handlers
- Change signature verification logic
- Break idempotency guarantees

---

## Objective

Automatically retry failed webhook processing with exponential backoff (1min, 5min, 15min, 1hr, give up).

## Requirements

### 1. Webhook Retry Service

**File:** `api/src/modules/communication/services/webhook-retry.service.ts` (NEW)

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class WebhookRetryService {
  private readonly logger = new Logger(WebhookRetryService.name);
  private readonly MAX_RETRIES = 5;
  private readonly RETRY_DELAYS = [
    60 * 1000,      // 1 minute
    5 * 60 * 1000,  // 5 minutes
    15 * 60 * 1000, // 15 minutes
    60 * 60 * 1000, // 1 hour
    24 * 60 * 60 * 1000, // 24 hours
  ];

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('webhook-retry') private readonly retryQueue: Queue,
  ) {}

  /**
   * Queue webhook for retry
   */
  async queueRetry(webhookEventId: string) {
    const event = await this.prisma.webhook_event.findUnique({
      where: { id: webhookEventId },
    });

    if (!event) {
      this.logger.warn(`Webhook event ${webhookEventId} not found`);
      return;
    }

    if (event.retry_count >= this.MAX_RETRIES) {
      this.logger.warn(
        `Webhook ${webhookEventId} exceeded max retries (${this.MAX_RETRIES})`,
      );
      await this.markAsFailed(webhookEventId);
      return;
    }

    const delayMs = this.RETRY_DELAYS[event.retry_count] || this.RETRY_DELAYS[this.MAX_RETRIES - 1];
    const nextRetryAt = new Date(Date.now() + delayMs);

    // Update webhook_event
    await this.prisma.webhook_event.update({
      where: { id: webhookEventId },
      data: {
        retry_count: event.retry_count + 1,
        next_retry_at: nextRetryAt,
      },
    });

    // Queue retry job
    await this.retryQueue.add(
      'retry-webhook',
      { webhookEventId },
      {
        delay: delayMs,
        jobId: `webhook-retry-${webhookEventId}-${event.retry_count + 1}`,
      },
    );

    this.logger.log(
      `Queued webhook ${webhookEventId} for retry ${event.retry_count + 1} in ${delayMs}ms`,
    );
  }

  /**
   * Process pending retries (cron job)
   */
  async processPendingRetries() {
    const now = new Date();
    const pendingRetries = await this.prisma.webhook_event.findMany({
      where: {
        processed: false,
        next_retry_at: { lte: now },
        retry_count: { lt: this.MAX_RETRIES },
      },
      take: 100,
    });

    this.logger.log(`Found ${pendingRetries.length} pending webhook retries`);

    for (const event of pendingRetries) {
      await this.queueRetry(event.id);
    }
  }

  private async markAsFailed(webhookEventId: string) {
    await this.prisma.webhook_event.update({
      where: { id: webhookEventId },
      data: {
        error_message: 'Max retries exceeded',
        processed: false,
      },
    });
  }
}
```

---

### 2. Webhook Retry Processor

**File:** `api/src/modules/communication/processors/webhook-retry.processor.ts` (NEW)

```typescript
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { WebhookRetryService } from '../services/webhook-retry.service';

@Processor('webhook-retry')
export class WebhookRetryProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookRetryProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly webhookRetry: WebhookRetryService,
  ) {
    super();
  }

  async process(job: Job) {
    const { webhookEventId } = job.data;

    this.logger.log(`Retrying webhook ${webhookEventId}`);

    try {
      const event = await this.prisma.webhook_event.findUnique({
        where: { id: webhookEventId },
        include: { provider: true },
      });

      if (!event) {
        this.logger.error(`Webhook event ${webhookEventId} not found`);
        return;
      }

      // Re-process webhook based on event_type
      await this.reprocessWebhook(event);

      // Mark as processed
      await this.prisma.webhook_event.update({
        where: { id: webhookEventId },
        data: {
          processed: true,
          processed_at: new Date(),
          error_message: null,
        },
      });

      this.logger.log(`Webhook ${webhookEventId} processed successfully`);
    } catch (error) {
      this.logger.error(
        `Webhook retry failed: ${error.message}`,
        error.stack,
      );

      // Queue next retry
      await this.webhookRetry.queueRetry(webhookEventId);
    }
  }

  private async reprocessWebhook(event: any) {
    // Re-execute webhook logic based on event_type
    // REVIEW: Existing webhook processing logic
    switch (event.event_type) {
      case 'sms.delivered':
      case 'sms.failed':
        await this.processSmsstatus(event);
        break;
      // Add other event types
    }
  }

  private async processSmsStatus(event: any) {
    // Find communication_event by provider_message_id
    const commEvent = await this.prisma.communication_event.findUnique({
      where: { provider_message_id: event.provider_message_id },
    });

    if (!commEvent) {
      this.logger.warn(`Communication event not found for ${event.provider_message_id}`);
      return;
    }

    // Update status
    const payload = event.payload as any;
    await this.prisma.communication_event.update({
      where: { id: commEvent.id },
      data: {
        status: payload.MessageStatus === 'delivered' ? 'delivered' : 'failed',
        delivered_at: payload.MessageStatus === 'delivered' ? new Date() : null,
        error_message: payload.ErrorMessage,
      },
    });
  }
}
```

---

### 3. Cron Job for Pending Retries

**File:** `api/src/modules/communication/cron/webhook-retry.cron.ts` (NEW)

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WebhookRetryService } from '../services/webhook-retry.service';

@Injectable()
export class WebhookRetryCron {
  private readonly logger = new Logger(WebhookRetryCron.name);

  constructor(private readonly webhookRetry: WebhookRetryService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async processPendingRetries() {
    this.logger.debug('Running webhook retry cron job');
    await this.webhookRetry.processPendingRetries();
  }
}
```

---

### 4. Module Registration

**File:** `api/src/modules/communication/communication.module.ts`

```typescript
import { BullModule } from '@nestjs/bullmq';
import { WebhookRetryService } from './services/webhook-retry.service';
import { WebhookRetryProcessor } from './processors/webhook-retry.processor';
import { WebhookRetryCron } from './cron/webhook-retry.cron';

@Module({
  imports: [
    // ... existing imports ...
    BullModule.registerQueue({
      name: 'webhook-retry',
    }),
  ],
  providers: [
    // ... existing providers ...
    WebhookRetryService,
    WebhookRetryProcessor,
    WebhookRetryCron,
  ],
})
```

---

## Testing

**Test 1: Failed Webhook**
- Simulate webhook processing failure
- Verify: webhook_event.retry_count incremented
- Verify: next_retry_at set to 1 minute in future
- Wait 1 minute, verify retry attempted

**Test 2: Max Retries**
- Simulate 5 failed retries
- Verify: No more retries queued
- Verify: error_message = "Max retries exceeded"

**Test 3: Cron Job**
- Create webhook_event with next_retry_at in past
- Run cron job
- Verify: Webhook retried

---

## Acceptance Criteria

- [ ] WebhookRetryService implemented
- [ ] WebhookRetryProcessor implemented
- [ ] Cron job scheduled
- [ ] Exponential backoff works
- [ ] Max retries enforced
- [ ] All tests pass

---

**END OF SPRINT 7**
