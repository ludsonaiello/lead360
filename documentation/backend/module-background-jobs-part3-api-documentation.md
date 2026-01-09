# Background Jobs Module - Part 3: API Controllers & Documentation

## Developer 3 Assignment
**Focus**: REST API controllers, DTOs, validation, testing, and complete API documentation
**Timeline**: Days 8-10 (Week 2)
**Depends On**: Developer 1 (Infrastructure) + Developer 2 (Processors)
**Final Deliverable**: Production-ready API with 100% documentation

---

## Prerequisites from Developers 1 & 2

**CRITICAL**: Read both handoff documents:
- `module-background-jobs-part1-infrastructure.md` (Developer 1's work)
- `module-background-jobs-part2-processors.md` (Developer 2's work)

### What Developers 1 & 2 Completed

**Developer 1**:
✅ BullMQ upgraded (bull → bullmq)
✅ Database schema (tenant.timezone + 6 new tables)
✅ EncryptionService (AES-256-GCM for SMTP passwords)
✅ SmtpService (Nodemailer integration)
✅ EmailTemplateService (CRUD + Handlebars validation)
✅ EmailService (orchestration)

**Developer 2**:
✅ JobQueueService (BullMQ wrapper)
✅ ScheduledJobService (cron scheduling with timezone)
✅ All job processors (SendEmail, ExpiryCheck, Retention, DataCleanup, PartitionMaintenance)
✅ ScheduledJobExecutor (master scheduler)
✅ JobsModule registered

### Services Available to You

```typescript
// Inject these via constructor
constructor(
  private readonly jobQueue: JobQueueService,
  private readonly scheduledJobService: ScheduledJobService,
  private readonly emailService: EmailService,
  private readonly emailTemplateService: EmailTemplateService,
  private readonly smtpService: SmtpService,
  private readonly prisma: PrismaService,
  private readonly encryption: EncryptionService,
) {}
```

---

## Your Responsibilities

You will implement **4 controllers** with **24 endpoints total** plus complete documentation.

### 1. DTOs & Validation (Day 8)

Create all DTOs with class-validator decorators and Swagger annotations.

#### 1.1 Common DTOs
**File**: `/var/www/lead360.app/api/src/modules/jobs/dto/common.dto.ts`

```typescript
import { IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationDto {
  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}

export class PaginatedResponseDto<T> {
  data: T[];
  pagination: {
    current_page: number;
    total_pages: number;
    total_count: number;
    limit: number;
  };
}
```

#### 1.2 Job DTOs
**File**: `/var/www/lead360.app/api/src/modules/jobs/dto/job.dto.ts`

```typescript
import { IsString, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from './common.dto';

export class JobFilterDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['pending', 'processing', 'completed', 'failed'] })
  @IsOptional()
  @IsEnum(['pending', 'processing', 'completed', 'failed'])
  status?: string;

  @ApiPropertyOptional({ example: 'send-email' })
  @IsOptional()
  @IsString()
  job_type?: string;

  @ApiPropertyOptional({ example: 'tenant-id-123' })
  @IsOptional()
  @IsString()
  tenant_id?: string;

  @ApiPropertyOptional({ example: '2026-01-01T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional({ example: '2026-01-31T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  date_to?: string;
}

export class RetryJobDto {
  // No body needed - job ID comes from path parameter
}
```

#### 1.3 Scheduled Job DTOs
**File**: `/var/www/lead360.app/api/src/modules/jobs/dto/scheduled-job.dto.ts`

```typescript
import { IsString, IsBoolean, IsInt, IsOptional, Matches, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateScheduledJobDto {
  @ApiProperty({ example: 'my-custom-job' })
  @IsString()
  job_type: string;

  @ApiProperty({ example: 'Daily Report Generation' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Generate daily sales reports for all tenants' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '0 8 * * *', description: 'Cron expression (minute hour day month weekday)' })
  @IsString()
  schedule: string;

  @ApiPropertyOptional({ example: 'America/New_York' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ example: 3, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  max_retries?: number;

  @ApiPropertyOptional({ example: 300, minimum: 60 })
  @IsOptional()
  @IsInt()
  @Min(60)
  timeout_seconds?: number;
}

export class UpdateScheduledJobDto extends PartialType(CreateScheduledJobDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_enabled?: boolean;
}

export class TriggerScheduledJobDto {
  // No body needed - schedule ID comes from path parameter
}
```

#### 1.4 Email Settings DTOs
**File**: `/var/www/lead360.app/api/src/modules/jobs/dto/email-settings.dto.ts`

```typescript
import { IsString, IsInt, IsEnum, IsEmail, Min, Max, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateEmailConfigDto {
  @ApiProperty({ example: 'smtp.gmail.com' })
  @IsString()
  smtp_host: string;

  @ApiProperty({ example: 587, minimum: 1, maximum: 65535 })
  @IsInt()
  @Min(1)
  @Max(65535)
  smtp_port: number;

  @ApiProperty({ enum: ['none', 'tls', 'ssl'], example: 'tls' })
  @IsEnum(['none', 'tls', 'ssl'])
  smtp_encryption: string;

  @ApiProperty({ example: 'noreply@lead360.app' })
  @IsString()
  smtp_username: string;

  @ApiProperty({ example: 'your-smtp-password', minLength: 8 })
  @IsString()
  @MinLength(8)
  smtp_password: string;

  @ApiProperty({ example: 'noreply@lead360.app' })
  @IsEmail()
  from_email: string;

  @ApiProperty({ example: 'Lead360 Platform' })
  @IsString()
  from_name: string;
}

export class SendTestEmailDto {
  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  to_email: string;
}
```

#### 1.5 Email Template DTOs
**File**: `/var/www/lead360.app/api/src/modules/jobs/dto/email-template.dto.ts`

```typescript
import { IsString, IsArray, IsOptional, IsBoolean, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { PaginationDto } from './common.dto';

export class CreateEmailTemplateDto {
  @ApiProperty({ example: 'welcome-email' })
  @IsString()
  @MinLength(3)
  template_key: string;

  @ApiProperty({ example: 'Welcome to {{company_name}}!' })
  @IsString()
  @MinLength(3)
  subject: string;

  @ApiProperty({ example: '<h1>Welcome {{user_name}}!</h1><p>Thanks for joining.</p>' })
  @IsString()
  @MinLength(10)
  html_body: string;

  @ApiPropertyOptional({ example: 'Welcome {{user_name}}! Thanks for joining.' })
  @IsOptional()
  @IsString()
  text_body?: string;

  @ApiProperty({ example: ['user_name', 'company_name'], type: [String] })
  @IsArray()
  @IsString({ each: true })
  variables: string[];

  @ApiPropertyOptional({ example: 'Welcome email sent to new users' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateEmailTemplateDto extends PartialType(CreateEmailTemplateDto) {
  @ApiPropertyOptional()
  template_key?: never; // Cannot update template_key
}

export class PreviewEmailTemplateDto {
  @ApiProperty({
    example: { user_name: 'John Doe', company_name: 'Acme Corp' },
    description: 'Variables to use for rendering the template'
  })
  variables: Record<string, any>;
}

export class EmailTemplateFilterDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'password' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  is_system?: boolean;
}
```

---

### 2. Controllers Implementation (Day 8-9)

#### 2.1 JobsAdminController (8 endpoints)
**File**: `/var/www/lead360.app/api/src/modules/jobs/controllers/jobs-admin.controller.ts`

```typescript
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../rbac/guards/platform-admin.guard';
import { PrismaService } from '../../../core/database/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JobFilterDto } from '../dto/job.dto';
import { PaginatedResponseDto } from '../dto/common.dto';

@ApiTags('Background Jobs - Admin')
@ApiBearerAuth()
@Controller('api/v1/admin/jobs')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class JobsAdminController {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('email') private emailQueue: Queue,
    @InjectQueue('scheduled') private scheduledQueue: Queue,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all jobs with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Jobs retrieved successfully' })
  async listJobs(@Query() filters: JobFilterDto): Promise<PaginatedResponseDto<any>> {
    const { page = 1, limit = 50, status, job_type, tenant_id, date_from, date_to } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (job_type) where.job_type = job_type;
    if (tenant_id) where.tenant_id = tenant_id;
    if (date_from || date_to) {
      where.created_at = {};
      if (date_from) where.created_at.gte = new Date(date_from);
      if (date_to) where.created_at.lte = new Date(date_to);
    }

    const [jobs, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.job.count({ where }),
    ]);

    return {
      data: jobs,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(total / limit),
        total_count: total,
        limit,
      },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get job details with logs' })
  @ApiResponse({ status: 200, description: 'Job details retrieved' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async getJob(@Param('id') id: string) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: {
        job_log: {
          orderBy: { timestamp: 'asc' },
        },
        email_queue: true,
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return job;
  }

  @Post(':id/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry a failed job' })
  @ApiResponse({ status: 200, description: 'Job requeued successfully' })
  @ApiResponse({ status: 400, description: 'Job cannot be retried' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async retryJob(@Param('id') id: string) {
    const job = await this.prisma.job.findUnique({ where: { id } });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.status !== 'failed') {
      throw new BadRequestException('Only failed jobs can be retried');
    }

    // Reset job status
    await this.prisma.job.update({
      where: { id },
      data: {
        status: 'pending',
        started_at: null,
        failed_at: null,
        error_message: null,
      },
    });

    // Re-queue to appropriate queue
    const queue = job.job_type === 'send-email' ? this.emailQueue : this.scheduledQueue;
    await queue.add(job.job_type, job.payload, { jobId: id });

    return { message: 'Job requeued successfully', job_id: id };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a specific job' })
  @ApiResponse({ status: 204, description: 'Job deleted successfully' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async deleteJob(@Param('id') id: string) {
    await this.prisma.job.delete({ where: { id } });
  }

  @Get('failed/list')
  @ApiOperation({ summary: 'List all failed jobs' })
  @ApiResponse({ status: 200, description: 'Failed jobs retrieved' })
  async listFailedJobs(@Query() filters: JobFilterDto) {
    return this.listJobs({ ...filters, status: 'failed' });
  }

  @Post('failed/retry-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry all failed jobs' })
  @ApiResponse({ status: 200, description: 'All failed jobs requeued' })
  async retryAllFailedJobs() {
    const failedJobs = await this.prisma.job.findMany({
      where: { status: 'failed' },
    });

    for (const job of failedJobs) {
      await this.retryJob(job.id);
    }

    return {
      message: `${failedJobs.length} failed jobs requeued successfully`,
      count: failedJobs.length,
    };
  }

  @Delete('failed/clear')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear all failed jobs from database' })
  @ApiResponse({ status: 200, description: 'Failed jobs cleared' })
  async clearFailedJobs() {
    const result = await this.prisma.job.deleteMany({
      where: { status: 'failed' },
    });

    return {
      message: `${result.count} failed jobs deleted`,
      count: result.count,
    };
  }

  @Get('health/status')
  @ApiOperation({ summary: 'Get queue health metrics' })
  @ApiResponse({ status: 200, description: 'Queue health retrieved' })
  async getQueueHealth() {
    const [emailCounts, scheduledCounts] = await Promise.all([
      this.emailQueue.getJobCounts(),
      this.scheduledQueue.getJobCounts(),
    ]);

    const jobStats = await this.prisma.job.groupBy({
      by: ['status'],
      _count: true,
    });

    return {
      queues: {
        email: emailCounts,
        scheduled: scheduledCounts,
      },
      database: jobStats.reduce((acc, stat) => {
        acc[stat.status] = stat._count;
        return acc;
      }, {}),
    };
  }
}
```

#### 2.2 ScheduledJobsController (7 endpoints)
**File**: `/var/www/lead360.app/api/src/modules/jobs/controllers/scheduled-jobs.controller.ts`

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../rbac/guards/platform-admin.guard';
import { ScheduledJobService } from '../services/scheduled-job.service';
import { JobQueueService } from '../services/job-queue.service';
import { PrismaService } from '../../../core/database/prisma.service';
import {
  CreateScheduledJobDto,
  UpdateScheduledJobDto,
} from '../dto/scheduled-job.dto';
import { PaginationDto } from '../dto/common.dto';

@ApiTags('Background Jobs - Scheduled Jobs')
@ApiBearerAuth()
@Controller('api/v1/admin/jobs/schedules')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class ScheduledJobsController {
  constructor(
    private readonly scheduledJobService: ScheduledJobService,
    private readonly jobQueue: JobQueueService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all scheduled jobs' })
  @ApiResponse({ status: 200, description: 'Scheduled jobs retrieved' })
  async listScheduledJobs(@Query() pagination: PaginationDto) {
    const { page = 1, limit = 50 } = pagination;
    const skip = (page - 1) * limit;

    const [schedules, total] = await Promise.all([
      this.prisma.scheduled_job.findMany({
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.scheduled_job.count(),
    ]);

    return {
      data: schedules,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(total / limit),
        total_count: total,
        limit,
      },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get scheduled job details' })
  @ApiResponse({ status: 200, description: 'Scheduled job retrieved' })
  @ApiResponse({ status: 404, description: 'Scheduled job not found' })
  async getScheduledJob(@Param('id') id: string) {
    const schedule = await this.prisma.scheduled_job.findUnique({
      where: { id },
    });

    if (!schedule) {
      throw new NotFoundException('Scheduled job not found');
    }

    return schedule;
  }

  @Post()
  @ApiOperation({ summary: 'Create a new scheduled job' })
  @ApiResponse({ status: 201, description: 'Scheduled job created' })
  @ApiResponse({ status: 400, description: 'Invalid cron expression or data' })
  async createScheduledJob(@Body() dto: CreateScheduledJobDto) {
    return this.scheduledJobService.registerScheduledJob(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update scheduled job configuration' })
  @ApiResponse({ status: 200, description: 'Scheduled job updated' })
  @ApiResponse({ status: 404, description: 'Scheduled job not found' })
  async updateScheduledJob(
    @Param('id') id: string,
    @Body() dto: UpdateScheduledJobDto,
  ) {
    return this.scheduledJobService.updateSchedule(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a scheduled job' })
  @ApiResponse({ status: 204, description: 'Scheduled job deleted' })
  async deleteScheduledJob(@Param('id') id: string) {
    await this.prisma.scheduled_job.delete({ where: { id } });
  }

  @Post(':id/trigger')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually trigger a scheduled job to run immediately' })
  @ApiResponse({ status: 200, description: 'Job triggered successfully' })
  async triggerScheduledJob(@Param('id') id: string) {
    const schedule = await this.prisma.scheduled_job.findUnique({ where: { id } });

    if (!schedule) {
      throw new NotFoundException('Scheduled job not found');
    }

    const { jobId } = await this.jobQueue.queueScheduledJob(schedule.job_type, {
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      manualTrigger: true,
    });

    return {
      message: 'Job triggered successfully',
      job_id: jobId,
    };
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get last 100 execution runs for a scheduled job' })
  @ApiResponse({ status: 200, description: 'Execution history retrieved' })
  async getScheduleHistory(@Param('id') id: string, @Query('limit') limit: number = 100) {
    return this.scheduledJobService.getScheduleHistory(id, limit);
  }
}
```

#### 2.3 EmailSettingsController (3 endpoints)
**File**: `/var/www/lead360.app/api/src/modules/jobs/controllers/email-settings.controller.ts`

```typescript
import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../rbac/guards/platform-admin.guard';
import { PrismaService } from '../../../core/database/prisma.service';
import { EncryptionService } from '../../../core/encryption/encryption.service';
import { SmtpService } from '../services/smtp.service';
import { EmailService } from '../services/email.service';
import { UpdateEmailConfigDto, SendTestEmailDto } from '../dto/email-settings.dto';
import { randomBytes } from 'crypto';

@ApiTags('Background Jobs - Email Settings')
@ApiBearerAuth()
@Controller('api/v1/admin/jobs/email-settings')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class EmailSettingsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly smtpService: SmtpService,
    private readonly emailService: EmailService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get current SMTP configuration (password masked)' })
  @ApiResponse({ status: 200, description: 'SMTP config retrieved' })
  async getEmailConfig() {
    const config = await this.prisma.platform_email_config.findFirst();

    if (!config) {
      return null;
    }

    return {
      ...config,
      smtp_password: '********', // Mask password
    };
  }

  @Patch()
  @ApiOperation({ summary: 'Update SMTP configuration' })
  @ApiResponse({ status: 200, description: 'SMTP config updated' })
  @ApiResponse({ status: 400, description: 'Invalid SMTP configuration' })
  async updateEmailConfig(@Body() dto: UpdateEmailConfigDto) {
    // Encrypt password
    const encryptedPassword = this.encryption.encrypt(dto.smtp_password);

    // Try to find existing config
    const existing = await this.prisma.platform_email_config.findFirst();

    let config;
    if (existing) {
      config = await this.prisma.platform_email_config.update({
        where: { id: existing.id },
        data: {
          smtp_host: dto.smtp_host,
          smtp_port: dto.smtp_port,
          smtp_encryption: dto.smtp_encryption,
          smtp_username: dto.smtp_username,
          smtp_password: encryptedPassword,
          from_email: dto.from_email,
          from_name: dto.from_name,
          is_verified: false, // Reset verification
        },
      });
    } else {
      config = await this.prisma.platform_email_config.create({
        data: {
          id: randomBytes(16).toString('hex'),
          smtp_host: dto.smtp_host,
          smtp_port: dto.smtp_port,
          smtp_encryption: dto.smtp_encryption,
          smtp_username: dto.smtp_username,
          smtp_password: encryptedPassword,
          from_email: dto.from_email,
          from_name: dto.from_name,
          is_verified: false,
        },
      });
    }

    // Reinitialize SMTP transporter
    await this.smtpService.initializeTransporter();

    return {
      ...config,
      smtp_password: '********',
    };
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send test email to verify SMTP configuration' })
  @ApiResponse({ status: 200, description: 'Test email sent successfully' })
  @ApiResponse({ status: 400, description: 'SMTP configuration error' })
  async sendTestEmail(@Body() dto: SendTestEmailDto) {
    try {
      const result = await this.emailService.sendTemplatedEmail({
        to: dto.to_email,
        templateKey: 'test-email',
        variables: {},
      });

      // Mark config as verified
      const config = await this.prisma.platform_email_config.findFirst();
      await this.prisma.platform_email_config.update({
        where: { id: config.id },
        data: { is_verified: true },
      });

      return {
        message: 'Test email sent successfully',
        messageId: result.messageId,
      };
    } catch (error) {
      throw new Error(`SMTP test failed: ${error.message}`);
    }
  }
}
```

#### 2.4 EmailTemplatesController (6 endpoints)
**File**: `/var/www/lead360.app/api/src/modules/jobs/controllers/email-templates.controller.ts`

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../rbac/guards/platform-admin.guard';
import { EmailTemplateService } from '../services/email-template.service';
import {
  CreateEmailTemplateDto,
  UpdateEmailTemplateDto,
  PreviewEmailTemplateDto,
  EmailTemplateFilterDto,
} from '../dto/email-template.dto';

@ApiTags('Background Jobs - Email Templates')
@ApiBearerAuth()
@Controller('api/v1/admin/jobs/email-templates')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class EmailTemplatesController {
  constructor(private readonly emailTemplateService: EmailTemplateService) {}

  @Get()
  @ApiOperation({ summary: 'List all email templates with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Email templates retrieved' })
  async listTemplates(@Query() filters: EmailTemplateFilterDto) {
    const templates = await this.emailTemplateService.getAllTemplates({
      search: filters.search,
      is_system: filters.is_system,
    });

    return { data: templates };
  }

  @Get(':templateKey')
  @ApiOperation({ summary: 'Get specific email template details' })
  @ApiResponse({ status: 200, description: 'Template retrieved' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async getTemplate(@Param('templateKey') templateKey: string) {
    return this.emailTemplateService.getTemplate(templateKey);
  }

  @Post()
  @ApiOperation({ summary: 'Create new email template' })
  @ApiResponse({ status: 201, description: 'Template created' })
  @ApiResponse({ status: 400, description: 'Invalid Handlebars syntax or duplicate key' })
  async createTemplate(@Body() dto: CreateEmailTemplateDto) {
    return this.emailTemplateService.createTemplate(dto);
  }

  @Patch(':templateKey')
  @ApiOperation({ summary: 'Update email template' })
  @ApiResponse({ status: 200, description: 'Template updated' })
  @ApiResponse({ status: 400, description: 'Cannot modify system template or invalid syntax' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async updateTemplate(
    @Param('templateKey') templateKey: string,
    @Body() dto: UpdateEmailTemplateDto,
  ) {
    return this.emailTemplateService.updateTemplate(templateKey, dto);
  }

  @Delete(':templateKey')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete email template' })
  @ApiResponse({ status: 204, description: 'Template deleted' })
  @ApiResponse({ status: 400, description: 'Cannot delete system template' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async deleteTemplate(@Param('templateKey') templateKey: string) {
    await this.emailTemplateService.deleteTemplate(templateKey);
  }

  @Post(':templateKey/preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Preview rendered email template with sample variables' })
  @ApiResponse({ status: 200, description: 'Template rendered successfully' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async previewTemplate(
    @Param('templateKey') templateKey: string,
    @Body() dto: PreviewEmailTemplateDto,
  ) {
    const template = await this.emailTemplateService.getTemplate(templateKey);

    const renderedSubject = this.emailTemplateService.renderTemplate(
      template.subject,
      dto.variables,
    );
    const renderedHtml = this.emailTemplateService.renderTemplate(
      template.html_body,
      dto.variables,
    );
    const renderedText = template.text_body
      ? this.emailTemplateService.renderTemplate(template.text_body, dto.variables)
      : null;

    return {
      subject: renderedSubject,
      html_body: renderedHtml,
      text_body: renderedText,
    };
  }
}
```

---

### 3. Update JobsModule (Day 9)

**File**: `/var/www/lead360.app/api/src/modules/jobs/jobs.module.ts`

Add controllers to the module:

```typescript
import { JobsAdminController } from './controllers/jobs-admin.controller';
import { ScheduledJobsController } from './controllers/scheduled-jobs.controller';
import { EmailSettingsController } from './controllers/email-settings.controller';
import { EmailTemplatesController } from './controllers/email-templates.controller';

@Module({
  // ... existing imports and providers ...
  controllers: [
    JobsAdminController,
    ScheduledJobsController,
    EmailSettingsController,
    EmailTemplatesController,
  ],
  // ... existing exports ...
})
export class JobsModule {}
```

---

### 4. Testing (Day 9-10)

#### 4.1 Unit Tests
Create test files for each controller.

**Example**: `/var/www/lead360.app/api/src/modules/jobs/controllers/jobs-admin.controller.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { JobsAdminController } from './jobs-admin.controller';
import { PrismaService } from '../../../core/database/prisma.service';
import { getQueueToken } from '@nestjs/bullmq';

describe('JobsAdminController', () => {
  let controller: JobsAdminController;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [JobsAdminController],
      providers: [
        {
          provide: PrismaService,
          useValue: {
            job: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
              deleteMany: jest.fn(),
              groupBy: jest.fn(),
            },
          },
        },
        {
          provide: getQueueToken('email'),
          useValue: {
            add: jest.fn(),
            getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0 }),
          },
        },
        {
          provide: getQueueToken('scheduled'),
          useValue: {
            add: jest.fn(),
            getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0 }),
          },
        },
      ],
    }).compile();

    controller = module.get<JobsAdminController>(JobsAdminController);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should list jobs with pagination', async () => {
    const mockJobs = [{ id: '1', status: 'completed' }];
    jest.spyOn(prisma.job, 'findMany').mockResolvedValue(mockJobs as any);
    jest.spyOn(prisma.job, 'count').mockResolvedValue(1);

    const result = await controller.listJobs({ page: 1, limit: 50 });

    expect(result.data).toEqual(mockJobs);
    expect(result.pagination.total_count).toBe(1);
  });

  it('should get queue health metrics', async () => {
    jest.spyOn(prisma.job, 'groupBy').mockResolvedValue([
      { status: 'completed', _count: 10 },
      { status: 'failed', _count: 2 },
    ] as any);

    const result = await controller.getQueueHealth();

    expect(result.queues).toBeDefined();
    expect(result.database).toBeDefined();
  });

  // Add more tests for other endpoints...
});
```

#### 4.2 Integration Tests
Test actual API endpoints.

**File**: `/var/www/lead360.app/api/test/jobs/jobs-admin.e2e-spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('JobsAdminController (e2e)', () => {
  let app: INestApplication;
  let authToken: string; // Platform admin JWT

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // TODO: Get platform admin JWT token for tests
    authToken = 'your-test-token';
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/v1/admin/jobs (GET) - should list jobs', () => {
    return request(app.getHttpServer())
      .get('/api/v1/admin/jobs')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.data).toBeDefined();
        expect(res.body.pagination).toBeDefined();
      });
  });

  it('/api/v1/admin/jobs/health/status (GET) - should return health metrics', () => {
    return request(app.getHttpServer())
      .get('/api/v1/admin/jobs/health/status')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.queues).toBeDefined();
        expect(res.body.database).toBeDefined();
      });
  });

  // Add more e2e tests...
});
```

---

### 5. Complete API Documentation (Day 10)

**CRITICAL**: This must be 100% complete - frontend depends on it.

**File**: `/var/www/lead360.app/api/documentation/background_jobs_REST_API.md`

Create comprehensive documentation covering:
1. All 24 endpoints (paths, methods, request/response schemas)
2. Authentication requirements
3. Error codes and responses
4. Example curl requests
5. Cron expression guide
6. Testing guide

(See the detailed API documentation template in the original part3 plan - it's too large to include here but MUST be created with 100% coverage of all endpoints, request schemas, response schemas, error codes, and examples)

---

## Handoff Documentation

### What You Completed
✅ 24 API endpoints implemented (4 controllers)
✅ All DTOs with validation and Swagger decorators
✅ 100% API documentation (background_jobs_REST_API.md)
✅ Unit tests for all controllers
✅ Integration tests
✅ Swagger/OpenAPI accessible at `/api/docs`

### Files Created
**Controllers**:
- `/api/src/modules/jobs/controllers/jobs-admin.controller.ts`
- `/api/src/modules/jobs/controllers/scheduled-jobs.controller.ts`
- `/api/src/modules/jobs/controllers/email-settings.controller.ts`
- `/api/src/modules/jobs/controllers/email-templates.controller.ts`

**DTOs**:
- `/api/src/modules/jobs/dto/common.dto.ts`
- `/api/src/modules/jobs/dto/job.dto.ts`
- `/api/src/modules/jobs/dto/scheduled-job.dto.ts`
- `/api/src/modules/jobs/dto/email-settings.dto.ts`
- `/api/src/modules/jobs/dto/email-template.dto.ts`

**Documentation**:
- `/api/documentation/background_jobs_REST_API.md` (100% coverage)

**Tests**:
- `/api/src/modules/jobs/controllers/*.spec.ts`
- `/api/test/jobs/*.e2e-spec.ts`

### Modified
- `/api/src/modules/jobs/jobs.module.ts` (added controllers)

### Testing Commands
```bash
npm run test                    # Run unit tests
npm run test:e2e               # Run integration tests
npm run start:dev              # Start server
# Access Swagger: https://api.lead360.app/api/docs
```

### API Base URL
```
https://api.lead360.app/api/v1
```

### Authentication
All endpoints require:
- Bearer JWT token
- Platform Admin role (`is_platform_admin: true`)

---

## Summary

**24 Endpoints Implemented**:
- JobsAdminController: 8 endpoints (list, get, retry, delete, failed, retry-all, clear, health)
- ScheduledJobsController: 7 endpoints (list, get, create, update, delete, trigger, history)
- EmailSettingsController: 3 endpoints (get, update, test)
- EmailTemplatesController: 6 endpoints (list, get, create, update, delete, preview)

**Backend Status**: ✅ **Ready for Frontend**

The backend is production-ready with complete API documentation for the frontend team to begin building the job monitoring dashboard.
