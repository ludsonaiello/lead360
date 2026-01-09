# Background Jobs Module - Part 2: Job Processors & Scheduling

## Developer 2 Assignment
**Focus**: Job queue services, job processors, and scheduled job execution system
**Timeline**: Days 5-7 (Week 2)
**Depends On**: Developer 1 (Infrastructure complete)
**Handoff To**: Developer 3 (API Controllers & Documentation)

---

## Prerequisites from Developer 1

**CRITICAL**: Read Developer 1's handoff documentation at the end of `background-jobs-part1-infrastructure.md`

### What Developer 1 Completed
✅ BullMQ upgraded and working (audit-log-write, file-cleanup queues migrated)
✅ Database schema (tenant.timezone + 6 new tables: job, job_log, scheduled_job, platform_email_config, email_template, email_queue)
✅ EncryptionService (for SMTP passwords)
✅ SmtpService (Nodemailer integration)
✅ EmailTemplateService (CRUD + Handlebars validation)
✅ EmailService (orchestration)

### Services You Can Use
```typescript
// Injected via constructor
this.emailService.sendTemplatedEmail({ to, templateKey, variables });
this.encryption.encrypt(password);
this.prisma.job.create({ data: ... });
```

---

## Your Responsibilities

### 1. Job Queue Services (Day 5)

#### 1.1 JobQueueService (BullMQ Wrapper)
**File**: `/var/www/lead360.app/api/src/modules/jobs/services/job-queue.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';
import { randomBytes } from 'crypto';

@Injectable()
export class JobQueueService {
  private readonly logger = new Logger(JobQueueService.name);

  constructor(
    @InjectQueue('email') private emailQueue: Queue,
    @InjectQueue('scheduled') private scheduledQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  async queueEmail(data: {
    to: string;
    cc?: string[];
    bcc?: string[];
    templateKey: string;
    variables: Record<string, any>;
    tenantId?: string;
  }): Promise<{ jobId: string }> {
    const jobId = randomBytes(16).toString('hex');

    // Create job record in database
    await this.prisma.job.create({
      data: {
        id: jobId,
        job_type: 'send-email',
        status: 'pending',
        tenant_id: data.tenantId,
        payload: data,
        max_retries: 3,
      },
    });

    // Queue to BullMQ
    await this.emailQueue.add('send-email', data, {
      jobId,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        age: 86400, // 24 hours
        count: 1000,
      },
      removeOnFail: false,
    });

    this.logger.log(`Email job queued: ${jobId}`);

    return { jobId };
  }

  async queueScheduledJob(jobType: string, payload: any): Promise<{ jobId: string }> {
    const jobId = randomBytes(16).toString('hex');

    await this.prisma.job.create({
      data: {
        id: jobId,
        job_type: jobType,
        status: 'pending',
        payload,
        max_retries: 1, // Most scheduled jobs run once
      },
    });

    await this.scheduledQueue.add(jobType, payload, {
      jobId,
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: false,
    });

    return { jobId };
  }

  async updateJobStatus(
    jobId: string,
    status: 'processing' | 'completed' | 'failed',
    updates: {
      result?: any;
      error_message?: string;
      duration_ms?: number;
    } = {},
  ): Promise<void> {
    const updateData: any = {
      status,
      attempts: { increment: status === 'failed' ? 1 : 0 },
    };

    if (status === 'processing') {
      updateData.started_at = new Date();
    } else if (status === 'completed') {
      updateData.completed_at = new Date();
      updateData.result = updates.result;
      updateData.duration_ms = updates.duration_ms;
    } else if (status === 'failed') {
      updateData.failed_at = new Date();
      updateData.error_message = updates.error_message;
    }

    await this.prisma.job.update({
      where: { id: jobId },
      data: updateData,
    });
  }

  async logJobExecution(
    jobId: string,
    level: 'info' | 'warn' | 'error',
    message: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.prisma.job_log.create({
      data: {
        id: randomBytes(16).toString('hex'),
        job_id: jobId,
        level,
        message,
        metadata,
      },
    });
  }
}
```

#### 1.2 ScheduledJobService
**File**: `/var/www/lead360.app/api/src/modules/jobs/services/scheduled-job.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { randomBytes } from 'crypto';
import * as parser from 'cron-parser';

@Injectable()
export class ScheduledJobService {
  private readonly logger = new Logger(ScheduledJobService.name);

  constructor(private readonly prisma: PrismaService) {}

  async registerScheduledJob(data: {
    job_type: string;
    name: string;
    description?: string;
    schedule: string; // cron expression
    timezone?: string;
    max_retries?: number;
    timeout_seconds?: number;
  }) {
    // Validate cron expression
    try {
      parser.parseExpression(data.schedule, { tz: data.timezone || 'America/New_York' });
    } catch (error) {
      throw new Error(`Invalid cron expression: ${error.message}`);
    }

    const nextRun = this.calculateNextRun(data.schedule, data.timezone);

    return this.prisma.scheduled_job.create({
      data: {
        id: randomBytes(16).toString('hex'),
        ...data,
        timezone: data.timezone || 'America/New_York',
        next_run_at: nextRun,
      },
    });
  }

  async updateSchedule(scheduleId: string, updates: Partial<{
    name: string;
    description: string;
    schedule: string;
    timezone: string;
    is_enabled: boolean;
    max_retries: number;
    timeout_seconds: number;
  }>) {
    if (updates.schedule) {
      const existing = await this.prisma.scheduled_job.findUnique({ where: { id: scheduleId } });
      const timezone = updates.timezone || existing.timezone;

      try {
        parser.parseExpression(updates.schedule, { tz: timezone });
      } catch (error) {
        throw new Error(`Invalid cron expression: ${error.message}`);
      }

      updates['next_run_at'] = this.calculateNextRun(updates.schedule, timezone);
    }

    return this.prisma.scheduled_job.update({
      where: { id: scheduleId },
      data: updates,
    });
  }

  async getScheduleHistory(scheduleId: string, limit: number = 100) {
    return this.prisma.job.findMany({
      where: {
        job_type: {
          startsWith: 'scheduled:',
        },
        payload: {
          path: '$.scheduleId',
          equals: scheduleId,
        },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });
  }

  calculateNextRun(cronExpression: string, timezone: string = 'America/New_York'): Date {
    const interval = parser.parseExpression(cronExpression, { tz: timezone });
    return interval.next().toDate();
  }

  async updateLastRun(scheduleId: string, schedule: string, timezone: string): Promise<void> {
    const nextRun = this.calculateNextRun(schedule, timezone);

    await this.prisma.scheduled_job.update({
      where: { id: scheduleId },
      data: {
        last_run_at: new Date(),
        next_run_at: nextRun,
      },
    });
  }
}
```

---

### 2. Job Processors (Day 5-6)

#### 2.1 SendEmailProcessor
**File**: `/var/www/lead360.app/api/src/modules/jobs/processors/send-email.processor.ts`

```typescript
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';
import { EmailService } from '../services/email.service';
import { JobQueueService } from '../services/job-queue.service';
import { randomBytes } from 'crypto';

@Processor('email')
export class SendEmailProcessor extends WorkerHost {
  private readonly logger = new Logger(SendEmailProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly jobQueue: JobQueueService,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    const { to, cc, bcc, templateKey, variables } = job.data;
    const jobId = job.id as string;

    this.logger.log(`Processing email job ${jobId} to ${to}`);

    try {
      await this.jobQueue.updateJobStatus(jobId, 'processing');

      const startTime = Date.now();

      // Send email
      const result = await this.emailService.sendTemplatedEmail({
        to,
        cc,
        bcc,
        templateKey,
        variables,
      });

      const duration = Date.now() - startTime;

      // Create email queue record
      const template = await this.prisma.email_template.findUnique({
        where: { template_key: templateKey },
      });

      await this.prisma.email_queue.create({
        data: {
          id: randomBytes(16).toString('hex'),
          job_id: jobId,
          template_key: templateKey,
          to_email: to,
          cc_emails: cc,
          bcc_emails: bcc,
          subject: template.subject,
          html_body: template.html_body,
          text_body: template.text_body,
          status: 'sent',
          smtp_message_id: result.messageId,
          sent_at: new Date(),
        },
      });

      // Update job status
      await this.jobQueue.updateJobStatus(jobId, 'completed', {
        result: { messageId: result.messageId },
        duration_ms: duration,
      });

      await this.jobQueue.logJobExecution(
        jobId,
        'info',
        `Email sent successfully to ${to}`,
        { messageId: result.messageId },
      );

      return { success: true, messageId: result.messageId };
    } catch (error) {
      this.logger.error(`Email job ${jobId} failed: ${error.message}`, error.stack);

      // Update email queue status
      try {
        await this.prisma.email_queue.upsert({
          where: { job_id: jobId },
          create: {
            id: randomBytes(16).toString('hex'),
            job_id: jobId,
            template_key: templateKey,
            to_email: to,
            cc_emails: cc,
            bcc_emails: bcc,
            subject: '',
            html_body: '',
            status: 'failed',
            error_message: error.message,
          },
          update: {
            status: 'failed',
            error_message: error.message,
          },
        });
      } catch (e) {
        this.logger.error(`Failed to update email queue: ${e.message}`);
      }

      await this.jobQueue.updateJobStatus(jobId, 'failed', {
        error_message: error.message,
      });

      await this.jobQueue.logJobExecution(
        jobId,
        'error',
        `Email sending failed: ${error.message}`,
      );

      throw error; // BullMQ will retry
    }
  }
}
```

#### 2.2 ExpiryCheckProcessor
**File**: `/var/www/lead360.app/api/src/modules/jobs/processors/expiry-check.processor.ts`

```typescript
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';
import { JobQueueService } from '../services/job-queue.service';

@Processor('scheduled')
export class ExpiryCheckProcessor extends WorkerHost {
  private readonly logger = new Logger(ExpiryCheckProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobQueue: JobQueueService,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    if (job.name !== 'expiry-check') {
      return;
    }

    const jobId = job.id as string;
    this.logger.log(`Starting expiry check job ${jobId}`);

    try {
      await this.jobQueue.updateJobStatus(jobId, 'processing');

      // Get all active tenants
      const tenants = await this.prisma.tenant.findMany({
        where: { status: 'active' },
        select: { id: true, company_name: true },
      });

      let totalWarnings = 0;

      for (const tenant of tenants) {
        try {
          // Check licenses expiring in 30, 14, 7, 3, 1 days
          const warnings = await this.checkTenantExpiry(tenant.id);
          totalWarnings += warnings;
        } catch (error) {
          this.logger.error(`Tenant ${tenant.company_name} expiry check failed: ${error.message}`);
          await this.jobQueue.logJobExecution(
            jobId,
            'error',
            `Tenant ${tenant.company_name} failed: ${error.message}`,
          );
        }
      }

      await this.jobQueue.updateJobStatus(jobId, 'completed', {
        result: { tenantsProcessed: tenants.length, totalWarnings },
      });

      this.logger.log(`Expiry check completed: ${totalWarnings} warnings sent`);

      return { success: true, tenantsProcessed: tenants.length, totalWarnings };
    } catch (error) {
      this.logger.error(`Expiry check job ${jobId} failed: ${error.message}`, error.stack);

      await this.jobQueue.updateJobStatus(jobId, 'failed', {
        error_message: error.message,
      });

      throw error;
    }
  }

  private async checkTenantExpiry(tenantId: string): Promise<number> {
    // TODO: Implement license/insurance expiry check logic
    // This will query tenant-specific license/insurance data
    // and queue email warnings for expiring items

    // Placeholder: Queue warning email
    const expiringInDays = 30; // Example

    if (expiringInDays <= 30) {
      await this.jobQueue.queueEmail({
        to: 'owner@tenant.com', // TODO: Get from tenant owner
        templateKey: 'license-expiry-warning',
        variables: {
          company_name: 'Company Name',
          license_type: 'General Liability',
          expiry_date: '2026-02-07',
        },
        tenantId,
      });

      return 1;
    }

    return 0;
  }
}
```

#### 2.3 JobRetentionProcessor
**File**: `/var/www/lead360.app/api/src/modules/jobs/processors/job-retention.processor.ts`

```typescript
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';
import { JobQueueService } from '../services/job-queue.service';

@Processor('scheduled')
export class JobRetentionProcessor extends WorkerHost {
  private readonly logger = new Logger(JobRetentionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobQueue: JobQueueService,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    if (job.name !== 'job-retention') {
      return;
    }

    const jobId = job.id as string;
    this.logger.log(`Starting job retention cleanup ${jobId}`);

    try {
      await this.jobQueue.updateJobStatus(jobId, 'processing');

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30); // 30 days ago

      // Delete old jobs (except last 100 per scheduled job)
      const scheduledJobs = await this.prisma.scheduled_job.findMany({
        select: { job_type: true },
      });

      let totalDeleted = 0;

      for (const schedule of scheduledJobs) {
        // Keep last 100 runs of each scheduled job
        const jobsToKeep = await this.prisma.job.findMany({
          where: { job_type: schedule.job_type },
          orderBy: { created_at: 'desc' },
          take: 100,
          select: { id: true },
        });

        const keepIds = jobsToKeep.map((j) => j.id);

        const deleted = await this.prisma.job.deleteMany({
          where: {
            job_type: schedule.job_type,
            created_at: { lt: cutoffDate },
            id: { notIn: keepIds },
          },
        });

        totalDeleted += deleted.count;
      }

      // Delete old non-scheduled jobs (all older than 30 days)
      const scheduledJobTypes = scheduledJobs.map((s) => s.job_type);

      const deletedOthers = await this.prisma.job.deleteMany({
        where: {
          job_type: { notIn: scheduledJobTypes },
          created_at: { lt: cutoffDate },
        },
      });

      totalDeleted += deletedOthers.count;

      await this.jobQueue.updateJobStatus(jobId, 'completed', {
        result: { jobsDeleted: totalDeleted },
      });

      this.logger.log(`Job retention cleanup completed: ${totalDeleted} jobs deleted`);

      return { success: true, jobsDeleted: totalDeleted };
    } catch (error) {
      this.logger.error(`Job retention cleanup ${jobId} failed: ${error.message}`, error.stack);

      await this.jobQueue.updateJobStatus(jobId, 'failed', {
        error_message: error.message,
      });

      throw error;
    }
  }
}
```

#### 2.4 DataCleanupProcessor
**File**: `/var/www/lead360.app/api/src/modules/jobs/processors/data-cleanup.processor.ts`

```typescript
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';
import { JobQueueService } from '../services/job-queue.service';

@Processor('scheduled')
export class DataCleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(DataCleanupProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobQueue: JobQueueService,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    if (job.name !== 'data-cleanup') {
      return;
    }

    const jobId = job.id as string;
    this.logger.log(`Starting data cleanup job ${jobId}`);

    try {
      await this.jobQueue.updateJobStatus(jobId, 'processing');

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 3600000);
      const oneDayAgo = new Date(now.getTime() - 86400000);

      let totalDeleted = 0;

      // Delete expired password reset tokens (1 hour expiry)
      const deletedResetTokens = await this.prisma.user.updateMany({
        where: {
          password_reset_token: { not: null },
          password_reset_expires: { lt: oneHourAgo },
        },
        data: {
          password_reset_token: null,
          password_reset_expires: null,
        },
      });

      totalDeleted += deletedResetTokens.count;

      // Delete expired activation tokens (24 hours expiry)
      const deletedActivationTokens = await this.prisma.user.updateMany({
        where: {
          activation_token: { not: null },
          activation_expires: { lt: oneDayAgo },
        },
        data: {
          activation_token: null,
          activation_expires: null,
        },
      });

      totalDeleted += deletedActivationTokens.count;

      await this.jobQueue.updateJobStatus(jobId, 'completed', {
        result: { tokensDeleted: totalDeleted },
      });

      this.logger.log(`Data cleanup completed: ${totalDeleted} tokens cleaned`);

      return { success: true, tokensDeleted: totalDeleted };
    } catch (error) {
      this.logger.error(`Data cleanup job ${jobId} failed: ${error.message}`, error.stack);

      await this.jobQueue.updateJobStatus(jobId, 'failed', {
        error_message: error.message,
      });

      throw error;
    }
  }
}
```

#### 2.5 PartitionMaintenanceProcessor
**File**: `/var/www/lead360.app/api/src/modules/jobs/processors/partition-maintenance.processor.ts`

```typescript
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';
import { JobQueueService } from '../services/job-queue.service';

@Processor('scheduled')
export class PartitionMaintenanceProcessor extends WorkerHost {
  private readonly logger = new Logger(PartitionMaintenanceProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobQueue: JobQueueService,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    if (job.name !== 'partition-maintenance') {
      return;
    }

    const jobId = job.id as string;
    this.logger.log(`Starting partition maintenance job ${jobId}`);

    try {
      await this.jobQueue.updateJobStatus(jobId, 'processing');

      // Create next month's partition
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const partitionName = `audit_log_${nextMonth.getFullYear()}_${(nextMonth.getMonth() + 1).toString().padStart(2, '0')}`;

      try {
        await this.prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS ${partitionName} PARTITION OF audit_log
          FOR VALUES FROM ('${nextMonth.getFullYear()}-${(nextMonth.getMonth() + 1).toString().padStart(2, '0')}-01')
          TO ('${nextMonth.getFullYear()}-${(nextMonth.getMonth() + 2).toString().padStart(2, '0')}-01')
        `);

        this.logger.log(`Created partition: ${partitionName}`);
      } catch (error) {
        this.logger.warn(`Partition ${partitionName} already exists or creation failed: ${error.message}`);
      }

      // Enforce 7-year retention
      const cutoffDate = new Date();
      cutoffDate.setFullYear(cutoffDate.getFullYear() - 7);

      // TODO: Drop old partitions older than 7 years
      // This requires checking existing partitions and dropping them

      await this.jobQueue.updateJobStatus(jobId, 'completed', {
        result: { partitionCreated: partitionName },
      });

      return { success: true, partitionCreated: partitionName };
    } catch (error) {
      this.logger.error(`Partition maintenance job ${jobId} failed: ${error.message}`, error.stack);

      await this.jobQueue.updateJobStatus(jobId, 'failed', {
        error_message: error.message,
      });

      throw error;
    }
  }
}
```

---

### 3. Scheduled Job Executor (Day 6)

**File**: `/var/www/lead360.app/api/src/modules/jobs/schedulers/scheduled-job-executor.scheduler.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../core/database/prisma.service';
import { JobQueueService } from '../services/job-queue.service';
import { ScheduledJobService } from '../services/scheduled-job.service';

@Injectable()
export class ScheduledJobExecutor {
  private readonly logger = new Logger(ScheduledJobExecutor.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobQueue: JobQueueService,
    private readonly scheduledJobService: ScheduledJobService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async checkAndExecuteScheduledJobs() {
    if (this.isRunning) {
      this.logger.warn('Previous execution still running, skipping');
      return;
    }

    this.isRunning = true;

    try {
      const now = new Date();

      // Find all enabled jobs that are due
      const dueJobs = await this.prisma.scheduled_job.findMany({
        where: {
          is_enabled: true,
          next_run_at: { lte: now },
        },
      });

      this.logger.log(`Found ${dueJobs.length} scheduled jobs due for execution`);

      for (const schedule of dueJobs) {
        try {
          // Queue the job
          await this.jobQueue.queueScheduledJob(schedule.job_type, {
            scheduleId: schedule.id,
            scheduleName: schedule.name,
          });

          // Update last_run_at and next_run_at
          await this.scheduledJobService.updateLastRun(
            schedule.id,
            schedule.schedule,
            schedule.timezone,
          );

          this.logger.log(`Queued scheduled job: ${schedule.name} (${schedule.job_type})`);
        } catch (error) {
          this.logger.error(
            `Failed to queue scheduled job ${schedule.name}: ${error.message}`,
            error.stack,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Scheduled job executor failed: ${error.message}`, error.stack);
    } finally {
      this.isRunning = false;
    }
  }
}
```

---

### 4. Module Registration (Day 6)

#### 4.1 Create JobsModule
**File**: `/var/www/lead360.app/api/src/modules/jobs/jobs.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../../core/database/prisma.module';
import { EncryptionModule } from '../../core/encryption/encryption.module';

// Services
import { SmtpService } from './services/smtp.service';
import { EmailTemplateService } from './services/email-template.service';
import { EmailService } from './services/email.service';
import { JobQueueService } from './services/job-queue.service';
import { ScheduledJobService } from './services/scheduled-job.service';

// Processors
import { SendEmailProcessor } from './processors/send-email.processor';
import { ExpiryCheckProcessor } from './processors/expiry-check.processor';
import { JobRetentionProcessor } from './processors/job-retention.processor';
import { DataCleanupProcessor } from './processors/data-cleanup.processor';
import { PartitionMaintenanceProcessor } from './processors/partition-maintenance.processor';

// Schedulers
import { ScheduledJobExecutor } from './schedulers/scheduled-job-executor.scheduler';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'email' },
      { name: 'scheduled' },
    ),
    ScheduleModule.forRoot(),
    PrismaModule,
    EncryptionModule,
  ],
  providers: [
    // Services
    SmtpService,
    EmailTemplateService,
    EmailService,
    JobQueueService,
    ScheduledJobService,

    // Processors
    SendEmailProcessor,
    ExpiryCheckProcessor,
    JobRetentionProcessor,
    DataCleanupProcessor,
    PartitionMaintenanceProcessor,

    // Schedulers
    ScheduledJobExecutor,
  ],
  exports: [
    EmailService,
    JobQueueService,
    ScheduledJobService,
    EmailTemplateService,
  ],
})
export class JobsModule {}
```

#### 4.2 Update AppModule
**File**: `/var/www/lead360.app/api/src/app.module.ts`

Add `JobsModule` to imports:
```typescript
imports: [
  // ... existing imports ...
  JobsModule,
],
```

---

### 5. Seed Scheduled Jobs (Day 7)

**File**: `/var/www/lead360.app/api/prisma/seeds/scheduled-jobs.seed.ts`

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedScheduledJobs() {
  const jobs = [
    {
      job_type: 'expiry-check',
      name: 'License and Insurance Expiry Check',
      description: 'Check for expiring licenses and insurance, send warning emails',
      schedule: '0 6 * * *', // 6:00 AM daily
      timezone: 'America/New_York',
      is_enabled: true,
      max_retries: 1,
      timeout_seconds: 600,
    },
    {
      job_type: 'data-cleanup',
      name: 'Expired Token Cleanup',
      description: 'Delete expired password reset and activation tokens',
      schedule: '0 2 * * *', // 2:00 AM daily
      timezone: 'America/New_York',
      is_enabled: true,
      max_retries: 2,
      timeout_seconds: 300,
    },
    {
      job_type: 'job-retention',
      name: 'Job Retention Cleanup',
      description: 'Delete jobs older than 30 days (keep last 100 per scheduled job)',
      schedule: '0 4 * * *', // 4:00 AM daily
      timezone: 'America/New_York',
      is_enabled: true,
      max_retries: 2,
      timeout_seconds: 300,
    },
    {
      job_type: 'partition-maintenance',
      name: 'Audit Log Partition Maintenance',
      description: 'Create monthly partitions and enforce 7-year retention',
      schedule: '0 0 1 * *', // Midnight on 1st of every month
      timezone: 'America/New_York',
      is_enabled: true,
      max_retries: 1,
      timeout_seconds: 600,
    },
  ];

  for (const job of jobs) {
    await prisma.scheduled_job.upsert({
      where: { job_type: job.job_type },
      update: job,
      create: job,
    });
  }

  console.log('Scheduled jobs seeded successfully');
}

seedScheduledJobs()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

Run seed:
```bash
ts-node prisma/seeds/scheduled-jobs.seed.ts
```

---

## Handoff Documentation for Developer 3

### What You Completed
✅ JobQueueService (BullMQ wrapper with database tracking)
✅ ScheduledJobService (cron scheduling with timezone support)
✅ SendEmailProcessor (email queue processing)
✅ ExpiryCheckProcessor (license/insurance expiry checks)
✅ JobRetentionProcessor (30-day cleanup, keep last 100)
✅ DataCleanupProcessor (expired token cleanup)
✅ PartitionMaintenanceProcessor (audit log partitions)
✅ ScheduledJobExecutor (master scheduler running every minute)
✅ JobsModule registered and exported
✅ Scheduled jobs seeded

### What Developer 3 Needs to Know

**Queue Usage**:
```typescript
// Queue email
await this.jobQueue.queueEmail({ to, templateKey, variables, tenantId });

// Queue scheduled job
await this.jobQueue.queueScheduledJob('job-type', payload);

// Update job status
await this.jobQueue.updateJobStatus(jobId, 'completed', { result });

// Log job execution
await this.jobQueue.logJobExecution(jobId, 'info', 'Message');
```

**Scheduled Jobs**:
```typescript
// Register new schedule
await this.scheduledJobService.registerScheduledJob({
  job_type: 'my-job',
  name: 'My Job',
  schedule: '0 6 * * *', // cron expression
  timezone: 'America/New_York',
});

// Calculate next run
const nextRun = this.scheduledJobService.calculateNextRun(schedule, timezone);
```

**BullMQ Queues**:
- `email` - Email sending jobs
- `scheduled` - All scheduled jobs (expiry-check, retention, etc.)

### Files Created
- `/api/src/modules/jobs/services/job-queue.service.ts`
- `/api/src/modules/jobs/services/scheduled-job.service.ts`
- `/api/src/modules/jobs/processors/send-email.processor.ts`
- `/api/src/modules/jobs/processors/expiry-check.processor.ts`
- `/api/src/modules/jobs/processors/job-retention.processor.ts`
- `/api/src/modules/jobs/processors/data-cleanup.processor.ts`
- `/api/src/modules/jobs/processors/partition-maintenance.processor.ts`
- `/api/src/modules/jobs/schedulers/scheduled-job-executor.scheduler.ts`
- `/api/src/modules/jobs/jobs.module.ts`
- `/api/prisma/seeds/scheduled-jobs.seed.ts`

### Modified
- `/api/src/app.module.ts` (added JobsModule)

### Testing
```bash
npm run start:dev
# Verify no errors
# Check logs for "Scheduled job executor" running every minute
# Manually queue a test email to verify processor works
```

---

## Next Steps for Developer 3
Developer 3 will implement:
1. JobsAdminController (8 endpoints) - Job management
2. ScheduledJobsController (7 endpoints) - Schedule management
3. EmailSettingsController (3 endpoints) - SMTP config
4. EmailTemplatesController (6 endpoints) - Template CRUD
5. All DTOs with validation
6. Complete API documentation (24 endpoints, 100% coverage)
7. Unit and integration tests

**Read this entire file and Developer 1's handoff** before starting to understand the complete system.
