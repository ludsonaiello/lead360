# Background Jobs Module - Developer 1 Handoff to Developer 2

**Date**: January 7, 2026
**Status**: ✅ Ready for Developer 2
**Developer 1 Work**: COMPLETE
**Developer 2 Work**: Ready to Start

---

## Executive Summary

Developer 1 has completed all infrastructure and core services for the Background Jobs module. The foundation is now ready for Developer 2 to implement:
- Job queue management services
- Job processors (SendEmail, ExpiryCheck, Retention, DataCleanup, PartitionMaintenance)
- Scheduled job execution system

**All tests passing**: ✅
**Server running successfully**: ✅
**Database migrations applied**: ✅
**Core services ready**: ✅

---

## What Developer 1 Completed

### Phase 1: BullMQ Migration ✅

**Migrated from Bull v4 to BullMQ v5** using the new WorkerHost pattern.

**Dependencies Updated**:
- Removed: `bull@4.16.5`, `@nestjs/bull@11.0.4`
- Added: `bullmq@^5.30.7`, `@nestjs/bullmq@^11.0.0`
- Added: `nodemailer@^6.9.0`, `handlebars@^4.7.8`, `cron-parser@^4.9.0`
- Added (dev): `@types/nodemailer@^6.4.0`

**Files Modified**:
- [app.module.ts:5](api/src/app.module.ts#L5) - Updated BullModule import and configuration
- [audit.module.ts](api/src/modules/audit/audit.module.ts) - Updated to BullMQ
- [audit-log-write.job.ts](api/src/modules/audit/jobs/audit-log-write.job.ts) - Migrated to WorkerHost pattern
- [audit-logger.service.ts](api/src/modules/audit/services/audit-logger.service.ts) - Updated queue imports
- [files.module.ts](api/src/modules/files/files.module.ts) - Updated to BullMQ
- [file-cleanup.processor.ts](api/src/modules/files/processors/file-cleanup.processor.ts) - Migrated to WorkerHost with job routing
- [file-cleanup.scheduler.ts](api/src/modules/files/schedulers/file-cleanup.scheduler.ts) - Updated queue configuration

**Key Pattern - WorkerHost Implementation**:
```typescript
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('queue-name')
export class MyProcessor extends WorkerHost {
  constructor(/* inject dependencies */) {
    super();
  }

  async process(job: Job<PayloadType, any, string>): Promise<any> {
    // For multiple job types, route by job.name
    if (job.name === 'job-type-1') {
      return this.handleType1(job);
    } else if (job.name === 'job-type-2') {
      return this.handleType2(job);
    }

    // For single job type, process directly
    const result = await this.doWork(job.data);
    return { success: true, result };
  }
}
```

**BullMQ Configuration** (already in app.module.ts):
```typescript
BullModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: async (configService: ConfigService) => ({
    connection: {
      host: configService.get('REDIS_HOST') || '127.0.0.1',
      port: configService.get('REDIS_PORT') || 6379,
      password: configService.get('REDIS_PASSWORD'),
    },
  }),
  inject: [ConfigService],
})
```

---

### Phase 2: Database Schema ✅

**Added 6 new tables** to support job management and email system.

**Migration**: `prisma/migrations/manual_add_background_jobs.sql`

**Tables Created**:

#### 1. `job` - Core job tracking table
```sql
CREATE TABLE job (
  id VARCHAR(36) PRIMARY KEY,
  job_type VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  tenant_id VARCHAR(36),
  payload JSON,
  result JSON,
  error_message TEXT,
  attempts INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 3,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  failed_at TIMESTAMP NULL,
  duration_ms INT,

  INDEX idx_tenant_status_created (tenant_id, status, created_at),
  INDEX idx_job_type_status (job_type, status),
  INDEX idx_status_created (status, created_at)
);
```

**Status values**: `pending`, `processing`, `completed`, `failed`

#### 2. `job_log` - Detailed job execution logs
```sql
CREATE TABLE job_log (
  id VARCHAR(36) PRIMARY KEY,
  job_id VARCHAR(36) NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  level VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  metadata JSON,

  INDEX idx_job_timestamp (job_id, timestamp),
  FOREIGN KEY (job_id) REFERENCES job(id) ON DELETE CASCADE
);
```

**Log levels**: `info`, `warn`, `error`

#### 3. `scheduled_job` - Cron job definitions
```sql
CREATE TABLE scheduled_job (
  id VARCHAR(36) PRIMARY KEY,
  job_type VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  schedule VARCHAR(100) NOT NULL,
  timezone VARCHAR(100) NOT NULL DEFAULT 'America/New_York',
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at TIMESTAMP NULL,
  next_run_at TIMESTAMP NULL,
  max_retries INT NOT NULL DEFAULT 3,
  timeout_seconds INT NOT NULL DEFAULT 300,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_enabled_next_run (is_enabled, next_run_at),
  INDEX idx_job_type (job_type)
);
```

**Schedule format**: Cron expressions (e.g., `0 2 * * *` for 2 AM daily)

#### 4. `platform_email_config` - SMTP configuration (platform-level)
```sql
CREATE TABLE platform_email_config (
  id VARCHAR(36) PRIMARY KEY,
  smtp_host VARCHAR(255) NOT NULL,
  smtp_port INT NOT NULL,
  smtp_encryption VARCHAR(20) NOT NULL DEFAULT 'tls',
  smtp_username VARCHAR(255) NOT NULL,
  smtp_password TEXT NOT NULL,
  from_email VARCHAR(255) NOT NULL,
  from_name VARCHAR(255) NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by_user_id VARCHAR(36)
);
```

**Encryption types**: `none`, `tls`, `ssl`
**Important**: `smtp_password` is encrypted using EncryptionService (AES-256-GCM)

#### 5. `email_template` - Handlebars email templates
```sql
CREATE TABLE email_template (
  id VARCHAR(36) PRIMARY KEY,
  template_key VARCHAR(100) NOT NULL UNIQUE,
  subject VARCHAR(500) NOT NULL,
  html_body TEXT NOT NULL,
  text_body TEXT,
  variables JSON NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_template_key (template_key),
  INDEX idx_is_system (is_system)
);
```

**System templates** (seeded, cannot be deleted):
- `password-reset`
- `account-activation`
- `license-expiry-warning`
- `test-email`

**Template variables**: Array of variable names (e.g., `["user_name", "reset_link"]`)

#### 6. `email_queue` - Email sending queue
```sql
CREATE TABLE email_queue (
  id VARCHAR(36) PRIMARY KEY,
  job_id VARCHAR(36) NOT NULL UNIQUE,
  template_key VARCHAR(100),
  to_email VARCHAR(255) NOT NULL,
  cc_emails JSON,
  bcc_emails JSON,
  subject VARCHAR(500) NOT NULL,
  html_body TEXT NOT NULL,
  text_body TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  smtp_message_id VARCHAR(255),
  error_message TEXT,
  sent_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_status_created (status, created_at),
  INDEX idx_job_id (job_id),
  FOREIGN KEY (job_id) REFERENCES job(id) ON DELETE CASCADE
);
```

**Status values**: `pending`, `sent`, `failed`

**Also updated**: `tenant` table now has `timezone` field (default: `America/New_York`)

---

### Phase 3: Encryption Service ✅

**Purpose**: Securely encrypt/decrypt SMTP passwords using AES-256-GCM.

**Location**: [api/src/core/encryption/](api/src/core/encryption/)

**Files Created**:
- [encryption.module.ts](api/src/core/encryption/encryption.module.ts)
- [encryption.service.ts](api/src/core/encryption/encryption.service.ts)
- [encryption.service.spec.ts](api/src/core/encryption/encryption.service.spec.ts)

**Environment Variable Required**:
```env
ENCRYPTION_KEY=1d238a1a9dd10e8b30c93b9631758e89e299c58c4c3e1279e0f4241b01b98c0e
```
**⚠️ CRITICAL**: Never commit this key. Already added to `.env` file.

**Service API**:

```typescript
import { EncryptionService } from '../../core/encryption/encryption.service';

constructor(private readonly encryption: EncryptionService) {}

// Encrypt password before storing
const encryptedPassword = this.encryption.encrypt('my-smtp-password');
await this.prisma.platform_email_config.create({
  data: {
    smtp_password: encryptedPassword, // Store encrypted
    // ... other fields
  }
});

// Decrypt password before using
const config = await this.prisma.platform_email_config.findFirst();
const password = this.encryption.decrypt(config.smtp_password);
```

**Security Features**:
- AES-256-GCM authenticated encryption
- Random IV (initialization vector) for each encryption
- Authentication tag prevents tampering
- Different ciphertext for same plaintext (non-deterministic)

**Encrypted Data Format** (JSON string):
```json
{
  "iv": "hexadecimal string",
  "encrypted": "hexadecimal string",
  "authTag": "hexadecimal string"
}
```

---

### Phase 4: Email Core Services ✅

**Location**: [api/src/modules/jobs/services/](api/src/modules/jobs/services/)

#### 1. SmtpService - Nodemailer Integration

**File**: [smtp.service.ts](api/src/modules/jobs/services/smtp.service.ts)

**Features**:
- Nodemailer transporter with connection pooling
- Auto-initialization from `platform_email_config` table
- Config change detection (reinitializes if updated)
- SMTP connection verification

**API**:

```typescript
import { SmtpService } from './services/smtp.service';

constructor(private readonly smtp: SmtpService) {}

// Send email (auto-initializes transporter if needed)
const result = await this.smtp.sendEmail({
  to: 'user@example.com',
  cc: ['cc1@example.com', 'cc2@example.com'], // Optional
  bcc: ['bcc@example.com'], // Optional
  subject: 'Welcome to Lead360',
  html: '<h1>Welcome!</h1><p>Your account is ready.</p>',
  text: 'Welcome! Your account is ready.', // Optional fallback
});

console.log(result.messageId); // SMTP message ID

// Verify SMTP connection (useful for testing config)
const isValid = await this.smtp.verifyConnection();
if (!isValid) {
  throw new Error('SMTP configuration is invalid');
}
```

**Configuration**:
- Reads from `platform_email_config` table (first record)
- Uses EncryptionService to decrypt `smtp_password`
- Supports TLS, SSL, or no encryption
- Connection pool: max 5 connections

**Important Notes**:
- Transporter is cached in memory
- Reinitializes if `updated_at` timestamp changes
- `from_email` and `from_name` are automatically added from config

#### 2. EmailTemplateService - Handlebars Templates

**File**: [email-template.service.ts](api/src/modules/jobs/services/email-template.service.ts)

**Features**:
- CRUD operations for email templates
- Handlebars template compilation and rendering
- Syntax validation before saving
- System template protection (cannot delete/modify)

**API**:

```typescript
import { EmailTemplateService } from './services/email-template.service';

constructor(private readonly templates: EmailTemplateService) {}

// Get single template
const template = await this.templates.getTemplate('password-reset');
console.log(template.subject); // "Reset Your Password - Lead360"
console.log(template.variables); // ["user_name", "reset_link"]

// Get all templates (with optional filters)
const allTemplates = await this.templates.getAllTemplates();
const customTemplates = await this.templates.getAllTemplates({ is_system: false });
const searchResults = await this.templates.getAllTemplates({ search: 'password' });

// Create new template
const newTemplate = await this.templates.createTemplate({
  template_key: 'welcome-email',
  subject: 'Welcome {{user_name}}!',
  html_body: '<h1>Hello {{user_name}}</h1><p>Welcome to {{company_name}}.</p>',
  text_body: 'Hello {{user_name}}, welcome to {{company_name}}.',
  variables: ['user_name', 'company_name'],
  description: 'Welcome email for new users',
});

// Update template (system templates cannot be updated)
await this.templates.updateTemplate('welcome-email', {
  subject: 'Welcome to Lead360, {{user_name}}!',
  variables: ['user_name'],
});

// Delete template (system templates cannot be deleted)
await this.templates.deleteTemplate('welcome-email');

// Render template with variables
const rendered = this.templates.renderTemplate(
  'Hello {{user_name}}, your balance is ${{amount}}.',
  { user_name: 'John', amount: 1500 }
);
console.log(rendered); // "Hello John, your balance is $1500."

// Validate Handlebars syntax
const validation = this.templates.validateHandlebars('Hello {{user_name}}');
console.log(validation.valid); // true

const badValidation = this.templates.validateHandlebars('Hello {{user_name');
console.log(badValidation.valid); // false
console.log(badValidation.error); // "Parse error on line 1..."
```

**System Templates** (seeded, protected):

1. **password-reset**
   - Variables: `user_name`, `reset_link`
   - Subject: "Reset Your Password - Lead360"

2. **account-activation**
   - Variables: `user_name`, `activation_link`
   - Subject: "Activate Your Account - Lead360"

3. **license-expiry-warning**
   - Variables: `company_name`, `license_type`, `expiry_date`
   - Subject: "License Expiring Soon - {{company_name}}"

4. **test-email**
   - Variables: (none)
   - Subject: "Test Email - Lead360"

**Handlebars Features**:
- Variable interpolation: `{{variable}}`
- Conditionals: `{{#if condition}}...{{/if}}`
- Loops: `{{#each items}}...{{/each}}`
- Helpers: Can be extended later

**Validation**:
- Template syntax is validated before saving
- Throws `BadRequestException` if invalid
- System templates cannot be modified/deleted (throws `BadRequestException`)

#### 3. EmailService - Orchestration Layer

**File**: [email.service.ts](api/src/modules/jobs/services/email.service.ts)

**Features**:
- High-level email sending API
- Combines SmtpService + EmailTemplateService
- Supports templated and raw emails

**API**:

```typescript
import { EmailService } from './services/email.service';

constructor(private readonly emailService: EmailService) {}

// Send templated email
const result = await this.emailService.sendTemplatedEmail({
  to: 'user@example.com',
  cc: ['manager@example.com'], // Optional
  bcc: ['admin@example.com'], // Optional
  templateKey: 'password-reset',
  variables: {
    user_name: 'John Doe',
    reset_link: 'https://app.lead360.app/reset-password?token=abc123',
  },
});

console.log(result.messageId); // SMTP message ID

// Send raw email (no template)
await this.emailService.sendRawEmail({
  to: 'customer@example.com',
  subject: 'Custom Subject',
  html: '<p>Custom HTML content</p>',
  text: 'Custom text content',
});
```

**Workflow** (for templated email):
1. Fetch template from database
2. Render subject with Handlebars + variables
3. Render HTML body with Handlebars + variables
4. Render text body (if exists) with Handlebars + variables
5. Send via SmtpService
6. Return message ID

**Use Cases**:
- **sendTemplatedEmail**: Most common use case (password resets, notifications, etc.)
- **sendRawEmail**: For dynamic content not stored in templates (reports, invoices, etc.)

---

### Phase 5: JobsModule Registration ✅

**File**: [api/src/modules/jobs/jobs.module.ts](api/src/modules/jobs/jobs.module.ts)

**Queue Registration**:
```typescript
BullModule.registerQueue(
  { name: 'email' },      // For email sending jobs
  { name: 'scheduled' },  // For scheduled/cron jobs
)
```

**Services Exported** (available to other modules):
- `EmailService` (use this for sending emails)
- `EmailTemplateService` (for template management APIs)
- `SmtpService` (for direct SMTP operations)

**Module Registration**: Already added to [app.module.ts:41](api/src/app.module.ts#L41)

---

## Developer 2 Implementation Guide

### What You Need to Build

Developer 2 is responsible for implementing the **job management layer** between the queues and the core services. This includes:

1. **JobQueueService** - Database-backed job tracking wrapper around BullMQ
2. **ScheduledJobService** - Manage scheduled job definitions
3. **5 Job Processors**:
   - SendEmailProcessor
   - LicenseExpiryCheckProcessor
   - DataRetentionProcessor
   - DataCleanupProcessor
   - PartitionMaintenanceProcessor
4. **ScheduledJobExecutor** - Master cron scheduler

### Service Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    JobsModule (Current State)                │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ✅ EmailService (Developer 1 - DONE)                        │
│  ✅ EmailTemplateService (Developer 1 - DONE)                │
│  ✅ SmtpService (Developer 1 - DONE)                         │
│  ✅ EncryptionService (Developer 1 - DONE)                   │
│                                                               │
│  ⏳ JobQueueService (Developer 2 - TODO)                     │
│  ⏳ ScheduledJobService (Developer 2 - TODO)                 │
│                                                               │
│  ⏳ SendEmailProcessor (Developer 2 - TODO)                  │
│  ⏳ LicenseExpiryCheckProcessor (Developer 2 - TODO)         │
│  ⏳ DataRetentionProcessor (Developer 2 - TODO)              │
│  ⏳ DataCleanupProcessor (Developer 2 - TODO)                │
│  ⏳ PartitionMaintenanceProcessor (Developer 2 - TODO)       │
│                                                               │
│  ⏳ ScheduledJobExecutor (Developer 2 - TODO)                │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Order (Recommended)

#### Step 1: JobQueueService (Core Wrapper)

**Purpose**: Wrap BullMQ with database tracking.

**Responsibilities**:
- Add jobs to BullMQ queues
- Create `job` record in database
- Create `job_log` entries for important events
- Update job status (pending → processing → completed/failed)
- Track duration, attempts, error messages

**API Design**:

```typescript
interface AddJobOptions {
  jobType: string;
  tenantId?: string; // Nullable for platform-level jobs
  payload: any;
  queueName: 'email' | 'scheduled';
  maxRetries?: number;
  priority?: number;
}

class JobQueueService {
  // Add job to queue + database
  async addJob(options: AddJobOptions): Promise<string>;

  // Get job status from database
  async getJobStatus(jobId: string): Promise<JobStatus>;

  // Get jobs by tenant (for admin UI)
  async getJobsByTenant(tenantId: string, filters?: JobFilters): Promise<Job[]>;

  // Cancel job (remove from queue + mark as failed)
  async cancelJob(jobId: string): Promise<void>;

  // Add log entry to job
  async addJobLog(jobId: string, level: 'info' | 'warn' | 'error', message: string, metadata?: any): Promise<void>;

  // Update job status (called by processors)
  async updateJobStatus(jobId: string, status: JobStatus, result?: any, error?: string): Promise<void>;
}
```

**Usage Example** (how processors will use it):

```typescript
// In a processor
async process(job: Job): Promise<any> {
  const jobId = job.data.jobId; // You'll pass jobId in payload

  try {
    await this.jobQueue.updateJobStatus(jobId, 'processing');
    await this.jobQueue.addJobLog(jobId, 'info', 'Starting email send');

    // Do work...
    const result = await this.doWork(job.data);

    await this.jobQueue.addJobLog(jobId, 'info', 'Email sent successfully', { messageId: result.messageId });
    await this.jobQueue.updateJobStatus(jobId, 'completed', result);

    return result;
  } catch (error) {
    await this.jobQueue.addJobLog(jobId, 'error', error.message, { stack: error.stack });
    await this.jobQueue.updateJobStatus(jobId, 'failed', null, error.message);
    throw error;
  }
}
```

**Important**:
- Always create `job` record BEFORE adding to BullMQ queue
- Pass `jobId` in the BullMQ job payload
- Processors will reference `jobId` to update status
- Use transactions where applicable (Prisma `$transaction`)

---

#### Step 2: ScheduledJobService (Cron Management)

**Purpose**: Manage scheduled job definitions and calculate next run times.

**Responsibilities**:
- CRUD operations for `scheduled_job` table
- Parse cron expressions
- Calculate next run time based on timezone
- Enable/disable jobs
- Track last run time

**API Design**:

```typescript
class ScheduledJobService {
  // Get all scheduled jobs
  async getAllScheduledJobs(): Promise<ScheduledJob[]>;

  // Get enabled jobs ready to run
  async getJobsDueForExecution(): Promise<ScheduledJob[]>;

  // Update last run time and calculate next run time
  async markJobExecuted(jobType: string, executedAt: Date): Promise<void>;

  // Enable/disable job
  async setJobEnabled(jobType: string, enabled: boolean): Promise<void>;

  // Update job schedule (recalculate next run time)
  async updateJobSchedule(jobType: string, newSchedule: string): Promise<void>;

  // Get next execution time for a cron expression + timezone
  calculateNextRun(cronExpression: string, timezone: string, fromDate?: Date): Date;
}
```

**Cron Expression Parsing**:
Use `cron-parser` package (already installed):

```typescript
import parser from 'cron-parser';

calculateNextRun(cronExpression: string, timezone: string, fromDate?: Date): Date {
  const interval = parser.parseExpression(cronExpression, {
    currentDate: fromDate || new Date(),
    tz: timezone,
  });
  return interval.next().toDate();
}
```

**Timezone Handling**:
- Each tenant has `timezone` field (default: `America/New_York`)
- Platform-level jobs use default timezone
- Next run time is calculated in tenant's timezone

---

#### Step 3: SendEmailProcessor (First Processor)

**Purpose**: Process email sending jobs from the `email` queue.

**Responsibilities**:
- Receive email job from BullMQ
- Update job status in database
- Call EmailService to send email
- Update `email_queue` table with result
- Handle errors and retries

**Implementation**:

```typescript
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { EmailService } from '../services/email.service';
import { JobQueueService } from '../services/job-queue.service';
import { PrismaService } from '../../../core/database/prisma.service';

interface SendEmailJobData {
  jobId: string; // Reference to job table
  emailQueueId: string; // Reference to email_queue table
  to: string;
  cc?: string[];
  bcc?: string[];
  templateKey?: string;
  variables?: Record<string, any>;
  subject?: string; // For raw emails
  html?: string; // For raw emails
  text?: string; // For raw emails
}

@Processor('email')
export class SendEmailProcessor extends WorkerHost {
  private readonly logger = new Logger(SendEmailProcessor.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly jobQueue: JobQueueService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<SendEmailJobData>): Promise<any> {
    const { jobId, emailQueueId, templateKey, variables, subject, html, text, to, cc, bcc } = job.data;

    try {
      // Update job status
      await this.jobQueue.updateJobStatus(jobId, 'processing');
      await this.jobQueue.addJobLog(jobId, 'info', `Sending email to ${to}`);

      let result;

      // Send templated or raw email
      if (templateKey) {
        result = await this.emailService.sendTemplatedEmail({
          to,
          cc,
          bcc,
          templateKey,
          variables,
        });
      } else {
        result = await this.emailService.sendRawEmail({
          to,
          cc,
          bcc,
          subject,
          html,
          text,
        });
      }

      // Update email_queue record
      await this.prisma.email_queue.update({
        where: { id: emailQueueId },
        data: {
          status: 'sent',
          smtp_message_id: result.messageId,
          sent_at: new Date(),
        },
      });

      // Update job status
      await this.jobQueue.addJobLog(jobId, 'info', 'Email sent successfully', { messageId: result.messageId });
      await this.jobQueue.updateJobStatus(jobId, 'completed', { messageId: result.messageId });

      this.logger.log(`Email sent successfully: ${result.messageId}`);
      return { success: true, messageId: result.messageId };

    } catch (error) {
      // Update email_queue record
      await this.prisma.email_queue.update({
        where: { id: emailQueueId },
        data: {
          status: 'failed',
          error_message: error.message,
        },
      });

      // Update job status
      await this.jobQueue.addJobLog(jobId, 'error', `Email send failed: ${error.message}`, { stack: error.stack });
      await this.jobQueue.updateJobStatus(jobId, 'failed', null, error.message);

      this.logger.error(`Email send failed: ${error.message}`, error.stack);
      throw error; // BullMQ will retry based on maxRetries
    }
  }
}
```

**Queue Registration**: Already done in [jobs.module.ts:14](api/src/modules/jobs/jobs.module.ts#L14)

**Add to JobsModule providers**:
```typescript
providers: [
  // ... existing services ...
  SendEmailProcessor, // Add this
]
```

---

#### Step 4: LicenseExpiryCheckProcessor

**Purpose**: Check tenant licenses for upcoming expiry and send warning emails.

**Job Type**: `license-expiry-check`
**Queue**: `scheduled`
**Schedule**: Daily (e.g., `0 9 * * *` = 9 AM daily)

**Responsibilities**:
- Query tenants with licenses expiring soon (e.g., within 30, 14, 7 days)
- For each tenant, queue email notification
- Update tenant notification tracking (don't spam)

**Implementation Outline**:

```typescript
@Processor('scheduled')
export class LicenseExpiryCheckProcessor extends WorkerHost {
  async process(job: Job): Promise<any> {
    if (job.name !== 'license-expiry-check') return;

    const jobId = job.data.jobId;
    await this.jobQueue.updateJobStatus(jobId, 'processing');

    // Find tenants with licenses expiring in 30, 14, or 7 days
    const today = new Date();
    const tenantsToNotify = await this.prisma.tenant.findMany({
      where: {
        OR: [
          { license_end_date: this.addDays(today, 30) },
          { license_end_date: this.addDays(today, 14) },
          { license_end_date: this.addDays(today, 7) },
        ],
        // TODO: Add check to avoid duplicate notifications
      },
    });

    let notificationsSent = 0;

    for (const tenant of tenantsToNotify) {
      // Get tenant admin email (query user table)
      const admin = await this.prisma.user.findFirst({
        where: { tenant_id: tenant.id, role: 'admin' },
      });

      if (!admin) continue;

      // Queue email via JobQueueService
      await this.jobQueue.addJob({
        jobType: 'send-email',
        tenantId: tenant.id,
        payload: {
          to: admin.email,
          templateKey: 'license-expiry-warning',
          variables: {
            company_name: tenant.company_name,
            license_type: tenant.license_type,
            expiry_date: tenant.license_end_date.toLocaleDateString(),
          },
        },
        queueName: 'email',
      });

      notificationsSent++;
    }

    await this.jobQueue.updateJobStatus(jobId, 'completed', { notificationsSent });
    return { success: true, notificationsSent };
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}
```

**Schedule Setup**:
Add to `scheduled_job` table (seed or admin UI):
```sql
INSERT INTO scheduled_job (id, job_type, name, schedule, is_enabled)
VALUES (
  UUID(),
  'license-expiry-check',
  'Check for Expiring Licenses',
  '0 9 * * *',
  TRUE
);
```

---

#### Step 5: DataRetentionProcessor

**Purpose**: Anonymize or delete old data based on tenant retention policies.

**Job Type**: `data-retention`
**Queue**: `scheduled`
**Schedule**: Weekly (e.g., `0 3 * * 0` = 3 AM every Sunday)

**Responsibilities**:
- Query each tenant's retention policy
- Anonymize or delete leads/contacts older than policy (e.g., 7 years)
- Anonymize or delete audit logs older than policy
- Log summary of records processed

**Implementation Outline**:

```typescript
@Processor('scheduled')
export class DataRetentionProcessor extends WorkerHost {
  async process(job: Job): Promise<any> {
    if (job.name !== 'data-retention') return;

    const jobId = job.data.jobId;
    await this.jobQueue.updateJobStatus(jobId, 'processing');

    const tenants = await this.prisma.tenant.findMany();
    let totalRecordsProcessed = 0;

    for (const tenant of tenants) {
      // Get retention policy from tenant config
      const config = await this.prisma.tenant_config.findFirst({
        where: { tenant_id: tenant.id },
      });

      if (!config || !config.data_retention_years) continue;

      const retentionDate = this.subtractYears(new Date(), config.data_retention_years);

      // Anonymize old leads (example)
      const result = await this.prisma.lead.updateMany({
        where: {
          tenant_id: tenant.id,
          created_at: { lt: retentionDate },
          is_anonymized: false,
        },
        data: {
          first_name: 'ANONYMIZED',
          last_name: 'ANONYMIZED',
          email: null,
          phone: null,
          is_anonymized: true,
        },
      });

      totalRecordsProcessed += result.count;
      await this.jobQueue.addJobLog(jobId, 'info', `Tenant ${tenant.id}: Anonymized ${result.count} leads`);
    }

    await this.jobQueue.updateJobStatus(jobId, 'completed', { totalRecordsProcessed });
    return { success: true, totalRecordsProcessed };
  }

  private subtractYears(date: Date, years: number): Date {
    const result = new Date(date);
    result.setFullYear(result.getFullYear() - years);
    return result;
  }
}
```

---

#### Step 6: DataCleanupProcessor

**Purpose**: Clean up orphaned records and temporary data.

**Job Type**: `data-cleanup`
**Queue**: `scheduled`
**Schedule**: Daily (e.g., `0 4 * * *` = 4 AM daily)

**Responsibilities**:
- Delete old job logs (older than 30 days)
- Delete completed jobs (older than 7 days)
- Delete orphaned files (files not linked to any entity)
- Delete expired password reset tokens

**Implementation Outline**:

```typescript
@Processor('scheduled')
export class DataCleanupProcessor extends WorkerHost {
  async process(job: Job): Promise<any> {
    if (job.name !== 'data-cleanup') return;

    const jobId = job.data.jobId;
    await this.jobQueue.updateJobStatus(jobId, 'processing');

    const thirtyDaysAgo = this.subtractDays(new Date(), 30);
    const sevenDaysAgo = this.subtractDays(new Date(), 7);

    // Delete old job logs
    const logsDeleted = await this.prisma.job_log.deleteMany({
      where: { timestamp: { lt: thirtyDaysAgo } },
    });

    // Delete old completed jobs
    const jobsDeleted = await this.prisma.job.deleteMany({
      where: {
        status: 'completed',
        completed_at: { lt: sevenDaysAgo },
      },
    });

    // Delete orphaned files (files not linked to any entity)
    // This depends on your file tracking implementation
    // Example:
    // const orphanedFiles = await this.prisma.file.deleteMany({
    //   where: { is_orphaned: true, created_at: { lt: sevenDaysAgo } },
    // });

    await this.jobQueue.addJobLog(jobId, 'info', `Deleted ${logsDeleted.count} job logs and ${jobsDeleted.count} jobs`);
    await this.jobQueue.updateJobStatus(jobId, 'completed', { logsDeleted: logsDeleted.count, jobsDeleted: jobsDeleted.count });

    return { success: true, logsDeleted: logsDeleted.count, jobsDeleted: jobsDeleted.count };
  }

  private subtractDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() - days);
    return result;
  }
}
```

---

#### Step 7: PartitionMaintenanceProcessor

**Purpose**: Maintain MySQL table partitions for large tables.

**Job Type**: `partition-maintenance`
**Queue**: `scheduled`
**Schedule**: Monthly (e.g., `0 2 1 * *` = 2 AM on 1st of month)

**Responsibilities**:
- Add new partitions to large tables (e.g., audit_log, job_log)
- Drop old partitions beyond retention period
- Optimize partitions

**Important**: This requires MySQL partition support. If not using partitions, this processor can be skipped or simplified to just analyze tables.

**Implementation Outline**:

```typescript
@Processor('scheduled')
export class PartitionMaintenanceProcessor extends WorkerHost {
  async process(job: Job): Promise<any> {
    if (job.name !== 'partition-maintenance') return;

    const jobId = job.data.jobId;
    await this.jobQueue.updateJobStatus(jobId, 'processing');

    // This requires raw SQL queries
    const prisma = this.prisma.$queryRawUnsafe;

    // Example: Add next month's partition to audit_log table
    const nextMonth = this.getNextMonth();
    const partitionName = `p${nextMonth.getFullYear()}${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;

    await prisma(`
      ALTER TABLE audit_log
      ADD PARTITION IF NOT EXISTS (
        PARTITION ${partitionName} VALUES LESS THAN (TO_DAYS('${nextMonth.toISOString().split('T')[0]}'))
      );
    `);

    // Drop old partitions (e.g., older than 2 years)
    const twoYearsAgo = this.subtractYears(new Date(), 2);
    const oldPartitionName = `p${twoYearsAgo.getFullYear()}${String(twoYearsAgo.getMonth() + 1).padStart(2, '0')}`;

    await prisma(`
      ALTER TABLE audit_log DROP PARTITION IF EXISTS ${oldPartitionName};
    `);

    await this.jobQueue.updateJobStatus(jobId, 'completed', { partitionsManaged: 2 });
    return { success: true };
  }

  private getNextMonth(): Date {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    date.setDate(1);
    return date;
  }

  private subtractYears(date: Date, years: number): Date {
    const result = new Date(date);
    result.setFullYear(result.getFullYear() - years);
    return result;
  }
}
```

**Note**: If you're not using MySQL partitions, simplify this to just run `OPTIMIZE TABLE` or `ANALYZE TABLE` on large tables.

---

#### Step 8: ScheduledJobExecutor (Master Scheduler)

**Purpose**: Central cron job that checks for scheduled jobs due to run and triggers them.

**Responsibilities**:
- Run every minute (via `@Cron`)
- Query `scheduled_job` table for jobs due to run (`next_run_at <= NOW()`)
- For each job, add to `scheduled` queue via JobQueueService
- Update `last_run_at` and calculate `next_run_at`

**Implementation**:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ScheduledJobService } from './services/scheduled-job.service';
import { JobQueueService } from './services/job-queue.service';

@Injectable()
export class ScheduledJobExecutor {
  private readonly logger = new Logger(ScheduledJobExecutor.name);

  constructor(
    private readonly scheduledJobService: ScheduledJobService,
    private readonly jobQueue: JobQueueService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async executeScheduledJobs() {
    this.logger.log('Checking for scheduled jobs...');

    // Get jobs due for execution
    const jobsDue = await this.scheduledJobService.getJobsDueForExecution();

    if (jobsDue.length === 0) {
      this.logger.log('No jobs due for execution');
      return;
    }

    this.logger.log(`Found ${jobsDue.length} jobs due for execution`);

    for (const scheduledJob of jobsDue) {
      try {
        // Add job to BullMQ queue
        const jobId = await this.jobQueue.addJob({
          jobType: scheduledJob.job_type,
          tenantId: null, // Scheduled jobs are platform-level
          payload: {},
          queueName: 'scheduled',
          maxRetries: scheduledJob.max_retries,
        });

        // Update scheduled job (mark as executed, calculate next run)
        await this.scheduledJobService.markJobExecuted(scheduledJob.job_type, new Date());

        this.logger.log(`Scheduled job ${scheduledJob.job_type} queued with ID ${jobId}`);
      } catch (error) {
        this.logger.error(
          `Failed to queue scheduled job ${scheduledJob.job_type}: ${error.message}`,
          error.stack,
        );
      }
    }
  }

  /**
   * Manual trigger for testing (optional)
   */
  async triggerScheduledJob(jobType: string) {
    const scheduledJob = await this.scheduledJobService.getJobByType(jobType);

    if (!scheduledJob) {
      throw new Error(`Scheduled job ${jobType} not found`);
    }

    if (!scheduledJob.is_enabled) {
      throw new Error(`Scheduled job ${jobType} is disabled`);
    }

    const jobId = await this.jobQueue.addJob({
      jobType: scheduledJob.job_type,
      tenantId: null,
      payload: {},
      queueName: 'scheduled',
      maxRetries: scheduledJob.max_retries,
    });

    return { jobId };
  }
}
```

**Add to JobsModule**:
```typescript
providers: [
  // ... existing services ...
  ScheduledJobExecutor, // Add this
]
```

---

### Testing Checklist for Developer 2

After implementing all services and processors, verify:

- [ ] JobQueueService creates `job` and `job_log` records correctly
- [ ] ScheduledJobService calculates next run times accurately (test multiple timezones)
- [ ] SendEmailProcessor sends emails and updates `email_queue` table
- [ ] All 5 processors handle errors gracefully (retry logic)
- [ ] ScheduledJobExecutor triggers jobs at correct times
- [ ] Multi-tenant isolation maintained (tenant_id filtering)
- [ ] All unit tests passing
- [ ] Integration tests for each processor
- [ ] Manual testing: trigger each job type manually

---

## Environment Variables Summary

**Required for Developer 2**:
```env
# Redis (already configured)
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=978@F32cca17mc

# Encryption (already configured)
ENCRYPTION_KEY=1d238a1a9dd10e8b30c93b9631758e89e299c58c4c3e1279e0f4241b01b98c0e

# Database (already configured)
DATABASE_URL=mysql://lead360:978@F32cca17mc@localhost:3306/lead360
```

**Optional** (for SMTP testing, added by admin later):
```env
# Platform SMTP (stored in database, encrypted)
# These are configured via admin UI, not .env
```

---

## Database Access Examples

### Query Jobs by Tenant

```typescript
const jobs = await this.prisma.job.findMany({
  where: {
    tenant_id: tenantId,
    status: 'completed',
  },
  include: {
    job_log: true,
    email_queue: true,
  },
  orderBy: { created_at: 'desc' },
  take: 50,
});
```

### Get Job Statistics

```typescript
const stats = await this.prisma.job.groupBy({
  by: ['status'],
  where: { tenant_id: tenantId },
  _count: { id: true },
});

// Returns: [{ status: 'completed', _count: { id: 150 } }, ...]
```

### Get Recent Job Logs

```typescript
const logs = await this.prisma.job_log.findMany({
  where: { job_id: jobId },
  orderBy: { timestamp: 'desc' },
  take: 100,
});
```

---

## Important Notes for Developer 2

### Multi-Tenancy

- **Platform-level jobs** (scheduled jobs): `tenant_id` is `NULL`
- **Tenant-specific jobs** (email sends): `tenant_id` is set
- Always filter by `tenant_id` when displaying job data to users
- Scheduled jobs affect ALL tenants (e.g., license expiry check iterates all tenants)

### Error Handling

- Use `try/catch` in all processors
- Update job status to `failed` on error
- Add detailed error logs to `job_log` table
- Let BullMQ handle retries (don't manually retry)
- Set appropriate `max_retries` per job type

### Performance

- Use database transactions for job creation + queue addition
- Batch process records where possible (e.g., bulk email sends)
- Add indexes on frequently queried fields (already done)
- Monitor queue size (Redis memory usage)
- Consider job priorities for critical emails

### Security

- Never expose SMTP password (always encrypted)
- Validate job payloads before processing
- Sanitize email content to prevent injection
- Rate limit email sending to prevent spam

### Timezone Handling

- All timestamps in database are UTC
- Convert to tenant timezone only for display
- Use `cron-parser` with timezone option for scheduling
- Default timezone: `America/New_York`

---

## Files Structure for Developer 2

**Create these files**:

```
api/src/modules/jobs/
├── jobs.module.ts                          (already exists, update providers)
├── services/
│   ├── smtp.service.ts                     ✅ (already done)
│   ├── email-template.service.ts           ✅ (already done)
│   ├── email.service.ts                    ✅ (already done)
│   ├── job-queue.service.ts                ⏳ (Developer 2 - TODO)
│   └── scheduled-job.service.ts            ⏳ (Developer 2 - TODO)
├── processors/
│   ├── send-email.processor.ts             ⏳ (Developer 2 - TODO)
│   ├── license-expiry-check.processor.ts   ⏳ (Developer 2 - TODO)
│   ├── data-retention.processor.ts         ⏳ (Developer 2 - TODO)
│   ├── data-cleanup.processor.ts           ⏳ (Developer 2 - TODO)
│   └── partition-maintenance.processor.ts  ⏳ (Developer 2 - TODO)
└── executors/
    └── scheduled-job.executor.ts           ⏳ (Developer 2 - TODO)
```

---

## API Documentation for Developer 3

Developer 2 does NOT create API controllers. Developer 3 will create REST endpoints for:
- Job status queries (GET /jobs, GET /jobs/:id)
- Job logs (GET /jobs/:id/logs)
- Scheduled job management (GET/POST/PATCH /scheduled-jobs)
- Email template management (GET/POST/PATCH/DELETE /email-templates)
- SMTP configuration (GET/POST /platform/email-config)
- Manual job triggers (POST /jobs/trigger)

**Developer 2**: Your services should be fully functional and testable WITHOUT API endpoints.

---

## Success Criteria for Developer 2

**Developer 2 is complete when**:

- [ ] JobQueueService implemented and tested
- [ ] ScheduledJobService implemented and tested
- [ ] SendEmailProcessor working (emails sent successfully)
- [ ] LicenseExpiryCheckProcessor working (emails queued for expiring licenses)
- [ ] DataRetentionProcessor working (old data anonymized)
- [ ] DataCleanupProcessor working (orphaned records deleted)
- [ ] PartitionMaintenanceProcessor working (or simplified to table optimization)
- [ ] ScheduledJobExecutor triggers jobs every minute
- [ ] All unit tests passing
- [ ] Integration tests for each processor
- [ ] Server runs without errors
- [ ] Redis queue dashboard shows jobs processing
- [ ] Database records created correctly (job, job_log, email_queue)

---

## Questions or Blockers?

If you encounter issues:

1. **Check Developer 1's code**: All services are functional and tested
2. **Review BullMQ docs**: https://docs.bullmq.io/
3. **Check cron-parser docs**: https://github.com/harrisiirak/cron-parser
4. **Verify database schema**: All tables and indexes are created
5. **Test individual services**: Use unit tests to isolate issues

**If something doesn't work**:
- Check service imports in JobsModule
- Verify Redis connection (should already work)
- Check database connection (should already work)
- Review logs in `logs/` directory
- Verify environment variables are set

---

## Handoff Summary

**Developer 1 Status**: ✅ COMPLETE

**Delivered to Developer 2**:
- Fully functional BullMQ queues (email, scheduled)
- Complete database schema (6 new tables + timezone field)
- Encryption service (AES-256-GCM)
- Email services (SMTP + Templates + Orchestration)
- Seeded email templates (4 system templates)
- Working server with no errors

**Developer 2 Next Steps**:
1. Read this handoff document thoroughly
2. Review Developer 1's code (especially services)
3. Implement JobQueueService first (core dependency)
4. Implement ScheduledJobService second
5. Implement processors one by one (start with SendEmailProcessor)
6. Implement ScheduledJobExecutor last
7. Write tests for each component
8. Test end-to-end (trigger scheduled jobs, verify emails sent)

**Estimated Timeline**: Days 5-8 (Week 2)

**Good luck, Developer 2!** 🚀

---

**End of Handoff Documentation**
