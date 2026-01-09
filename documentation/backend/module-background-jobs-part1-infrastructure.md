# Background Jobs Module - Part 1: Infrastructure & Core Services

## Developer 1 Assignment
**Focus**: BullMQ migration, database schema, encryption service, and email core services
**Timeline**: Days 1-4 (Week 1)
**Handoff To**: Developer 2 (Job Processors & Scheduling)

---

## User Decisions (Critical Context)
- ✅ **Queue Library**: Upgrade to `bullmq` (v5.x) - Migrate existing queues from `bull` to `bullmq`
- ✅ **Timezone Handling**: Add `timezone` field to tenant table (default: 'America/New_York')
- ✅ **Template Editing**: Full CRUD for email templates via API with Handlebars validation

---

## Your Responsibilities

### 1. BullMQ Migration (Day 1 - CRITICAL BLOCKER)
**Why First**: All subsequent work depends on BullMQ being operational

#### 1.1 Install Dependencies
```bash
cd /var/www/lead360.app/api
npm uninstall bull @nestjs/bull
npm install bullmq@^5.30.7 @nestjs/bullmq@^10.3.0
```

#### 1.2 Update app.module.ts
**File**: `/var/www/lead360.app/api/src/app.module.ts`

**Change**:
```typescript
// OLD
import { BullModule } from '@nestjs/bull';

// NEW
import { BullModule } from '@nestjs/bullmq';
```

**Keep the configuration the same** (Redis connection already correct).

#### 1.3 Migrate Audit Log Queue
**Files to Update**:
- `/api/src/modules/audit/audit.module.ts`
- `/api/src/modules/audit/jobs/audit-log-write.job.ts`

**Pattern**:
```typescript
// OLD (bull)
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';

@Processor('audit-log-write')
export class AuditLogWriteJob {
  @Process('write-log')
  async handleWriteLog(job: Job<CreateAuditLogDto>) {
    // Implementation
  }
}

// NEW (bullmq)
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('audit-log-write')
export class AuditLogWriteJob extends WorkerHost {
  async process(job: Job<CreateAuditLogDto, any, string>): Promise<any> {
    // Same implementation
    return { success: true };
  }
}
```

#### 1.4 Migrate File Cleanup Queue
**Files to Update**:
- `/api/src/modules/files/files.module.ts`
- `/api/src/modules/files/processors/file-cleanup.processor.ts`
- `/api/src/modules/files/schedulers/file-cleanup.scheduler.ts`

**Apply same pattern as audit queue**.

#### 1.5 Test Existing Queues
```bash
npm run start:dev
# Verify no errors
# Test that audit logging still works
# Test that file cleanup still works
```

**BLOCKER CHECKPOINT**: Do not proceed to Phase 2 until both queues work with BullMQ.

---

### 2. Database Schema (Day 1-2)

#### 2.1 Update Prisma Schema
**File**: `/var/www/lead360.app/api/prisma/schema.prisma`

**Add to tenant model**:
```prisma
model tenant {
  // ... existing fields ...
  timezone    String   @default("America/New_York")
  // ... rest of model ...
}
```

**Add 6 new models**:

```prisma
model job {
  id            String    @id @default(uuid())
  job_type      String    @db.VarChar(100)
  status        String    @db.VarChar(50) // pending, processing, completed, failed
  tenant_id     String?   @db.VarChar(36)
  payload       Json?
  result        Json?
  error_message String?   @db.Text
  attempts      Int       @default(0)
  max_retries   Int       @default(3)
  created_at    DateTime  @default(now())
  started_at    DateTime?
  completed_at  DateTime?
  failed_at     DateTime?
  duration_ms   Int?

  job_log       job_log[]
  email_queue   email_queue?

  @@index([tenant_id, status, created_at])
  @@index([job_type, status])
  @@index([status, created_at])
}

model job_log {
  id         String   @id @default(uuid())
  job_id     String   @db.VarChar(36)
  timestamp  DateTime @default(now())
  level      String   @db.VarChar(20) // info, warn, error
  message    String   @db.Text
  metadata   Json?

  job        job      @relation(fields: [job_id], references: [id], onDelete: Cascade)

  @@index([job_id, timestamp])
}

model scheduled_job {
  id              String    @id @default(uuid())
  job_type        String    @db.VarChar(100)
  name            String    @db.VarChar(200)
  description     String?   @db.Text
  schedule        String    @db.VarChar(100) // cron expression
  timezone        String    @db.VarChar(100) @default("America/New_York")
  is_enabled      Boolean   @default(true)
  last_run_at     DateTime?
  next_run_at     DateTime?
  max_retries     Int       @default(3)
  timeout_seconds Int       @default(300)
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt

  @@index([is_enabled, next_run_at])
  @@index([job_type])
}

model platform_email_config {
  id                String    @id @default(uuid())
  smtp_host         String    @db.VarChar(255)
  smtp_port         Int
  smtp_encryption   String    @db.VarChar(20) @default("tls") // none, tls, ssl
  smtp_username     String    @db.VarChar(255)
  smtp_password     String    @db.Text // encrypted
  from_email        String    @db.VarChar(255)
  from_name         String    @db.VarChar(255)
  is_verified       Boolean   @default(false)
  updated_at        DateTime  @updatedAt
  updated_by_user_id String?  @db.VarChar(36)
}

model email_template {
  id            String    @id @default(uuid())
  template_key  String    @unique @db.VarChar(100)
  subject       String    @db.VarChar(500)
  html_body     String    @db.Text
  text_body     String?   @db.Text
  variables     Json      // Array of variable names
  description   String?   @db.Text
  is_system     Boolean   @default(false) // System templates cannot be deleted
  created_at    DateTime  @default(now())
  updated_at    DateTime  @updatedAt

  @@index([template_key])
  @@index([is_system])
}

model email_queue {
  id                String    @id @default(uuid())
  job_id            String    @unique @db.VarChar(36)
  template_key      String?   @db.VarChar(100)
  to_email          String    @db.VarChar(255)
  cc_emails         Json?     // Array of emails
  bcc_emails        Json?     // Array of emails
  subject           String    @db.VarChar(500)
  html_body         String    @db.Text
  text_body         String?   @db.Text
  status            String    @db.VarChar(50) @default("pending") // pending, sent, failed
  smtp_message_id   String?   @db.VarChar(255)
  error_message     String?   @db.Text
  sent_at           DateTime?
  created_at        DateTime  @default(now())

  job               job       @relation(fields: [job_id], references: [id], onDelete: Cascade)

  @@index([status, created_at])
  @@index([job_id])
}
```

#### 2.2 Create Migration
```bash
npx prisma migrate dev --name add_background_jobs_and_timezone
```

#### 2.3 Seed Email Templates
**File**: `/var/www/lead360.app/api/prisma/seeds/email-templates.seed.ts`

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedEmailTemplates() {
  const templates = [
    {
      template_key: 'password-reset',
      subject: 'Reset Your Password - Lead360',
      html_body: `
        <h1>Password Reset Request</h1>
        <p>Hello {{user_name}},</p>
        <p>Click the link below to reset your password:</p>
        <a href="{{reset_link}}">Reset Password</a>
        <p>This link expires in 1 hour.</p>
      `,
      text_body: 'Hello {{user_name}}, Reset your password: {{reset_link}}',
      variables: ['user_name', 'reset_link'],
      description: 'Password reset email',
      is_system: true,
    },
    {
      template_key: 'account-activation',
      subject: 'Activate Your Account - Lead360',
      html_body: `
        <h1>Welcome to Lead360!</h1>
        <p>Hello {{user_name}},</p>
        <p>Click the link below to activate your account:</p>
        <a href="{{activation_link}}">Activate Account</a>
      `,
      text_body: 'Welcome {{user_name}}! Activate: {{activation_link}}',
      variables: ['user_name', 'activation_link'],
      description: 'Account activation email',
      is_system: true,
    },
    {
      template_key: 'license-expiry-warning',
      subject: 'License Expiring Soon - {{company_name}}',
      html_body: `
        <h1>License Expiry Warning</h1>
        <p>Your {{license_type}} license will expire on {{expiry_date}}.</p>
        <p>Please renew to avoid service interruption.</p>
      `,
      text_body: 'License expiry: {{license_type}} expires {{expiry_date}}',
      variables: ['company_name', 'license_type', 'expiry_date'],
      description: 'License expiry warning email',
      is_system: true,
    },
    {
      template_key: 'test-email',
      subject: 'Test Email - Lead360',
      html_body: '<h1>SMTP Configuration Test</h1><p>If you receive this, your SMTP settings are correct.</p>',
      text_body: 'SMTP test successful',
      variables: [],
      description: 'SMTP test email',
      is_system: true,
    },
  ];

  for (const template of templates) {
    await prisma.email_template.upsert({
      where: { template_key: template.template_key },
      update: template,
      create: template,
    });
  }

  console.log('Email templates seeded successfully');
}

seedEmailTemplates()
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
ts-node prisma/seeds/email-templates.seed.ts
```

---

### 3. Encryption Service (Day 2 - CRITICAL)

#### 3.1 Generate Encryption Key
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add to `.env`:
```
ENCRYPTION_KEY=<paste the 64-character hex string>
```

#### 3.2 Create EncryptionModule
**File**: `/var/www/lead360.app/api/src/core/encryption/encryption.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';

@Module({
  providers: [EncryptionService],
  exports: [EncryptionService],
})
export class EncryptionModule {}
```

#### 3.3 Create EncryptionService
**File**: `/var/www/lead360.app/api/src/core/encryption/encryption.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const keyHex = this.configService.get<string>('ENCRYPTION_KEY');

    if (!keyHex || keyHex.length !== 64) {
      throw new Error(
        'ENCRYPTION_KEY must be a 64-character hex string. ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    }

    this.key = Buffer.from(keyHex, 'hex');
  }

  encrypt(text: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.key, iv);

    const encrypted = Buffer.concat([
      cipher.update(text, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return JSON.stringify({
      iv: iv.toString('hex'),
      encrypted: encrypted.toString('hex'),
      authTag: authTag.toString('hex'),
    });
  }

  decrypt(encryptedData: string): string {
    const { iv, encrypted, authTag } = JSON.parse(encryptedData);

    const decipher = createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(iv, 'hex'),
    );

    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    return (
      decipher.update(Buffer.from(encrypted, 'hex'), undefined, 'utf8') +
      decipher.final('utf8')
    );
  }
}
```

#### 3.4 Test Encryption
**File**: `/var/www/lead360.app/api/src/core/encryption/encryption.service.spec.ts`

```typescript
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        EncryptionService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
          },
        },
      ],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
  });

  it('should encrypt and decrypt correctly', () => {
    const plaintext = 'my-smtp-password-123';
    const encrypted = service.encrypt(plaintext);
    const decrypted = service.decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
    expect(encrypted).not.toBe(plaintext);
  });

  it('should produce different ciphertexts for same plaintext', () => {
    const plaintext = 'test';
    const encrypted1 = service.encrypt(plaintext);
    const encrypted2 = service.encrypt(plaintext);

    expect(encrypted1).not.toBe(encrypted2);
    expect(service.decrypt(encrypted1)).toBe(plaintext);
    expect(service.decrypt(encrypted2)).toBe(plaintext);
  });
});
```

---

### 4. Email Core Services (Day 2-3)

#### 4.1 Install Dependencies
```bash
npm install nodemailer@^6.9.0 handlebars@^4.7.8 cron-parser@^4.9.0
npm install --save-dev @types/nodemailer@^6.4.0
```

#### 4.2 SmtpService
**File**: `/var/www/lead360.app/api/src/modules/jobs/services/smtp.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { EncryptionService } from '../../../core/encryption/encryption.service';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class SmtpService {
  private readonly logger = new Logger(SmtpService.name);
  private transporter: Transporter;
  private lastConfigUpdate: Date;

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async initializeTransporter(): Promise<void> {
    const config = await this.prisma.platform_email_config.findFirst();

    if (!config) {
      throw new Error('SMTP configuration not found');
    }

    const password = this.encryption.decrypt(config.smtp_password);

    this.transporter = nodemailer.createTransport({
      host: config.smtp_host,
      port: config.smtp_port,
      secure: config.smtp_encryption === 'ssl',
      auth: {
        user: config.smtp_username,
        pass: password,
      },
      pool: true,
      maxConnections: 5,
    });

    this.lastConfigUpdate = config.updated_at;
    this.logger.log('SMTP transporter initialized');
  }

  async sendEmail(options: {
    to: string;
    cc?: string[];
    bcc?: string[];
    subject: string;
    html: string;
    text?: string;
  }): Promise<{ messageId: string }> {
    if (!this.transporter || await this.configChanged()) {
      await this.initializeTransporter();
    }

    const config = await this.prisma.platform_email_config.findFirst();

    const info = await this.transporter.sendMail({
      from: `"${config.from_name}" <${config.from_email}>`,
      to: options.to,
      cc: options.cc?.join(', '),
      bcc: options.bcc?.join(', '),
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    return { messageId: info.messageId };
  }

  async verifyConnection(): Promise<boolean> {
    try {
      if (!this.transporter) {
        await this.initializeTransporter();
      }
      await this.transporter.verify();
      return true;
    } catch (error) {
      this.logger.error(`SMTP verification failed: ${error.message}`);
      return false;
    }
  }

  private async configChanged(): Promise<boolean> {
    const config = await this.prisma.platform_email_config.findFirst();
    return config && config.updated_at > this.lastConfigUpdate;
  }
}
```

#### 4.3 EmailTemplateService
**File**: `/var/www/lead360.app/api/src/modules/jobs/services/email-template.service.ts`

```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import * as Handlebars from 'handlebars';

@Injectable()
export class EmailTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async getTemplate(templateKey: string) {
    const template = await this.prisma.email_template.findUnique({
      where: { template_key: templateKey },
    });

    if (!template) {
      throw new NotFoundException(`Template ${templateKey} not found`);
    }

    return template;
  }

  async getAllTemplates(filters?: { search?: string; is_system?: boolean }) {
    return this.prisma.email_template.findMany({
      where: {
        ...(filters?.search && {
          OR: [
            { template_key: { contains: filters.search } },
            { description: { contains: filters.search } },
          ],
        }),
        ...(filters?.is_system !== undefined && { is_system: filters.is_system }),
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async createTemplate(data: {
    template_key: string;
    subject: string;
    html_body: string;
    text_body?: string;
    variables: string[];
    description?: string;
  }) {
    // Validate Handlebars syntax
    const validation = this.validateHandlebars(data.html_body);
    if (!validation.valid) {
      throw new BadRequestException(`Invalid HTML template: ${validation.error}`);
    }

    if (data.text_body) {
      const textValidation = this.validateHandlebars(data.text_body);
      if (!textValidation.valid) {
        throw new BadRequestException(`Invalid text template: ${textValidation.error}`);
      }
    }

    return this.prisma.email_template.create({
      data: {
        ...data,
        is_system: false,
      },
    });
  }

  async updateTemplate(templateKey: string, data: Partial<{
    subject: string;
    html_body: string;
    text_body: string;
    variables: string[];
    description: string;
  }>) {
    const existing = await this.getTemplate(templateKey);

    if (existing.is_system) {
      throw new BadRequestException('Cannot modify system templates');
    }

    // Validate new templates
    if (data.html_body) {
      const validation = this.validateHandlebars(data.html_body);
      if (!validation.valid) {
        throw new BadRequestException(`Invalid HTML template: ${validation.error}`);
      }
    }

    if (data.text_body) {
      const validation = this.validateHandlebars(data.text_body);
      if (!validation.valid) {
        throw new BadRequestException(`Invalid text template: ${validation.error}`);
      }
    }

    return this.prisma.email_template.update({
      where: { template_key: templateKey },
      data,
    });
  }

  async deleteTemplate(templateKey: string) {
    const template = await this.getTemplate(templateKey);

    if (template.is_system) {
      throw new BadRequestException('Cannot delete system templates');
    }

    return this.prisma.email_template.delete({
      where: { template_key: templateKey },
    });
  }

  renderTemplate(templateString: string, variables: Record<string, any>): string {
    const compiled = Handlebars.compile(templateString);
    return compiled(variables);
  }

  validateHandlebars(templateString: string): { valid: boolean; error?: string } {
    try {
      Handlebars.compile(templateString);
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
}
```

#### 4.4 EmailService (Orchestration)
**File**: `/var/www/lead360.app/api/src/modules/jobs/services/email.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { SmtpService } from './smtp.service';
import { EmailTemplateService } from './email-template.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly smtp: SmtpService,
    private readonly templates: EmailTemplateService,
  ) {}

  async sendTemplatedEmail(options: {
    to: string;
    cc?: string[];
    bcc?: string[];
    templateKey: string;
    variables: Record<string, any>;
  }): Promise<{ messageId: string }> {
    const template = await this.templates.getTemplate(options.templateKey);

    const subject = this.templates.renderTemplate(template.subject, options.variables);
    const html = this.templates.renderTemplate(template.html_body, options.variables);
    const text = template.text_body
      ? this.templates.renderTemplate(template.text_body, options.variables)
      : undefined;

    const result = await this.smtp.sendEmail({
      to: options.to,
      cc: options.cc,
      bcc: options.bcc,
      subject,
      html,
      text,
    });

    this.logger.log(`Email sent to ${options.to} using template ${options.templateKey}`);

    return result;
  }

  async sendRawEmail(options: {
    to: string;
    cc?: string[];
    bcc?: string[];
    subject: string;
    html: string;
    text?: string;
  }): Promise<{ messageId: string }> {
    return this.smtp.sendEmail(options);
  }
}
```

---

## Handoff Documentation for Developer 2

### What You Completed
✅ BullMQ migration (bull → bullmq) - both existing queues working
✅ Database schema updated (tenant.timezone + 6 new tables)
✅ Email templates seeded
✅ EncryptionService implemented and tested
✅ SmtpService implemented (Nodemailer integration)
✅ EmailTemplateService implemented (CRUD + Handlebars validation)
✅ EmailService implemented (orchestration layer)

### What Developer 2 Needs to Know

**BullMQ Pattern**:
```typescript
@Processor('queue-name')
export class SomeProcessor extends WorkerHost {
  async process(job: Job): Promise<any> {
    // Implementation
    return result;
  }
}
```

**Encryption Usage**:
```typescript
const encrypted = this.encryption.encrypt('password');
const decrypted = this.encryption.decrypt(encrypted);
```

**Email Sending**:
```typescript
await this.emailService.sendTemplatedEmail({
  to: 'user@example.com',
  templateKey: 'password-reset',
  variables: { user_name: 'John', reset_link: 'https://...' },
});
```

**Timezone Field**: Available on tenant table as `tenant.timezone` (default: 'America/New_York')

### Files Created/Modified
**Created**:
- `/api/src/core/encryption/encryption.module.ts`
- `/api/src/core/encryption/encryption.service.ts`
- `/api/src/core/encryption/encryption.service.spec.ts`
- `/api/src/modules/jobs/services/smtp.service.ts`
- `/api/src/modules/jobs/services/email-template.service.ts`
- `/api/src/modules/jobs/services/email.service.ts`
- `/api/prisma/seeds/email-templates.seed.ts`

**Modified**:
- `/api/prisma/schema.prisma` (tenant.timezone + 6 new tables)
- `/api/src/app.module.ts` (BullModule from @nestjs/bullmq)
- `/api/src/modules/audit/audit.module.ts` (BullMQ imports)
- `/api/src/modules/audit/jobs/audit-log-write.job.ts` (WorkerHost pattern)
- `/api/src/modules/files/files.module.ts` (BullMQ imports)
- `/api/src/modules/files/processors/file-cleanup.processor.ts` (WorkerHost pattern)
- `/api/package.json` (dependencies)
- `/api/.env` (ENCRYPTION_KEY)

### Environment Variables Required
```env
ENCRYPTION_KEY=<64-character hex string>
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=978@F32cca17mc
```

### Testing Commands
```bash
npm run test              # Unit tests
npm run start:dev         # Verify server starts
# Test SMTP: Will be done by Developer 3 via API endpoint
```

---

## Next Steps for Developer 2
Developer 2 will implement:
1. JobQueueService (BullMQ wrapper)
2. JobManagerService (CRUD operations)
3. ScheduledJobService (cron scheduling with timezone)
4. All job processors (SendEmail, ExpiryCheck, Retention, etc.)
5. ScheduledJobExecutor (master scheduler)

**Read this entire file before starting** to understand the foundation you've built.
