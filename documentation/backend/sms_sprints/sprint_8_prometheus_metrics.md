# Sprint 8: Prometheus Metrics

**Priority:** 🔵 LOW
**Estimated Effort:** 4-6 hours
**Developer:** AI Developer #8
**Dependencies:** None
**Assigned Date:** February 13, 2026

---

## ⚠️ CRITICAL INSTRUCTIONS

**REVIEW FIRST:**
1. Install @nestjs/prometheus and prom-client
2. Review existing metrics patterns (if any)
3. Understand counter, gauge, histogram metrics
4. Check where metrics should be instrumented
5. Review Prometheus naming conventions
6. **YOUR DOCUMENTATION**
   - MUST BE SAVED AT documentation/backend/sms_sprints/

**DO NOT:**
- Create metrics that expose sensitive data
- Add high-cardinality labels (e.g., phone numbers)
- Instrument every single method
- Create blocking metrics collection

---

## Objective

Expose Prometheus metrics for monitoring SMS operations (sent, delivered, failed, latency, etc.).

## Requirements

### 1. Install Dependencies

```bash
npm install @nestjs/prometheus prom-client
```

---

### 2. Metrics Module Setup

**File:** `api/src/modules/communication/communication.module.ts`

```typescript
import { PrometheusModule } from '@nestjs/prometheus';

@Module({
  imports: [
    // ... existing imports ...
    PrometheusModule.register({
      defaultMetrics: {
        enabled: true,
      },
      path: '/metrics',
    }),
  ],
})
```

---

### 3. SMS Metrics Service

**File:** `api/src/modules/communication/services/sms-metrics.service.ts` (NEW)

```typescript
import { Injectable } from '@nestjs/common';
import { Counter, Histogram } from 'prom-client';
import { InjectMetric } from '@nestjs/prometheus';

@Injectable()
export class SmsMetricsService {
  constructor(
    @InjectMetric('sms_sent_total')
    private readonly smsSentCounter: Counter<string>,

    @InjectMetric('sms_delivered_total')
    private readonly smsDeliveredCounter: Counter<string>,

    @InjectMetric('sms_failed_total')
    private readonly smsFailedCounter: Counter<string>,

    @InjectMetric('twilio_api_duration_seconds')
    private readonly twilioApiDuration: Histogram<string>,

    @InjectMetric('webhook_processing_duration_seconds')
    private readonly webhookDuration: Histogram<string>,
  ) {}

  incrementSmsSent(tenantId: string) {
    this.smsSentCounter.inc({ tenant_id: tenantId });
  }

  incrementSmsDelivered(tenantId: string) {
    this.smsDeliveredCounter.inc({ tenant_id: tenantId });
  }

  incrementSmsFailed(tenantId: string, errorCode?: string) {
    this.smsFailedCounter.inc({
      tenant_id: tenantId,
      error_code: errorCode || 'unknown',
    });
  }

  recordTwilioApiDuration(tenantId: string, durationSeconds: number) {
    this.twilioApiDuration.observe({ tenant_id: tenantId }, durationSeconds);
  }

  recordWebhookProcessing(provider: string, durationSeconds: number) {
    this.webhookDuration.observe({ provider }, durationSeconds);
  }
}
```

---

### 4. Metric Definitions

**File:** `api/src/modules/communication/communication.module.ts`

```typescript
import { makeCounterProvider, makeHistogramProvider } from '@nestjs/prometheus';

@Module({
  providers: [
    // ... existing providers ...
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
  ],
})
```

---

### 5. Instrument SMS Sending

**File:** `api/src/modules/communication/services/sms-sender.service.ts`

```typescript
// Inject metrics service
constructor(
  private readonly encryption: EncryptionService,
  private readonly metrics: SmsMetricsService,
) {}

async send(provider, credentials, sms) {
  const startTime = Date.now();
  
  try {
    const result = await this.sendViaTwilio(credentials, sms);
    
    // Record success
    const duration = (Date.now() - startTime) / 1000;
    this.metrics.recordTwilioApiDuration(sms.tenant_id, duration);
    this.metrics.incrementSmsSent(sms.tenant_id);
    
    return result;
  } catch (error) {
    this.metrics.incrementSmsFailed(sms.tenant_id, error.code);
    throw error;
  }
}
```

---

### 6. Instrument Webhook Processing

**File:** `api/src/modules/communication/controllers/twilio-webhooks.controller.ts`

```typescript
async handleSmsStatus(@Body() body, @Req() req) {
  const startTime = Date.now();
  
  try {
    // ... existing logic ...
    
    if (body.MessageStatus === 'delivered') {
      this.metrics.incrementSmsDelivered(tenantId);
    } else if (body.MessageStatus === 'failed') {
      this.metrics.incrementSmsFailed(tenantId, body.ErrorCode);
    }
    
    const duration = (Date.now() - startTime) / 1000;
    this.metrics.recordWebhookProcessing('twilio', duration);
  } catch (error) {
    // ... error handling ...
  }
}
```

---

## Testing

**Test 1: Metrics Endpoint**
- GET /metrics
- Verify: Prometheus format returned
- Verify: sms_sent_total metric exists

**Test 2: Send SMS, Check Metrics**
- Send SMS
- GET /metrics
- Verify: sms_sent_total{tenant_id="..."} incremented

**Test 3: Webhook Processing**
- Trigger webhook
- Verify: webhook_processing_duration_seconds recorded

---

## Acceptance Criteria

- [ ] Prometheus module installed
- [ ] SmsMetricsService implemented
- [ ] Metrics defined (counters, histograms)
- [ ] SMS sending instrumented
- [ ] Webhook processing instrumented
- [ ] /metrics endpoint works
- [ ] All tests pass

---

**END OF SPRINT 8**
