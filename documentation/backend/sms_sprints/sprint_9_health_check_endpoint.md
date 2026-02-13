# Sprint 9: Health Check Endpoint

**Priority:** 🔵 LOW
**Estimated Effort:** 2-3 hours
**Developer:** AI Developer #9
**Dependencies:** None
**Assigned Date:** February 13, 2026

---

## ⚠️ CRITICAL INSTRUCTIONS

**REVIEW FIRST:**
1. Install @nestjs/terminus
2. Review existing health check patterns
3. Check database connection patterns
4. Review Redis/BullMQ connection
5. Understand health check best practices
6. **YOUR DOCUMENTATION**
   - MUST BE SAVED AT documentation/backend/sms_sprints/

**DO NOT:**
- Expose sensitive information in health checks
- Make health checks slow (timeout: 5 seconds)
- Include non-critical checks

---

## Objective

Create comprehensive health check endpoint for monitoring system health (database, Redis, Twilio API, encryption service).

## Requirements

### 1. Install Dependencies

```bash
npm install @nestjs/terminus
```

---

### 2. Health Check Service

**File:** `api/src/modules/communication/services/communication-health.service.ts` (NEW)

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { EncryptionService } from '../../../core/encryption/encryption.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import twilio from 'twilio';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    [key: string]: {
      status: 'up' | 'down';
      message?: string;
      latency_ms?: number;
    };
  };
  timestamp: string;
}

@Injectable()
export class CommunicationHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    @InjectQueue('communication-sms') private readonly smsQueue: Queue,
  ) {}

  async checkHealth(): Promise<HealthCheckResult> {
    const checks: HealthCheckResult['checks'] = {};

    // Check database
    const dbCheck = await this.checkDatabase();
    checks.database = dbCheck;

    // Check Redis (via queue)
    const redisCheck = await this.checkRedis();
    checks.redis_queue = redisCheck;

    // Check encryption service
    const encryptionCheck = await this.checkEncryption();
    checks.encryption_service = encryptionCheck;

    // Check Twilio API (optional - don't fail if no config)
    const twilioCheck = await this.checkTwilioApi();
    checks.twilio_api = twilioCheck;

    // Determine overall status
    const isHealthy = Object.values(checks).every((c) => c.status === 'up');
    const isDegraded = Object.values(checks).some((c) => c.status === 'down');

    return {
      status: isHealthy ? 'healthy' : isDegraded ? 'degraded' : 'unhealthy',
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase() {
    const startTime = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'up' as const,
        latency_ms: Date.now() - startTime,
      };
    } catch (error) {
      return {
        status: 'down' as const,
        message: error.message,
      };
    }
  }

  private async checkRedis() {
    const startTime = Date.now();
    try {
      const jobCounts = await this.smsQueue.getJobCounts();
      return {
        status: 'up' as const,
        latency_ms: Date.now() - startTime,
        message: `Active: ${jobCounts.active}, Waiting: ${jobCounts.waiting}`,
      };
    } catch (error) {
      return {
        status: 'down' as const,
        message: error.message,
      };
    }
  }

  private async checkEncryption() {
    try {
      const testData = 'health-check-test';
      const encrypted = this.encryption.encrypt(testData);
      const decrypted = this.encryption.decrypt(encrypted);
      
      if (decrypted !== testData) {
        return {
          status: 'down' as const,
          message: 'Encryption/decryption mismatch',
        };
      }

      return { status: 'up' as const };
    } catch (error) {
      return {
        status: 'down' as const,
        message: error.message,
      };
    }
  }

  private async checkTwilioApi() {
    try {
      // Get any active SMS config for testing
      const config = await this.prisma.tenant_sms_config.findFirst({
        where: { is_active: true },
      });

      if (!config) {
        return {
          status: 'up' as const,
          message: 'No active SMS config (skipped)',
        };
      }

      // Decrypt credentials
      const credentials = JSON.parse(
        this.encryption.decrypt(config.credentials),
      );

      // Test Twilio API connection
      const startTime = Date.now();
      const client = twilio(credentials.account_sid, credentials.auth_token);
      await client.api.accounts(credentials.account_sid).fetch();

      return {
        status: 'up' as const,
        latency_ms: Date.now() - startTime,
      };
    } catch (error) {
      return {
        status: 'down' as const,
        message: error.message,
      };
    }
  }
}
```

---

### 3. Health Check Controller

**File:** `api/src/modules/communication/controllers/communication-health.controller.ts` (NEW)

```typescript
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CommunicationHealthService } from '../services/communication-health.service';

/**
 * Health Check Controller
 * 
 * IMPORTANT: This endpoint should NOT require authentication
 * Used by monitoring systems (Kubernetes, load balancers, etc.)
 */
@ApiTags('Communication - Health')
@Controller('communication/health')
export class CommunicationHealthController {
  constructor(
    private readonly healthService: CommunicationHealthService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Check communication module health' })
  async checkHealth() {
    return await this.healthService.checkHealth();
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe (simple check)' })
  liveness() {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe (full checks)' })
  async readiness() {
    const health = await this.healthService.checkHealth();
    if (health.status === 'unhealthy') {
      throw new Error('System unhealthy');
    }
    return health;
  }
}
```

---

### 4. Module Registration

**File:** `api/src/modules/communication/communication.module.ts`

```typescript
import { CommunicationHealthService } from './services/communication-health.service';
import { CommunicationHealthController } from './controllers/communication-health.controller';

@Module({
  providers: [
    // ... existing ...
    CommunicationHealthService,
  ],
  controllers: [
    // ... existing ...
    CommunicationHealthController,
  ],
})
```

---

## Testing

**Test 1: Health Check (All Healthy)**
```bash
GET /communication/health
```
Expected:
```json
{
  "status": "healthy",
  "checks": {
    "database": { "status": "up", "latency_ms": 5 },
    "redis_queue": { "status": "up", "latency_ms": 3 },
    "encryption_service": { "status": "up" },
    "twilio_api": { "status": "up", "latency_ms": 120 }
  },
  "timestamp": "2026-02-13T10:00:00Z"
}
```

**Test 2: Database Down**
- Stop database
- GET /health
- Verify: status='unhealthy', database.status='down'

**Test 3: Liveness Probe**
- GET /communication/health/live
- Verify: Always returns 200 OK

**Test 4: Readiness Probe**
- GET /communication/health/ready
- Verify: Returns 200 if healthy, 500 if unhealthy

---

## Kubernetes Integration

```yaml
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: api
    livenessProbe:
      httpGet:
        path: /communication/health/live
        port: 3000
      initialDelaySeconds: 30
      periodSeconds: 10
    readinessProbe:
      httpGet:
        path: /communication/health/ready
        port: 3000
      initialDelaySeconds: 10
      periodSeconds: 5
```

---

## Acceptance Criteria

- [ ] CommunicationHealthService implemented
- [ ] Health check controller created
- [ ] Database check works
- [ ] Redis check works
- [ ] Encryption check works
- [ ] Twilio API check works (optional)
- [ ] Liveness probe works
- [ ] Readiness probe works
- [ ] All tests pass
- [ ] API documentation updated

---

**END OF SPRINT 9**
