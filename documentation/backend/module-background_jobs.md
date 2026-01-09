# Backend Module: Background Jobs

**Module Name**: Background Jobs & Email Queue System  
**Sprint**: Sprint 0 - Platform Foundation  
**Feature Contract**: `/documentation/contracts/background-jobs-contract.md`  
**Agent**: Backend Specialist  
**Status**: Ready for Development

---

## Overview

This module implements BullMQ-based job queue system with basic SMTP email sending for system emails, configurable scheduled jobs, and comprehensive job monitoring. You will also migrate all existing cron jobs to this unified system.

**Sprint 0 Scope**:
- Job queue infrastructure (BullMQ)
- System emails only (SMTP)
- Scheduled jobs (configurable)
- Job monitoring

**Deferred to Communication Module** (Sprint 1+):
- Business emails (quotes, invoices)
- Multiple email providers (AWS SES, SendGrid, Brevo)
- Tenant email configuration
- SMS/Twilio integration

**Read First**:
- `/documentation/contracts/background-jobs-contract.md` (complete job queue requirements)
- `/documentation/shared/security-rules.md` (security requirements)
- `/documentation/shared/api-conventions.md` (REST patterns)

---

## Database Tables Structure

### **Tables to Create**

1. **job** - Job queue records and history
2. **job_log** - Detailed execution logs per job
3. **scheduled_job** - Configurable scheduled jobs
4. **platform_email_config** - SMTP settings for system emails (single row)
5. **email_template** - System email templates only
6. **email_queue** - Email delivery tracking

---

## Table Design

### **job Table**

**Purpose**: Track all job executions (queue and history)

**Key Fields**:
- id (UUID, primary key)
- job_type (VARCHAR(100) - SendEmailJob, ExpiryCheckJob, etc.)
- status (ENUM: pending, active, completed, failed, delayed)
- tenant_id (UUID, foreign key to tenant, nullable for platform jobs)
- scheduled_job_id (UUID, foreign key to scheduled_job, nullable)
- payload (JSONB - job parameters)
- result (JSONB, nullable - job output)
- priority (INTEGER - 1=highest, 10=lowest, default 5)
- attempts (INTEGER, default 0)
- max_attempts (INTEGER, default 3)
- error_message (TEXT, nullable)
- error_stack (TEXT, nullable)
- created_at (TIMESTAMP - queued time)
- started_at (TIMESTAMP, nullable)
- completed_at (TIMESTAMP, nullable)
- failed_at (TIMESTAMP, nullable)
- duration_ms (INTEGER, nullable - execution time)

**Indexes**:
- Primary key on id
- Index: (status, created_at) - list pending/active jobs
- Index: (tenant_id, status) - filter by tenant
- Index: (job_type, status) - filter by type
- Index: (created_at DESC) - sort by date
- Index: (scheduled_job_id) - find runs for scheduled job

**Business Rules**:
- Completed jobs deleted after 30 days
- Failed jobs deleted after 30 days
- Status transitions: pending → active → completed/failed

---

### **job_log Table**

**Purpose**: Detailed execution logs for debugging

**Key Fields**:
- id (UUID, primary key)
- job_id (UUID, foreign key to job)
- timestamp (TIMESTAMP)
- level (ENUM: debug, info, warn, error)
- message (TEXT)
- metadata (JSONB, nullable)

**Indexes**:
- Primary key on id
- Index: (job_id, timestamp) - get logs for job

**Business Rules**:
- Deleted when parent job deleted (cascade)

---

### **scheduled_job Table**

**Purpose**: Cron-like scheduled jobs (configurable)

**Key Fields**:
- id (UUID, primary key)
- job_type (VARCHAR(100) - ExpiryCheckJob, DataCleanupJob, etc.)
- name (VARCHAR(255) - "License & Insurance Expiry Check")
- description (TEXT)
- schedule (VARCHAR(100) - cron expression: "0 6 * * *")
- timezone (VARCHAR(50) - "America/New_York")
- is_enabled (BOOLEAN, default true)
- max_retries (INTEGER, default 3)
- timeout_seconds (INTEGER, default 300)
- last_run_at (TIMESTAMP, nullable)
- last_run_status (ENUM: completed, failed, nullable)
- next_run_at (TIMESTAMP, nullable)
- created_at, updated_at

**Indexes**:
- Primary key on id
- Index: (is_enabled, next_run_at) - find next jobs to run
- Unique index: (job_type) - one schedule per job type

**Business Rules**:
- Only one schedule per job_type
- next_run_at calculated from cron expression
- If disabled, skip execution

---

### **platform_email_config Table**

**Purpose**: SMTP settings for system emails (single row)

**Key Fields**:
- id (UUID, primary key)
- smtp_host (VARCHAR(255) - e.g., smtp.gmail.com)
- smtp_port (INTEGER - e.g., 587 for TLS, 465 for SSL)
- smtp_encryption (ENUM: tls, ssl)
- smtp_username (VARCHAR(255))
- smtp_password (TEXT, encrypted)
- from_email (VARCHAR(255) - e.g., noreply@lead360.com)
- from_name (VARCHAR(255) - e.g., Lead360)
- updated_at (TIMESTAMP)
- updated_by_user_id (UUID, foreign key to user)

**Seed Data**:
```sql
INSERT INTO platform_email_config (smtp_host, smtp_port, smtp_encryption, from_email, from_name)
VALUES ('smtp.gmail.com', 587, 'tls', 'noreply@lead360.com', 'Lead360');
```

**Business Rules**:
- Only one row exists (singleton)
- Password encrypted at rest
- Used for all system emails (password reset, activation, alerts)

---

### **email_template Table**

**Purpose**: System email templates only

**Key Fields**:
- id (UUID, primary key)
- template_key (VARCHAR(100) - "activation-email", "password-reset", etc.)
- subject (TEXT)
- html_body (TEXT - HTML template with Handlebars variables)
- text_body (TEXT - plain text template)
- variables (JSONB - list of available variables)
- created_at, updated_at

**Indexes**:
- Primary key on id
- Unique index: (template_key)

**Seed Data** (System Templates):
```sql
INSERT INTO email_template (template_key, subject, html_body, variables)
VALUES
  ('activation-email', 'Activate Your Lead360 Account', '<html>...</html>', '["name", "activation_link", "subdomain"]'),
  ('password-reset', 'Reset Your Password', '<html>...</html>', '["name", "reset_link", "expires_in"]'),
  ('expiry-alert-license', 'License Expiring Soon', '<html>...</html>', '["license_type", "expires_at", "days_left"]'),
  ('expiry-alert-insurance', 'Insurance Expiring Soon', '<html>...</html>', '["insurance_type", "expires_at", "days_left"]');
```

**Business Rules**:
- All templates are system templates (no tenant customization in Sprint 0)
- Variables replaced at send time (Handlebars syntax: {{name}}, {{reset_link}})
- Both HTML and text versions required

---

### **email_queue Table**

**Purpose**: Track system email delivery status

**Key Fields**:
- id (UUID, primary key)
- job_id (UUID, foreign key to job)
- template_key (VARCHAR(100))
- to_email (VARCHAR(255))
- from_email (VARCHAR(255))
- subject (TEXT)
- status (ENUM: pending, sent, failed)
- smtp_message_id (VARCHAR(255), nullable - SMTP message ID)
- error_message (TEXT, nullable)
- sent_at (TIMESTAMP, nullable)
- created_at (TIMESTAMP)

**Indexes**:
- Primary key on id
- Index: (status, created_at) - find pending emails
- Index: (to_email) - find emails to address

**Business Rules**:
- Deleted when parent job deleted (cascade)
- Track delivery status for auditing
- Only system emails tracked here (business emails in future Communication module)

---

## NestJS Module Structure

**Directory**:
```
src/modules/jobs/
├── jobs.module.ts
├── controllers/
│   ├── jobs.controller.ts (Platform Admin)
│   ├── scheduled-jobs.controller.ts (Platform Admin)
│   ├── platform-email.controller.ts (Platform Admin)
│   └── tenant-email.controller.ts (Tenant Owner/Admin)
├── services/
│   ├── job-queue.service.ts (BullMQ wrapper)
│   ├── job-manager.service.ts (job CRUD)
│   ├── scheduled-job.service.ts (cron scheduling)
│   ├── email.service.ts (send emails)
│   ├── email-provider.factory.ts (select provider)
│   ├── email-template.service.ts (render templates)
│   └── job-retention.service.ts (cleanup old jobs)
├── providers/
│   ├── aws-ses.provider.ts
│   ├── sendgrid.provider.ts
│   ├── brevo.provider.ts
│   └── smtp.provider.ts
├── processors/
│   ├── send-email.processor.ts
│   ├── bulk-email.processor.ts
│   ├── expiry-check.processor.ts
│   ├── data-cleanup.processor.ts
│   ├── partition-creator.processor.ts
│   ├── file-retention.processor.ts
│   └── job-retention.processor.ts
├── dto/
│   ├── job-query.dto.ts
│   ├── create-scheduled-job.dto.ts
│   ├── update-email-settings.dto.ts
│   └── send-email.dto.ts
└── jobs.service.spec.ts
```

---

## BullMQ Setup

### **Dependencies**

```json
{
  "bullmq": "^5.0.0",
  "ioredis": "^5.3.0",
  "nodemailer": "^6.9.0",
  "handlebars": "^4.7.8",
  "cron": "^3.1.0"
}
```

---

### **Queue Configuration**

**Location**: `jobs.module.ts`

```typescript
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD,
      },
    }),
    BullModule.registerQueue(
      { name: 'email' }, // Email queue
      { name: 'background' }, // General background jobs
      { name: 'scheduled' } // Scheduled jobs
    ),
  ],
  // ... providers, controllers
})
export class JobsModule {}
```

---

## Email Service Architecture

### **EmailService** (Main Service)

**Location**: `services/email.service.ts`

**Methods**:

1. **send(emailDto)**
   - Get platform SMTP config
   - Render template (Handlebars)
   - Queue email job (BullMQ)
   - Return job_id

2. **sendBatch(emails[])**
   - Queue bulk email job
   - Process in batches of 100

3. **getSmtpConfig()**
   - Return platform_email_config from database
   - Decrypt password

---

### **SmtpService** (Nodemailer Integration)

**Location**: `services/smtp.service.ts`

**Dependencies**: `nodemailer`

**Implementation**:
```typescript
import nodemailer from 'nodemailer';

export class SmtpService {
  private transporter;

  constructor() {
    const config = await this.getSmtpConfig();
    
    this.transporter = nodemailer.createTransport({
      host: config.smtp_host,
      port: config.smtp_port,
      secure: config.smtp_encryption === 'ssl', // true for SSL, false for TLS
      auth: {
        user: config.smtp_username,
        pass: decrypt(config.smtp_password)
      }
    });
  }

  async send(email) {
    const info = await this.transporter.sendMail({
      from: `${email.from_name} <${email.from_email}>`,
      to: email.to_email,
      subject: email.subject,
      html: email.html_body,
      text: email.text_body
    });

    return { message_id: info.messageId };
  }

  async testConnection() {
    return await this.transporter.verify();
  }
}
```

---

## Email Template Rendering

### **EmailTemplateService**

**Location**: `services/email-template.service.ts`

**Dependencies**: `handlebars`

**Methods**:

1. **render(templateKey, variables, emailType, tenantId?)**
   - Get template from database
   - If tenant template exists, use it (otherwise use system template)
   - Compile with Handlebars
   - Replace variables
   - Return rendered HTML and text

**Example**:
```typescript
const template = await getTemplate('quote-email', 'business', tenantId);
const compiled = Handlebars.compile(template.html_body);
const html = compiled({
  customer_name: 'John Doe',
  quote_number: '123',
  quote_link: 'https://...',
  business_name: 'ABC Painting'
});
```

---

## Scheduled Jobs System

### **ScheduledJobService**

**Location**: `services/scheduled-job.service.ts`

**Dependencies**: `cron` (for parsing cron expressions)

**Methods**:

1. **initializeSchedules()**
   - Load all enabled scheduled jobs from database
   - Calculate next_run_at for each
   - Register with cron scheduler

2. **updateSchedule(id, updateDto)**
   - Update schedule in database
   - Recalculate next_run_at
   - Re-register with cron scheduler

3. **triggerJob(id)**
   - Manually trigger scheduled job
   - Queue job immediately
   - Don't affect next scheduled run

4. **enableJob(id)** / **disableJob(id)**
   - Update is_enabled flag
   - Register/unregister with cron

**Cron Implementation**:
```typescript
import { CronJob } from 'cron';

private scheduledJobs: Map<string, CronJob> = new Map();

registerSchedule(scheduledJob) {
  const cronJob = new CronJob(
    scheduledJob.schedule,
    () => this.executeScheduledJob(scheduledJob.id),
    null,
    true,
    scheduledJob.timezone
  );

  this.scheduledJobs.set(scheduledJob.id, cronJob);
}
```

---

## Job Processors

### **SendEmailProcessor**

**Location**: `processors/send-email.processor.ts`

**Purpose**: Process system email queue jobs

**Implementation**:
```typescript
@Processor('email')
export class SendEmailProcessor {
  @Process('send-single')
  async processSendEmail(job: Job) {
    const { to, template_key, variables } = job.data;

    // Render template
    const rendered = await templateService.render(template_key, variables);

    // Get SMTP config
    const smtpConfig = await emailService.getSmtpConfig();

    // Send via SMTP
    const result = await smtpService.send({
      to_email: to,
      from_email: smtpConfig.from_email,
      from_name: smtpConfig.from_name,
      subject: rendered.subject,
      html_body: rendered.html,
      text_body: rendered.text
    });

    // Update email_queue
    await emailQueueRepository.update(job.data.email_queue_id, {
      status: 'sent',
      smtp_message_id: result.message_id,
      sent_at: new Date()
    });

    // Audit log
    await auditLogger.log({
      action_type: 'created',
      entity_type: 'email',
      description: `System email sent to ${to}`,
      metadata_json: { template_key, message_id: result.message_id }
    });

    return result;
  }
}
```

---

### **ExpiryCheckProcessor**

**Location**: `processors/expiry-check.processor.ts`

**Purpose**: Check for expiring licenses and insurance

**Implementation**:
```typescript
@Processor('scheduled')
export class ExpiryCheckProcessor {
  @Process('expiry-check')
  async processExpiryCheck(job: Job) {
    // Check licenses expiring in 30, 15, 7, 1 days
    const expiringLicenses = await tenantLicenseRepository.find({
      where: {
        expires_at: Between(new Date(), addDays(new Date(), 30)),
        expiry_alert_sent: false
      }
    });

    for (const license of expiringLicenses) {
      const daysLeft = differenceInDays(license.expires_at, new Date());

      if ([30, 15, 7, 1].includes(daysLeft)) {
        // Queue expiry alert email
        await emailService.send({
          to: license.tenant.owner_email,
          template_key: 'expiry-alert-license',
          variables: {
            license_type: license.license_type,
            expires_at: format(license.expires_at, 'MMMM d, yyyy'),
            days_left: daysLeft
          },
          email_type: 'system'
        });

        // Mark alert sent
        await tenantLicenseRepository.update(license.id, {
          expiry_alert_sent: true
        });
      }
    }

    // Same for insurance
    // ...

    return { licenses_checked: expiringLicenses.length };
  }
}
```

---

### **JobRetentionProcessor**

**Location**: `processors/job-retention.processor.ts`

**Purpose**: Clean up old job records

**Implementation**:
```typescript
@Processor('scheduled')
export class JobRetentionProcessor {
  @Process('job-retention')
  async processJobRetention(job: Job) {
    const cutoffDate = subDays(new Date(), 30);

    // Delete successful jobs older than 30 days
    const deletedCompleted = await jobRepository.delete({
      status: 'completed',
      completed_at: LessThan(cutoffDate)
    });

    // Delete failed jobs older than 30 days
    const deletedFailed = await jobRepository.delete({
      status: 'failed',
      failed_at: LessThan(cutoffDate)
    });

    // Keep last 100 runs per scheduled job type
    const scheduledJobs = await scheduledJobRepository.find();

    for (const scheduledJob of scheduledJobs) {
      const runs = await jobRepository.find({
        where: { scheduled_job_id: scheduledJob.id },
        order: { created_at: 'DESC' },
        skip: 100 // Keep first 100, delete rest
      });

      if (runs.length > 0) {
        const deleteIds = runs.map(r => r.id);
        await jobRepository.delete(deleteIds);
      }
    }

    // Audit log
    await auditLogger.log({
      action_type: 'deleted',
      entity_type: 'job',
      description: `Job retention cleanup: ${deletedCompleted.affected + deletedFailed.affected} records deleted`
    });

    return {
      completed_deleted: deletedCompleted.affected,
      failed_deleted: deletedFailed.affected
    };
  }
}
```

---

## API Controllers

### **JobsController** (Platform Admin)

**Location**: `controllers/jobs.controller.ts`

**Routes**:

1. **GET /admin/jobs**
   - @UseGuards(JwtAuthGuard, PlatformAdminGuard)
   - Query params: filters, pagination
   - Calls JobManagerService.findAll()

2. **GET /admin/jobs/:id**
   - @UseGuards(JwtAuthGuard, PlatformAdminGuard)
   - Calls JobManagerService.findOne()

3. **POST /admin/jobs/:id/retry**
   - @UseGuards(JwtAuthGuard, PlatformAdminGuard)
   - Calls JobManagerService.retry()

4. **DELETE /admin/jobs/:id**
   - @UseGuards(JwtAuthGuard, PlatformAdminGuard)
   - Calls JobManagerService.delete()

5. **GET /admin/jobs/failed**
   - @UseGuards(JwtAuthGuard, PlatformAdminGuard)
   - Calls JobManagerService.findFailed()

6. **POST /admin/jobs/failed/retry-all**
   - @UseGuards(JwtAuthGuard, PlatformAdminGuard)
   - Calls JobManagerService.retryAllFailed()

7. **DELETE /admin/jobs/failed/clear**
   - @UseGuards(JwtAuthGuard, PlatformAdminGuard)
   - Calls JobManagerService.clearFailed()

8. **GET /admin/jobs/health**
   - @UseGuards(JwtAuthGuard, PlatformAdminGuard)
   - Calls JobManagerService.getHealth()

---

### **ScheduledJobsController** (Platform Admin)

**Location**: `controllers/scheduled-jobs.controller.ts`

**Routes**:

1. **GET /admin/jobs/schedules**
   - List all scheduled jobs

2. **GET /admin/jobs/schedules/:id**
   - Get schedule details

3. **POST /admin/jobs/schedules**
   - Create new scheduled job

4. **PATCH /admin/jobs/schedules/:id**
   - Update schedule (schedule, timezone, enabled)

5. **DELETE /admin/jobs/schedules/:id**
   - Delete scheduled job

6. **POST /admin/jobs/schedules/:id/trigger**
   - Manually trigger job now

7. **GET /admin/jobs/schedules/:id/history**
   - Get last 100 runs for scheduled job

---

### **PlatformEmailController** (Platform Admin)

**Location**: `controllers/platform-email.controller.ts`

**Routes**:

1. **GET /admin/jobs/email-settings**
   - Get platform SMTP config

2. **PATCH /admin/jobs/email-settings**
   - Update platform SMTP config

3. **POST /admin/jobs/email-settings/test**
   - Send test email

---

## Migration Instructions

**CRITICAL**: Audit entire codebase and migrate ALL cron jobs to this system.

### **Step 1: Identify Existing Cron Jobs**

**Search for**:
- `@Cron()` decorators
- `@nestjs/schedule` imports
- Hardcoded intervals
- `setInterval()` calls

**Known Jobs to Migrate**:

1. **Audit Log Module** (`src/modules/audit/`):
   - PartitionCreatorJob (create monthly partitions)
   - Location: Find `@Cron('0 0 1 * *')` or similar

2. **File Storage Module** (`src/modules/files/`):
   - FileRetentionJob (hard delete files after 90 days)
   - ZipCleanupJob (delete temporary ZIPs after 24 hours)

3. **Tenant Module** (`src/modules/tenant/`):
   - ExpiryCheckJob (check license/insurance expiry)

4. **Authentication Module** (`src/modules/auth/`):
   - SessionCleanupJob (delete expired sessions)
   - Token cleanup

---

### **Step 2: Create Processor Classes**

**For each existing cron job**:

1. Remove `@Cron()` decorator
2. Create processor in `src/modules/jobs/processors/`
3. Implement job logic
4. Register in JobsModule

**Example Migration**:

**Before** (in Audit module):
```typescript
@Injectable()
export class AuditService {
  @Cron('0 0 1 * *')
  async createMonthlyPartition() {
    // Logic here
  }
}
```

**After** (in Jobs module):
```typescript
@Processor('scheduled')
export class PartitionCreatorProcessor {
  @Process('partition-creator')
  async processPartitionCreation(job: Job) {
    // Same logic here
  }
}
```

---

### **Step 3: Create Scheduled Job Records**

**Seed scheduled_job table**:

```sql
INSERT INTO scheduled_job (job_type, name, description, schedule, timezone)
VALUES
  ('ExpiryCheckJob', 'License & Insurance Expiry Check', 'Check for expiring licenses and insurance daily', '0 6 * * *', 'America/New_York'),
  ('DataCleanupJob', 'Data Cleanup', 'Purge old tokens and sessions daily', '0 2 * * *', 'America/New_York'),
  ('PartitionCreatorJob', 'Audit Log Partition Creator', 'Create monthly audit log partitions', '0 0 1 * *', 'America/New_York'),
  ('FileRetentionJob', 'File Retention', 'Delete old soft-deleted files', '0 3 * * *', 'America/New_York'),
  ('JobRetentionJob', 'Job Retention', 'Clean up old job records', '0 4 * * *', 'America/New_York');
```

---

### **Step 4: Update Email Sending**

**Migrate all email sending to EmailService**:

**Before**:
```typescript
// Direct email sending in Auth module
await sendActivationEmail(user.email, activationLink);
```

**After**:
```typescript
// Queue email via EmailService
await emailService.send({
  to: user.email,
  template_key: 'activation-email',
  variables: { name: user.name, activation_link: activationLink },
  email_type: 'system'
});
```

---

### **Step 5: Test Migration**

**Checklist**:
- [ ] All `@Cron()` decorators removed
- [ ] All processors created and registered
- [ ] All scheduled jobs seeded in database
- [ ] All email sending migrated to EmailService
- [ ] Test each scheduled job manually (trigger via API)
- [ ] Verify jobs run on schedule
- [ ] Verify email sending works (all 4 providers)
- [ ] Audit logs created for all jobs

---

## Audit Logging

**Log These Actions**:

1. **Job Execution**:
   - Job started → action_type: created, entity_type: job
   - Job completed → action_type: updated, entity_type: job
   - Job failed → action_type: failed, entity_type: job

2. **Email Sent**:
   - Email sent → action_type: created, entity_type: email

3. **Email Settings Updated**:
   - Platform email settings updated → action_type: updated, entity_type: platform_email_config
   - Tenant email settings updated → action_type: updated, entity_type: tenant_email_config

4. **Scheduled Job Changes**:
   - Schedule updated → action_type: updated, entity_type: scheduled_job
   - Job manually triggered → action_type: created, entity_type: job

---

## Testing Requirements

### **Unit Tests** (>80% coverage)

1. **EmailService**
   - ✅ Send email via AWS SES
   - ✅ Send email via SendGrid
   - ✅ Send email via Brevo
   - ✅ Send email via SMTP
   - ✅ Render template
   - ✅ Get platform email config
   - ✅ Get tenant email config

2. **JobQueueService**
   - ✅ Queue job
   - ✅ Process job
   - ✅ Retry failed job
   - ✅ Job timeout

3. **ScheduledJobService**
   - ✅ Register schedule
   - ✅ Update schedule
   - ✅ Trigger job manually
   - ✅ Calculate next run time

4. **Processors**
   - ✅ SendEmailProcessor
   - ✅ ExpiryCheckProcessor
   - ✅ JobRetentionProcessor

---

### **Integration Tests**

1. **Email Flow**
   - ✅ Queue email → Worker sends → Email sent
   - ✅ Platform email uses platform config
   - ✅ Business email uses tenant config
   - ✅ Failed email retries 3 times

2. **Scheduled Jobs**
   - ✅ Job runs on schedule
   - ✅ Job runs in correct timezone
   - ✅ Disabled job doesn't run

3. **Job Retention**
   - ✅ Old jobs deleted after 30 days
   - ✅ Scheduled job logs keep last 100

4. **Migration**
   - ✅ All existing cron jobs migrated
   - ✅ All emails sent via EmailService

---

## Completion Checklist

- [ ] BullMQ configured (Redis connected)
- [ ] All tables created (job, job_log, scheduled_job, platform_email_config, email_template, email_queue)
- [ ] SMTP email service (Nodemailer)
- [ ] Email template rendering (Handlebars)
- [ ] Platform SMTP config CRUD
- [ ] Job queue service
- [ ] Job manager service
- [ ] Scheduled job service
- [ ] All processors created (email, expiry, cleanup, retention)
- [ ] All API endpoints implemented (15 endpoints)
- [ ] Existing cron jobs migrated
- [ ] Job retention cleanup
- [ ] Audit logging (all job executions)
- [ ] Unit tests >80% coverage
- [ ] Integration tests passing
- [ ] API documentation complete (Swagger)

---

## Common Pitfalls to Avoid

1. **Don't hardcode cron schedules** - Store in database
2. **Don't forget credentials encryption** - Encrypt email API keys at rest
3. **Don't skip migration** - All existing cron jobs must be migrated
4. **Don't forget retry logic** - Failed jobs must retry 3 times
5. **Don't skip audit logging** - All jobs must be logged
6. **Don't forget job retention** - Clean up old jobs
7. **Don't mix email configs** - Platform vs Tenant configs are separate
8. **Don't forget timezone** - Scheduled jobs must respect timezone

---

**End of Backend Module Documentation**

Background jobs are critical infrastructure. All async tasks, scheduled jobs, and emails must go through this unified system.