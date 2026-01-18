# Communication/Notifications Module - Backend Implementation

**Module**: Communication & Notifications  
**Target**: NestJS Backend API  
**Sprint**: 2  
**Priority**: High  
**Estimated Effort**: 3 weeks  
**Status**: Ready for Development

---

## Overview

This document provides backend implementation guidance for the Communication/Notifications module. You will build a Provider Registry system that supports unlimited email providers without database migrations, webhook processing for delivery tracking, and a complete notification system.

**Core Architecture**: Provider Registry Pattern with JSON-based configuration

**Key Components**:
1. Provider Registry (master table of all email providers)
2. JSON Schema Validation (type safety in application layer)
3. Multi-Provider Email Service (SMTP, SendGrid, SES, Brevo)
4. Webhook Handlers (receive delivery status updates)
5. Template System (Handlebars with variables)
6. Notification System (in-app notifications)
7. Migration from Existing Email System

---

## Prerequisites

Before starting, ensure you understand:

- ✅ **Existing Email Infrastructure**: Review `platform_email_config`, `email_template`, `email_queue` tables in Prisma schema
- ✅ **Jobs Module**: Understand BullMQ queue system (used for async email sending)
- ✅ **Multi-Tenant Rules**: Review `/documentation/shared/multi-tenant-rules.md`
- ✅ **API Conventions**: Review `/documentation/shared/api-conventions.md`
- ✅ **Security Rules**: Review `/documentation/shared/security-rules.md`
- ✅ **Testing Requirements**: Review `/documentation/shared/testing-requirements.md`

---

## Reference Documentation

**MUST READ FIRST**:
1. **Feature Contract**: `/documentation/contracts/communication-contract.md` (complete specification)
2. **Shared Conventions**: `/documentation/shared/*.md` (multi-tenant, API, security, testing)
3. **Existing Prisma Schema**: `api/prisma/schema.prisma` (see `platform_email_config`, `email_template`, `email_queue`)

---

## Implementation Phases

### **Phase 1: Database Schema & Migrations** (Week 1)
1. Add new tables (communication_provider, webhook_event, etc.)
2. Enhance existing tables (email_template with tenant_id)
3. Seed 4 providers (SMTP, SendGrid, SES, Brevo)

### **Phase 2: Provider System** (Week 1-2)
1. Implement JSON Schema validation service
2. Create provider interface and factory
3. Implement 4 provider classes (SMTP, SendGrid, SES, Brevo)
4. Implement encryption service for credentials

### **Phase 3: Core Services** (Week 2)
1. CommunicationService (email sending orchestration)
2. EmailTemplateService (template management)
3. NotificationService (in-app notifications)
4. NotificationRuleService (auto-notification rules)

### **Phase 4: Webhooks** (Week 2)
1. Webhook receiver endpoints
2. Signature verification for each provider
3. Webhook processor service
4. Update communication_event status

### **Phase 5: Migration & Testing** (Week 3)
1. Migrate Auth module to use CommunicationService
2. Comprehensive testing (unit, integration, tenant isolation)
3. API documentation (100% coverage)
4. Performance optimization

---

## Phase 1: Database Schema & Migrations

### **Migration 1: Create communication_provider Table**

**File**: `api/prisma/migrations/YYYYMMDD_create_communication_provider/migration.sql`

**Purpose**: Master registry table defining all available communication providers.

**Key Fields**:
- `provider_key`: Unique identifier (e.g., 'smtp', 'sendgrid')
- `credentials_schema`: JSON Schema defining required credentials
- `config_schema`: JSON Schema defining provider-specific configuration
- `supports_webhooks`: Boolean indicating webhook support
- `webhook_verification_method`: 'signature', 'token', or 'ip_whitelist'

**Implementation Steps**:
1. Update `api/prisma/schema.prisma` with communication_provider model (see contract for exact schema)
2. Run: `npx prisma migrate dev --name create_communication_provider`
3. Verify migration file generated in `api/prisma/migrations/`

**Prisma Model Pattern**:
```prisma
model communication_provider {
  id                          String   @id @default(uuid()) @db.VarChar(36)
  provider_key                String   @unique @db.VarChar(50)
  provider_name               String   @db.VarChar(100)
  provider_type               provider_type
  credentials_schema          Json
  config_schema               Json?
  default_config              Json?
  supports_webhooks           Boolean  @default(false)
  webhook_events              Json?
  webhook_verification_method String?  @db.VarChar(50)
  documentation_url           String?  @db.VarChar(500)
  logo_url                    String?  @db.VarChar(500)
  is_active                   Boolean  @default(true)
  is_system                   Boolean  @default(false)
  created_at                  DateTime @default(now())
  updated_at                  DateTime @updatedAt

  platform_email_configs platform_email_config[]
  tenant_email_configs   tenant_email_config[]
  communication_events   communication_event[]

  @@index([provider_key])
  @@index([provider_type, is_active])
  @@index([is_active])
  @@map("communication_provider")
}

enum provider_type {
  email
  sms
  call
  push
  whatsapp
}
```

**Critical**: Do NOT create the migration manually. Always use `npx prisma migrate dev` to generate migrations from schema changes.

---

### **Migration 2: Enhance platform_email_config Table**

**Purpose**: Add provider registry support to existing platform email config.

**Changes**:
1. Add `provider_id` column (FK to communication_provider)
2. Add `credentials` JSON column (encrypted provider credentials)
3. Add `provider_config` JSON column (provider-specific settings)
4. Add `webhook_secret` column (for webhook verification)
5. Keep existing columns initially (we'll deprecate them after migration)

**Migration Strategy**:
```sql
-- Step 1: Add new columns
ALTER TABLE platform_email_config
  ADD COLUMN provider_id VARCHAR(36) AFTER id,
  ADD COLUMN credentials JSON AFTER provider_id,
  ADD COLUMN provider_config JSON AFTER credentials,
  ADD COLUMN webhook_secret VARCHAR(255) AFTER from_name;

-- Step 2: Add foreign key constraint
ALTER TABLE platform_email_config
  ADD CONSTRAINT fk_platform_email_provider
  FOREIGN KEY (provider_id) REFERENCES communication_provider(id);

-- Step 3: Create index
CREATE INDEX idx_platform_email_provider ON platform_email_config(provider_id);

-- NOTE: Do NOT drop old columns (smtp_host, smtp_port, etc.) yet
-- We'll migrate data first, then drop in a future migration
```

**Updated Prisma Model**:
```prisma
model platform_email_config {
  id                 String                  @id @default(uuid()) @db.VarChar(36)
  provider_id        String?                 @db.VarChar(36)
  credentials        Json?
  provider_config    Json?
  smtp_host          String                  @db.VarChar(255)  // Keep for now
  smtp_port          Int                                       // Keep for now
  smtp_encryption    String                  @default("tls") @db.VarChar(20)  // Keep for now
  smtp_username      String                  @db.VarChar(255)  // Keep for now
  smtp_password      String                  @db.Text          // Keep for now
  from_email         String                  @db.VarChar(255)
  from_name          String                  @db.VarChar(255)
  webhook_secret     String?                 @db.VarChar(255)
  is_verified        Boolean                 @default(false)
  updated_at         DateTime                @updatedAt
  updated_by_user_id String?                 @db.VarChar(36)

  provider           communication_provider? @relation(fields: [provider_id], references: [id])

  @@index([provider_id])
  @@map("platform_email_config")
}
```

---

### **Migration 3: Create tenant_email_config Table**

**Purpose**: Tenant-specific email configuration using provider registry.

**Implementation**: Follow same pattern as platform_email_config but with tenant_id.

**Key Rules**:
- UNIQUE constraint on `tenant_id` (one config per tenant)
- CASCADE delete when tenant deleted
- Must validate against provider's JSON schemas

**Prisma Model**:
```prisma
model tenant_email_config {
  id              String                 @id @default(uuid()) @db.VarChar(36)
  tenant_id       String                 @unique @db.VarChar(36)
  provider_id     String                 @db.VarChar(36)
  credentials     Json
  provider_config Json?
  from_email      String                 @db.VarChar(255)
  from_name       String                 @db.VarChar(100)
  reply_to_email  String?                @db.VarChar(255)
  webhook_secret  String?                @db.VarChar(255)
  is_active       Boolean                @default(true)
  is_verified     Boolean                @default(false)
  created_at      DateTime               @default(now())
  updated_at      DateTime               @updatedAt

  tenant          tenant                 @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  provider        communication_provider @relation(fields: [provider_id], references: [id])

  @@index([tenant_id, provider_id])
  @@index([tenant_id, is_active])
  @@map("tenant_email_config")
}
```

---

### **Migration 4: Enhance email_template Table**

**Purpose**: Add tenant support to existing email templates.

**Changes**:
1. Add `tenant_id` column (NULL = admin template)
2. Add `category` ENUM column
3. Update UNIQUE constraint from `template_key` to `(tenant_id, template_key)`
4. Add `is_active` column

**Migration**:
```sql
-- Step 1: Add new columns
ALTER TABLE email_template
  ADD COLUMN tenant_id VARCHAR(36) AFTER id,
  ADD COLUMN category ENUM('system', 'transactional', 'marketing', 'notification') DEFAULT 'transactional' AFTER variable_schema,
  ADD COLUMN is_active BOOLEAN DEFAULT TRUE AFTER category;

-- Step 2: Drop old unique constraint
ALTER TABLE email_template
  DROP INDEX email_template_template_key_key;

-- Step 3: Add new unique constraint (allows same key across tenants)
ALTER TABLE email_template
  ADD UNIQUE INDEX unique_tenant_template_key (tenant_id, template_key);

-- Step 4: Add foreign key
ALTER TABLE email_template
  ADD CONSTRAINT fk_email_template_tenant
  FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE;

-- Step 5: Add indexes
CREATE INDEX idx_email_template_tenant_active ON email_template(tenant_id, is_active);
CREATE INDEX idx_email_template_tenant_category ON email_template(tenant_id, category);
```

---

### **Migration 5: Create communication_event Table**

**Purpose**: Replace `email_queue` with comprehensive communication tracking supporting webhooks.

**Key Features**:
- Supports multiple channels (email, sms, call)
- Tracks webhook delivery status (delivered, bounced, opened, clicked)
- Links to entities (lead, quote, invoice)
- Stores provider_message_id for webhook matching

**Prisma Model** (see contract for complete schema):
```prisma
model communication_event {
  id                   String                 @id @default(uuid()) @db.VarChar(36)
  tenant_id            String?                @db.VarChar(36)
  channel              channel
  direction            direction              @default(outbound)
  provider_id          String                 @db.VarChar(36)
  status               communication_status   @default(pending)
  to_email             String?                @db.VarChar(255)
  to_phone             String?                @db.VarChar(20)
  // ... (see contract for all fields)
  provider_message_id  String?                @unique @db.VarChar(255)  // CRITICAL for webhooks
  sent_at              DateTime?
  delivered_at         DateTime?
  opened_at            DateTime?
  clicked_at           DateTime?
  bounced_at           DateTime?
  created_at           DateTime               @default(now())

  tenant               tenant?                @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  provider             communication_provider @relation(fields: [provider_id], references: [id])

  @@index([tenant_id, created_at(sort: Desc)])
  @@index([provider_message_id])  // CRITICAL for webhook lookup
  @@index([tenant_id, status])
  @@map("communication_event")
}
```

**Migration Note**: Do NOT drop `email_queue` table yet. We'll keep both running in parallel during transition.

---

### **Migration 6: Create webhook_event Table**

**Purpose**: Complete audit log of all webhook deliveries.

**Use Cases**:
- Debugging webhook issues
- Manual replay of failed webhooks
- Monitoring provider reliability
- Compliance audit trail

**Prisma Model**:
```prisma
model webhook_event {
  id                      String    @id @default(uuid()) @db.VarChar(36)
  provider_id             String    @db.VarChar(36)
  communication_event_id  String?   @db.VarChar(36)
  event_type              String    @db.VarChar(50)
  provider_message_id     String?   @db.VarChar(255)
  payload                 Json
  signature               String?   @db.VarChar(500)
  signature_verified      Boolean   @default(false)
  ip_address              String?   @db.VarChar(45)
  processed               Boolean   @default(false)
  processed_at            DateTime?
  error_message           String?   @db.Text
  created_at              DateTime  @default(now())

  provider                communication_provider @relation(fields: [provider_id], references: [id])
  communication_event     communication_event?   @relation(fields: [communication_event_id], references: [id])

  @@index([provider_id, created_at(sort: Desc)])
  @@index([provider_message_id])
  @@index([processed, created_at])
  @@map("webhook_event")
}
```

---

### **Migration 7: Create notification Tables**

**Purpose**: In-app notification system with auto-notification rules.

**Two Tables**:
1. `notification` - Actual notifications shown to users
2. `notification_rule` - Rules that auto-create notifications

**Prisma Models** (see contract for complete schema):
```prisma
model notification {
  id                  String    @id @default(uuid()) @db.VarChar(36)
  tenant_id           String    @db.VarChar(36)
  user_id             String?   @db.VarChar(36)  // NULL = all users
  type                String    @db.VarChar(50)
  title               String    @db.VarChar(255)
  message             String    @db.Text
  action_url          String?   @db.VarChar(500)
  related_entity_type String?   @db.VarChar(50)
  related_entity_id   String?   @db.VarChar(36)
  is_read             Boolean   @default(false)
  read_at             DateTime?
  expires_at          DateTime?
  created_at          DateTime  @default(now())

  tenant              tenant    @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  user                user?     @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([tenant_id, user_id, is_read, created_at(sort: Desc)])
  @@map("notification")
}

model notification_rule {
  id                  String          @id @default(uuid()) @db.VarChar(36)
  tenant_id           String          @db.VarChar(36)
  event_type          String          @db.VarChar(100)
  notify_in_app       Boolean         @default(true)
  notify_email        Boolean         @default(false)
  email_template_key  String?         @db.VarChar(100)
  recipient_type      recipient_type  @default(owner)
  specific_user_ids   Json?
  is_active           Boolean         @default(true)
  created_at          DateTime        @default(now())
  updated_at          DateTime        @updatedAt

  tenant              tenant          @relation(fields: [tenant_id], references: [id], onDelete: Cascade)

  @@index([tenant_id, event_type, is_active])
  @@map("notification_rule")
}
```

---

### **Migration Summary**

**Total Migrations**: 7

1. ✅ Create communication_provider (master registry)
2. ✅ Enhance platform_email_config (add JSON fields)
3. ✅ Create tenant_email_config
4. ✅ Enhance email_template (add tenant support)
5. ✅ Create communication_event (replace email_queue)
6. ✅ Create webhook_event (audit log)
7. ✅ Create notification + notification_rule

**Migration Execution**:
```bash
# After updating prisma/schema.prisma with all models
cd api
npx prisma migrate dev --name add_communication_module
npx prisma generate
```

---

### **Seeding Providers** (Week 1)

**File**: `api/prisma/seeds/communication-providers.seed.ts`

**Purpose**: Insert 4 initial providers with complete JSON Schemas.

**Implementation Pattern**:
```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedCommunicationProviders() {
  console.log('Seeding communication providers...');

  // SMTP Provider
  await prisma.communication_provider.upsert({
    where: { provider_key: 'smtp' },
    update: {},
    create: {
      id: 'provider-smtp-default',
      provider_key: 'smtp',
      provider_name: 'SMTP',
      provider_type: 'email',
      credentials_schema: {
        type: 'object',
        required: ['smtp_username', 'smtp_password'],
        properties: {
          smtp_username: {
            type: 'string',
            minLength: 3,
            maxLength: 255,
            description: 'SMTP username (usually email address)',
          },
          smtp_password: {
            type: 'string',
            minLength: 8,
            maxLength: 255,
            description: 'SMTP password or app-specific password',
            format: 'password',
          },
        },
      },
      config_schema: {
        type: 'object',
        required: ['smtp_host', 'smtp_port', 'smtp_encryption'],
        properties: {
          smtp_host: {
            type: 'string',
            minLength: 3,
            description: 'SMTP server hostname',
          },
          smtp_port: {
            type: 'integer',
            minimum: 1,
            maximum: 65535,
            description: 'SMTP port (587 for TLS, 465 for SSL)',
          },
          smtp_encryption: {
            type: 'string',
            enum: ['none', 'tls', 'ssl'],
            default: 'tls',
          },
        },
      },
      supports_webhooks: false,
      is_active: true,
      is_system: true,
    },
  });

  // SendGrid Provider (see contract for complete schema)
  await prisma.communication_provider.upsert({
    where: { provider_key: 'sendgrid' },
    update: {},
    create: {
      // ... (see contract for SendGrid JSON schemas)
      supports_webhooks: true,
      webhook_events: ['delivered', 'bounce', 'dropped', 'spam_report', 'open', 'click'],
      webhook_verification_method: 'signature',
    },
  });

  // Amazon SES Provider (see contract)
  // Brevo Provider (see contract)

  console.log('Communication providers seeded successfully');
}

seedCommunicationProviders()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

**Execution**:
```bash
cd api
npx ts-node prisma/seeds/communication-providers.seed.ts
```

**Verification**:
```sql
SELECT provider_key, provider_name, supports_webhooks, is_active 
FROM communication_provider;

-- Expected: 4 rows (smtp, sendgrid, amazon_ses, brevo)
```

---

## Phase 2: Provider System Implementation

### **JSON Schema Validation Service**

**File**: `api/src/modules/communication/services/json-schema-validator.service.ts`

**Purpose**: Validate provider credentials and configs against JSON Schemas.

**Dependencies**: Install `ajv` library for JSON Schema validation:
```bash
npm install ajv@^8.12.0 ajv-formats@^2.1.1
```

**Service Responsibilities**:
- Compile JSON Schemas (with caching for performance)
- Validate credentials JSON against provider's credentials_schema
- Validate provider_config JSON against provider's config_schema
- Return detailed validation errors

**Key Methods**:
```typescript
@Injectable()
export class JsonSchemaValidatorService {
  private ajv: Ajv;
  private schemaCache: Map<string, ValidateFunction>;

  constructor() {
    // Initialize Ajv with strict mode and formats
    this.ajv = new Ajv({ allErrors: true, strict: true });
    addFormats(this.ajv);  // Add format validators (email, uri, etc.)
    this.schemaCache = new Map();
  }

  /**
   * Validate credentials against provider's credentials_schema
   * @throws BadRequestException if validation fails
   */
  async validateCredentials(
    provider: CommunicationProvider,
    credentials: any,
  ): Promise<void> {
    const validate = this.getOrCompileSchema(
      `${provider.provider_key}_credentials`,
      provider.credentials_schema,
    );

    if (!validate(credentials)) {
      throw new BadRequestException({
        message: 'Invalid credentials format',
        errors: validate.errors,
      });
    }
  }

  /**
   * Validate config against provider's config_schema
   */
  async validateConfig(
    provider: CommunicationProvider,
    config: any,
  ): Promise<void> {
    if (!provider.config_schema) return; // Optional config

    const validate = this.getOrCompileSchema(
      `${provider.provider_key}_config`,
      provider.config_schema,
    );

    if (!validate(config)) {
      throw new BadRequestException({
        message: 'Invalid provider configuration',
        errors: validate.errors,
      });
    }
  }

  private getOrCompileSchema(key: string, schema: any): ValidateFunction {
    if (this.schemaCache.has(key)) {
      return this.schemaCache.get(key)!;
    }

    const compiled = this.ajv.compile(schema);
    this.schemaCache.set(key, compiled);
    return compiled;
  }
}
```

**Usage Example**:
```typescript
// In service layer before saving config
const provider = await this.prisma.communication_provider.findUnique({
  where: { provider_key: 'sendgrid' },
});

const credentials = { api_key: 'SG.xxxxx' };
const config = { click_tracking: false };

// Validate before saving
await this.jsonSchemaValidator.validateCredentials(provider, credentials);
await this.jsonSchemaValidator.validateConfig(provider, config);

// Now safe to save
```

---

### **Encryption Service** (Credential Security)

**File**: `api/src/modules/communication/services/encryption.service.ts`

**Purpose**: Encrypt/decrypt provider credentials using AES-256-GCM.

**Dependencies**: Use Node.js built-in `crypto` module.

**CRITICAL**: Never store credentials in plain text. Always encrypt before saving to database.

**Key Methods**:
```typescript
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits

  constructor(private readonly configService: ConfigService) {}

  /**
   * Encrypt credentials JSON
   * Returns: { encrypted: string, iv: string, authTag: string }
   */
  encrypt(data: any): string {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);

    const jsonString = JSON.stringify(data);
    let encrypted = cipher.update(jsonString, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');

    // Store as single encrypted string with iv and authTag
    return JSON.stringify({
      encrypted,
      iv: iv.toString('hex'),
      authTag,
    });
  }

  /**
   * Decrypt credentials
   * Returns: Original credentials object
   */
  decrypt(encryptedData: string): any {
    const key = this.getEncryptionKey();
    const { encrypted, iv, authTag } = JSON.parse(encryptedData);

    const decipher = crypto.createDecipheriv(
      this.algorithm,
      key,
      Buffer.from(iv, 'hex'),
    );

    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }

  private getEncryptionKey(): Buffer {
    const secret = this.configService.get<string>('ENCRYPTION_SECRET_KEY');
    if (!secret) {
      throw new Error('ENCRYPTION_SECRET_KEY not configured');
    }
    // Derive 256-bit key from secret
    return crypto.scryptSync(secret, 'salt', this.keyLength);
  }
}
```

**Environment Variable** (add to `.env`):
```env
# Generate with: openssl rand -hex 32
ENCRYPTION_SECRET_KEY=your-32-byte-hex-key-here
```

**Usage**:
```typescript
// Before saving credentials
const credentials = { api_key: 'SG.xxxxx' };
const encrypted = this.encryptionService.encrypt(credentials);

await this.prisma.platform_email_config.create({
  data: {
    credentials: encrypted,  // Store encrypted
  },
});

// When using credentials
const config = await this.prisma.platform_email_config.findUnique({...});
const decrypted = this.encryptionService.decrypt(config.credentials);
// Now use decrypted.api_key
```

---

### **Provider Interface & Factory**

**File**: `api/src/modules/communication/providers/email-provider.interface.ts`

**Purpose**: Define common interface all email providers must implement.

```typescript
export interface EmailProviderInterface {
  /**
   * Send email via provider
   * Returns provider's message ID (critical for webhook matching)
   */
  sendEmail(params: SendEmailParams): Promise<SendEmailResult>;

  /**
   * Verify connection to provider (test credentials)
   */
  verifyConnection(): Promise<boolean>;
}

export interface SendEmailParams {
  to: string;
  from: string;
  fromName?: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export interface SendEmailResult {
  success: boolean;
  providerMessageId: string;  // CRITICAL for webhook matching
  providerMetadata?: any;
  error?: string;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}
```

**Provider Factory** (`email-provider.factory.ts`):
```typescript
@Injectable()
export class EmailProviderFactory {
  constructor(
    private readonly smtpProvider: SmtpEmailProvider,
    private readonly sendgridProvider: SendgridEmailProvider,
    private readonly sesProvider: AmazonSesEmailProvider,
    private readonly brevoProvider: BrevoEmailProvider,
  ) {}

  /**
   * Get provider instance based on provider_key
   */
  getProvider(providerKey: string): EmailProviderInterface {
    switch (providerKey) {
      case 'smtp':
        return this.smtpProvider;
      case 'sendgrid':
        return this.sendgridProvider;
      case 'amazon_ses':
        return this.sesProvider;
      case 'brevo':
        return this.brevoProvider;
      default:
        throw new BadRequestException(`Unsupported provider: ${providerKey}`);
    }
  }
}
```

---

### **SMTP Provider Implementation**

**File**: `api/src/modules/communication/providers/smtp-email.provider.ts`

**Dependencies**:
```bash
npm install nodemailer@^6.9.0 @types/nodemailer@^6.4.0
```

**Implementation Pattern**:
```typescript
import * as nodemailer from 'nodemailer';

@Injectable()
export class SmtpEmailProvider implements EmailProviderInterface {
  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    // Create transporter from credentials + config
    const transporter = nodemailer.createTransport({
      host: params.config.smtp_host,
      port: params.config.smtp_port,
      secure: params.config.smtp_encryption === 'ssl',
      auth: {
        user: params.credentials.smtp_username,
        pass: params.credentials.smtp_password,
      },
    });

    // Send email
    const result = await transporter.sendMail({
      from: `"${params.fromName}" <${params.from}>`,
      to: params.to,
      subject: params.subject,
      html: params.htmlBody,
      text: params.textBody,
      cc: params.cc,
      bcc: params.bcc,
      replyTo: params.replyTo,
      attachments: params.attachments?.map(att => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType,
      })),
    });

    return {
      success: true,
      providerMessageId: result.messageId,  // CRITICAL for tracking
      providerMetadata: { response: result.response },
    };
  }

  async verifyConnection(): Promise<boolean> {
    // Test SMTP connection
    const transporter = nodemailer.createTransporter({...});
    await transporter.verify();
    return true;
  }
}
```

**Notes**:
- SMTP has NO webhook support (supports_webhooks: false)
- Use `result.messageId` for tracking, but no delivery confirmations
- Gmail App Passwords work well for testing

---

### **SendGrid Provider Implementation**

**File**: `api/src/modules/communication/providers/sendgrid-email.provider.ts`

**Dependencies**:
```bash
npm install @sendgrid/mail@^8.1.0
```

**Implementation**:
```typescript
import * as sgMail from '@sendgrid/mail';

@Injectable()
export class SendgridEmailProvider implements EmailProviderInterface {
  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    // Set API key
    sgMail.setApiKey(params.credentials.api_key);

    // Prepare message
    const msg = {
      to: params.to,
      from: { email: params.from, name: params.fromName },
      subject: params.subject,
      html: params.htmlBody,
      text: params.textBody,
      cc: params.cc,
      bcc: params.bcc,
      replyTo: params.replyTo,
      trackingSettings: {
        clickTracking: { enable: params.config.click_tracking || false },
        openTracking: { enable: params.config.open_tracking || false },
      },
      attachments: params.attachments?.map(att => ({
        filename: att.filename,
        content: att.content.toString('base64'),
        type: att.contentType,
        disposition: 'attachment',
      })),
    };

    // Send via SendGrid
    const [response] = await sgMail.send(msg);

    return {
      success: true,
      providerMessageId: response.headers['x-message-id'],  // SendGrid message ID
      providerMetadata: { statusCode: response.statusCode },
    };
  }
}
```

**Webhook Support**: SendGrid sends webhooks with delivery status (see Phase 4).

---

### **Amazon SES Provider Implementation**

**File**: `api/src/modules/communication/providers/amazon-ses-email.provider.ts`

**Dependencies**:
```bash
npm install @aws-sdk/client-ses@^3.0.0
```

**Implementation Pattern**:
```typescript
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

@Injectable()
export class AmazonSesEmailProvider implements EmailProviderInterface {
  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    // Create SES client
    const ses = new SESClient({
      region: params.credentials.region,
      credentials: {
        accessKeyId: params.credentials.access_key_id,
        secretAccessKey: params.credentials.secret_access_key,
      },
    });

    // Prepare email
    const command = new SendEmailCommand({
      Source: `"${params.fromName}" <${params.from}>`,
      Destination: {
        ToAddresses: [params.to],
        CcAddresses: params.cc,
        BccAddresses: params.bcc,
      },
      Message: {
        Subject: { Data: params.subject },
        Body: {
          Html: { Data: params.htmlBody },
          Text: { Data: params.textBody },
        },
      },
      ConfigurationSetName: params.config.configuration_set,
    });

    // Send
    const response = await ses.send(command);

    return {
      success: true,
      providerMessageId: response.MessageId,  // SES message ID
      providerMetadata: response,
    };
  }
}
```

**Webhook Support**: SES sends webhooks via SNS (see Phase 4).

---

### **Brevo Provider Implementation**

**File**: `api/src/modules/communication/providers/brevo-email.provider.ts`

**Dependencies**:
```bash
npm install @getbrevo/brevo@^2.2.0
```

**Implementation**: Similar pattern to SendGrid, using Brevo SDK.

---

## Phase 3: Core Services

### **CommunicationService** (Orchestration)

**File**: `api/src/modules/communication/services/communication.service.ts`

**Purpose**: Main service orchestrating email sending.

**Responsibilities**:
- Select provider (platform vs tenant config)
- Validate credentials/config via JSON Schema
- Decrypt credentials
- Call provider implementation
- Log to communication_event table
- Queue email job via BullMQ

**Key Method** - Send Email:
```typescript
@Injectable()
export class CommunicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providerFactory: EmailProviderFactory,
    private readonly jsonSchemaValidator: JsonSchemaValidatorService,
    private readonly encryptionService: EncryptionService,
    @InjectQueue('email') private readonly emailQueue: Queue,
  ) {}

  /**
   * Send email using tenant or platform config
   */
  async sendEmail(params: {
    tenantId?: string;
    to: string;
    subject: string;
    htmlBody: string;
    textBody?: string;
    templateKey?: string;
    templateVariables?: any;
    relatedEntityType?: string;
    relatedEntityId?: string;
    attachments?: EmailAttachment[];
  }): Promise<string> {
    // Step 1: Get email config (tenant or platform)
    const config = await this.getEmailConfig(params.tenantId);

    // Step 2: Get provider
    const provider = await this.prisma.communication_provider.findUnique({
      where: { id: config.provider_id },
    });

    if (!provider || !provider.is_active) {
      throw new BadRequestException('Email provider not available');
    }

    // Step 3: Decrypt credentials
    const credentials = this.encryptionService.decrypt(config.credentials);
    const providerConfig = config.provider_config || {};

    // Step 4: Validate credentials/config
    await this.jsonSchemaValidator.validateCredentials(provider, credentials);
    await this.jsonSchemaValidator.validateConfig(provider, providerConfig);

    // Step 5: Create communication_event (pending)
    const commEvent = await this.prisma.communication_event.create({
      data: {
        tenant_id: params.tenantId || null,
        channel: 'email',
        direction: 'outbound',
        provider_id: provider.id,
        status: 'pending',
        to_email: params.to,
        from_email: config.from_email,
        from_name: config.from_name,
        subject: params.subject,
        html_body: params.htmlBody,
        text_body: params.textBody,
        template_key: params.templateKey,
        template_variables: params.templateVariables,
        attachments: params.attachments,
        related_entity_type: params.relatedEntityType,
        related_entity_id: params.relatedEntityId,
      },
    });

    // Step 6: Queue email job
    await this.emailQueue.add('send-email', {
      communicationEventId: commEvent.id,
      providerKey: provider.provider_key,
      credentials,
      config: providerConfig,
      emailParams: {
        to: params.to,
        from: config.from_email,
        fromName: config.from_name,
        subject: params.subject,
        htmlBody: params.htmlBody,
        textBody: params.textBody,
        attachments: params.attachments,
      },
    });

    return commEvent.id;
  }

  private async getEmailConfig(tenantId?: string) {
    if (tenantId) {
      // Try tenant config first
      const tenantConfig = await this.prisma.tenant_email_config.findUnique({
        where: { tenant_id: tenantId },
      });

      if (tenantConfig && tenantConfig.is_active && tenantConfig.is_verified) {
        return tenantConfig;
      }
    }

    // Fallback to platform config
    const platformConfig = await this.prisma.platform_email_config.findFirst();
    if (!platformConfig || !platformConfig.is_verified) {
      throw new BadRequestException('No verified email configuration available');
    }

    return platformConfig;
  }
}
```

---

### **Email Queue Processor**

**File**: `api/src/modules/communication/processors/send-email.processor.ts`

**Purpose**: Process email sending jobs asynchronously.

**Pattern**:
```typescript
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('email')
export class SendEmailProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providerFactory: EmailProviderFactory,
  ) {
    super();
  }

  async process(job: Job<SendEmailJobData>): Promise<any> {
    const { communicationEventId, providerKey, credentials, config, emailParams } = job.data;

    try {
      // Get provider
      const provider = this.providerFactory.getProvider(providerKey);

      // Send email
      const result = await provider.sendEmail({
        ...emailParams,
        credentials,
        config,
      });

      // Update communication_event
      await this.prisma.communication_event.update({
        where: { id: communicationEventId },
        data: {
          status: 'sent',
          provider_message_id: result.providerMessageId,  // CRITICAL
          provider_metadata: result.providerMetadata,
          sent_at: new Date(),
        },
      });

      return { success: true };
    } catch (error) {
      // Update status to failed
      await this.prisma.communication_event.update({
        where: { id: communicationEventId },
        data: {
          status: 'failed',
          error_message: error.message,
        },
      });

      throw error;  // Re-throw for BullMQ retry
    }
  }
}
```

**BullMQ Registration**:
```typescript
// communication.module.ts
@Module({
  imports: [
    BullModule.registerQueue({
      name: 'email',
    }),
  ],
  providers: [SendEmailProcessor],
})
```

---

## Phase 4: Webhook Implementation

### **Webhook Controller**

**File**: `api/src/modules/communication/controllers/webhook.controller.ts`

**Purpose**: Receive webhooks from email providers.

**Pattern**:
```typescript
@Controller('webhooks/communication')
export class WebhookController {
  constructor(
    private readonly webhookService: WebhookProcessorService,
  ) {}

  /**
   * SendGrid webhook endpoint
   * POST /webhooks/communication/sendgrid
   */
  @Post('sendgrid')
  async handleSendGridWebhook(
    @Req() req: Request,
    @Body() payload: any,
  ) {
    await this.webhookService.processSendGridWebhook(req, payload);
    return { success: true };
  }

  /**
   * Amazon SES webhook endpoint (via SNS)
   * POST /webhooks/communication/amazon-ses
   */
  @Post('amazon-ses')
  async handleSESWebhook(
    @Req() req: Request,
    @Body() payload: any,
  ) {
    await this.webhookService.processSESWebhook(req, payload);
    return { success: true };
  }

  /**
   * Brevo webhook endpoint
   * POST /webhooks/communication/brevo
   */
  @Post('brevo')
  async handleBrevoWebhook(
    @Req() req: Request,
    @Body() payload: any,
  ) {
    await this.webhookService.processBrevoWebhook(req, payload);
    return { success: true };
  }

  /**
   * Generic webhook endpoint (future providers)
   * POST /webhooks/communication/:providerKey
   */
  @Post(':providerKey')
  async handleGenericWebhook(
    @Param('providerKey') providerKey: string,
    @Req() req: Request,
    @Body() payload: any,
  ) {
    await this.webhookService.processGenericWebhook(providerKey, req, payload);
    return { success: true };
  }
}
```

**CRITICAL**: Webhook endpoints MUST NOT require JWT authentication. Providers send webhooks to public endpoints.

---

### **Webhook Processor Service**

**File**: `api/src/modules/communication/services/webhook-processor.service.ts`

**Responsibilities**:
- Verify webhook signature/token
- Log webhook to webhook_event table
- Extract provider_message_id
- Find communication_event
- Update status based on event type
- Implement idempotency (prevent duplicate processing)

**SendGrid Webhook Processing**:
```typescript
async processSendGridWebhook(req: Request, payload: any[]) {
  // Step 1: Verify signature
  const signature = req.headers['x-twilio-email-event-webhook-signature'] as string;
  const timestamp = req.headers['x-twilio-email-event-webhook-timestamp'] as string;

  await this.verifySendGridSignature(signature, timestamp, req.body);

  // Step 2: Process each event (SendGrid sends array)
  for (const event of payload) {
    const provider = await this.prisma.communication_provider.findUnique({
      where: { provider_key: 'sendgrid' },
    });

    // Step 3: Check idempotency
    const existing = await this.prisma.webhook_event.findFirst({
      where: {
        provider_message_id: event.sg_message_id,
        event_type: event.event,
        processed: true,
      },
    });

    if (existing) {
      continue;  // Already processed
    }

    // Step 4: Log webhook
    const webhookEvent = await this.prisma.webhook_event.create({
      data: {
        provider_id: provider.id,
        event_type: event.event,
        provider_message_id: event.sg_message_id,
        payload: event,
        signature,
        signature_verified: true,
        ip_address: req.ip,
        processed: false,
      },
    });

    // Step 5: Find communication_event
    const commEvent = await this.prisma.communication_event.findUnique({
      where: { provider_message_id: event.sg_message_id },
    });

    if (!commEvent) {
      await this.prisma.webhook_event.update({
        where: { id: webhookEvent.id },
        data: {
          error_message: 'Communication event not found',
        },
      });
      continue;
    }

    // Step 6: Update communication_event based on event type
    const updateData: any = {};

    switch (event.event) {
      case 'delivered':
        updateData.status = 'delivered';
        updateData.delivered_at = new Date(event.timestamp * 1000);
        break;

      case 'bounce':
      case 'dropped':
        updateData.status = 'bounced';
        updateData.bounced_at = new Date(event.timestamp * 1000);
        updateData.bounce_type = event.type === 'bounce' ? 'hard' : 'soft';
        updateData.error_message = event.reason;
        break;

      case 'open':
        updateData.opened_at = new Date(event.timestamp * 1000);
        break;

      case 'click':
        updateData.clicked_at = new Date(event.timestamp * 1000);
        break;
    }

    await this.prisma.communication_event.update({
      where: { id: commEvent.id },
      data: updateData,
    });

    // Step 7: Mark webhook as processed
    await this.prisma.webhook_event.update({
      where: { id: webhookEvent.id },
      data: {
        communication_event_id: commEvent.id,
        processed: true,
        processed_at: new Date(),
      },
    });
  }
}

/**
 * Verify SendGrid webhook signature (HMAC-SHA256)
 */
private async verifySendGridSignature(
  signature: string,
  timestamp: string,
  rawBody: any,
): Promise<void> {
  // Get webhook secret from platform config
  const config = await this.prisma.platform_email_config.findFirst();
  const webhookSecret = config?.webhook_secret;

  if (!webhookSecret) {
    throw new UnauthorizedException('Webhook secret not configured');
  }

  // Create verification string
  const payload = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);
  const verifyString = timestamp + payload;

  // Compute expected signature
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(verifyString)
    .digest('base64');

  // Verify signature
  if (signature !== expectedSignature) {
    throw new UnauthorizedException('Invalid webhook signature');
  }

  // Check timestamp (prevent replay attacks)
  const now = Math.floor(Date.now() / 1000);
  const eventTimestamp = parseInt(timestamp);

  if (Math.abs(now - eventTimestamp) > 300) {  // 5 minutes
    throw new UnauthorizedException('Webhook timestamp expired');
  }
}
```

**Amazon SES Webhook Processing**:
```typescript
async processSESWebhook(req: Request, payload: any) {
  // SES sends via SNS - must verify SNS signature first
  const messageValidator = new MessageValidator();
  await messageValidator.validate(payload);  // Throws if invalid

  // Extract actual SES event from SNS message
  const message = JSON.parse(payload.Message);
  const eventType = message.eventType;  // 'Delivery', 'Bounce', 'Complaint'
  const messageId = message.mail.messageId;

  // Similar processing to SendGrid...
}
```

**Brevo Webhook Processing**:
```typescript
async processBrevoWebhook(req: Request, payload: any) {
  // Brevo uses token-based verification
  const token = req.headers['x-sib-token'] || req.query.token;
  
  // Get webhook secret from config
  const config = await this.getWebhookSecret('brevo');
  
  if (token !== config.webhook_secret) {
    throw new UnauthorizedException('Invalid webhook token');
  }

  // Process event...
}
```

---

## Migration from Existing Email System

### **Step 1: Migrate Auth Module**

**Current State**: Auth module uses `EmailService` from Jobs module which directly sends SMTP emails.

**Target State**: Auth module uses `CommunicationService` which supports multiple providers and tracks delivery.

**Files to Update**:
1. `api/src/modules/auth/auth.service.ts` - Replace EmailService with CommunicationService
2. Remove dependency on Jobs EmailService

**Example Migration**:
```typescript
// BEFORE (auth.service.ts)
async sendPasswordResetEmail(user: User, token: string) {
  await this.emailService.sendEmail({
    to: user.email,
    templateKey: 'password-reset',
    variables: { token, userName: user.name },
  });
}

// AFTER (auth.service.ts)
async sendPasswordResetEmail(user: User, token: string) {
  await this.communicationService.sendEmail({
    tenantId: null,  // Platform email
    to: user.email,
    subject: 'Reset Your Password',
    templateKey: 'password-reset',
    templateVariables: { token, userName: user.name },
  });
}
```

**Template Rendering**: CommunicationService should fetch template and render with Handlebars before sending.

---

### **Step 2: Dual System Operation**

**Strategy**: Run both email systems in parallel during transition.

**Why**: Allows gradual migration without breaking existing functionality.

**Implementation**:
1. Keep `email_queue` table (don't drop yet)
2. Keep Jobs EmailService running
3. CommunicationService creates entries in `communication_event`
4. Monitor both systems for 1 week
5. After verification, deprecate old system

---

## Testing Requirements

### **Unit Tests**

**Coverage Target**: >80% for services

**Critical Tests**:
```typescript
// json-schema-validator.service.spec.ts
describe('JsonSchemaValidatorService', () => {
  it('should validate SMTP credentials', async () => {
    const credentials = {
      smtp_username: 'test@example.com',
      smtp_password: 'password123',
    };
    // Should not throw
    await service.validateCredentials(smtpProvider, credentials);
  });

  it('should reject invalid credentials', async () => {
    const invalid = { smtp_username: '' };  // Missing password
    await expect(
      service.validateCredentials(smtpProvider, invalid),
    ).rejects.toThrow(BadRequestException);
  });
});

// encryption.service.spec.ts
describe('EncryptionService', () => {
  it('should encrypt and decrypt credentials', () => {
    const original = { api_key: 'SG.xxxxx' };
    const encrypted = service.encrypt(original);
    const decrypted = service.decrypt(encrypted);
    expect(decrypted).toEqual(original);
  });
});

// communication.service.spec.ts
describe('CommunicationService', () => {
  it('should send email using tenant config', async () => {
    // Mock tenant config, provider, etc.
    const result = await service.sendEmail({
      tenantId: 'tenant-1',
      to: 'customer@example.com',
      subject: 'Test',
      htmlBody: '<p>Test</p>',
    });
    expect(result).toBeDefined();  // Returns communication_event id
  });
});
```

---

### **Integration Tests**

**Test Complete Flows**:
```typescript
describe('Communication Module Integration', () => {
  it('should send email via SendGrid and receive webhook', async () => {
    // 1. Configure SendGrid provider
    const config = await createPlatformEmailConfig({
      provider_key: 'sendgrid',
      credentials: { api_key: process.env.SENDGRID_TEST_KEY },
    });

    // 2. Send email
    const eventId = await communicationService.sendEmail({
      to: 'test@example.com',
      subject: 'Integration Test',
      htmlBody: '<p>Test</p>',
    });

    // 3. Wait for email to send
    await sleep(5000);

    // 4. Verify communication_event updated
    const event = await prisma.communication_event.findUnique({
      where: { id: eventId },
    });
    expect(event.status).toBe('sent');
    expect(event.provider_message_id).toBeDefined();

    // 5. Simulate webhook delivery
    await request(app.getHttpServer())
      .post('/webhooks/communication/sendgrid')
      .send([{
        event: 'delivered',
        sg_message_id: event.provider_message_id,
        timestamp: Date.now() / 1000,
      }])
      .expect(200);

    // 6. Verify status updated to delivered
    const updated = await prisma.communication_event.findUnique({
      where: { id: eventId },
    });
    expect(updated.status).toBe('delivered');
    expect(updated.delivered_at).toBeDefined();
  });
});
```

---

### **Tenant Isolation Tests**

**CRITICAL**: Test that tenants cannot access other tenant's communications.

```typescript
describe('Tenant Isolation', () => {
  it('should prevent tenant from accessing another tenant email config', async () => {
    // Tenant 1 config
    await createTenantEmailConfig({ tenant_id: 'tenant-1' });

    // Try to access as tenant 2
    await expect(
      communicationService.getTenantEmailConfig('tenant-2'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should filter communication_event by tenant_id', async () => {
    // Create events for two tenants
    await createCommunicationEvent({ tenant_id: 'tenant-1' });
    await createCommunicationEvent({ tenant_id: 'tenant-2' });

    // Query as tenant 1
    const events = await communicationService.getCommunicationHistory({
      tenantId: 'tenant-1',
    });

    // Should only see tenant 1 events
    expect(events.every(e => e.tenant_id === 'tenant-1')).toBe(true);
  });
});
```

---

## API Documentation Requirements

**CRITICAL**: Must document 100% of endpoints before frontend development starts.

**File**: `api/documentation/communication_REST_API.md`

**Must Include for EVERY Endpoint**:
1. HTTP Method + URL
2. Authentication requirements
3. RBAC roles allowed
4. Request body schema (every field, type, validation)
5. Query parameters (every param, type, default)
6. Response schema (every field, type)
7. Error responses (all possible status codes)
8. Example request
9. Example response
10. Notes on tenant isolation

**Example Documentation**:
```markdown
### POST /api/v1/communication/tenant-email-config

Configure tenant's email provider.

**Authentication**: Required (JWT)
**Roles**: Owner, Admin

**Request Body**:
```json
{
  "provider_key": "sendgrid",  // REQUIRED, enum: smtp, sendgrid, amazon_ses, brevo
  "credentials": {             // REQUIRED, must match provider's credentials_schema
    "api_key": "SG.xxxxx"
  },
  "provider_config": {         // OPTIONAL, must match provider's config_schema
    "click_tracking": false
  },
  "from_email": "info@acmeplumbing.com",  // REQUIRED, valid email
  "from_name": "Acme Plumbing",           // REQUIRED, 2-100 chars
  "reply_to_email": "support@acmeplumbing.com"  // OPTIONAL, valid email
}
```

**Response** (201 Created):
```json
{
  "id": "config-uuid",
  "tenant_id": "tenant-uuid",
  "provider_key": "sendgrid",
  "from_email": "info@acmeplumbing.com",
  "from_name": "Acme Plumbing",
  "is_verified": false,
  "created_at": "2026-01-18T00:00:00Z"
}
```

**Errors**:
- 400: Invalid credentials format (doesn't match JSON Schema)
- 400: Invalid provider_config format
- 401: Not authenticated
- 403: Insufficient permissions (not Owner/Admin)
- 404: Provider not found or inactive

**Notes**:
- Credentials are encrypted before storage (AES-256-GCM)
- is_verified=false until test email succeeds
- Tenant can only have ONE config (UNIQUE constraint on tenant_id)
```

---

## Module Structure Summary

**Final File Structure**:
```
api/src/modules/communication/
├── communication.module.ts
├── controllers/
│   ├── provider-registry.controller.ts      (Admin: manage providers)
│   ├── platform-email-config.controller.ts  (Admin: platform config)
│   ├── tenant-email-config.controller.ts    (Tenant: email config)
│   ├── email-template.controller.ts         (Template management)
│   ├── communication-history.controller.ts  (View sent emails)
│   ├── notification.controller.ts           (In-app notifications)
│   ├── notification-rule.controller.ts      (Auto-notification rules)
│   └── webhook.controller.ts                (Webhook receivers)
├── services/
│   ├── communication.service.ts             (Main orchestration)
│   ├── json-schema-validator.service.ts     (Validate JSON against schemas)
│   ├── encryption.service.ts                (Encrypt/decrypt credentials)
│   ├── email-template.service.ts            (Template rendering)
│   ├── notification.service.ts              (In-app notifications)
│   ├── notification-rule.service.ts         (Auto-notification rules)
│   └── webhook-processor.service.ts         (Process webhooks)
├── providers/
│   ├── email-provider.interface.ts          (Common interface)
│   ├── email-provider.factory.ts            (Provider factory)
│   ├── smtp-email.provider.ts               (SMTP implementation)
│   ├── sendgrid-email.provider.ts           (SendGrid implementation)
│   ├── amazon-ses-email.provider.ts         (Amazon SES implementation)
│   └── brevo-email.provider.ts              (Brevo implementation)
├── processors/
│   ├── send-email.processor.ts              (BullMQ email queue)
│   └── process-webhook.processor.ts         (BullMQ webhook queue)
├── dto/
│   ├── provider-registry.dto.ts
│   ├── email-config.dto.ts
│   ├── send-email.dto.ts
│   ├── notification.dto.ts
│   └── webhook.dto.ts
└── guards/
    └── webhook-signature.guard.ts (Optional: webhook verification guard)
```

---

## Completion Checklist

**Backend is complete when**:

### **Database**
- [ ] All 7 migrations applied successfully
- [ ] 4 providers seeded (SMTP, SendGrid, SES, Brevo)
- [ ] All indexes created
- [ ] Foreign keys working

### **Services**
- [ ] JSON Schema validation working (test with valid/invalid inputs)
- [ ] Encryption service encrypts/decrypts correctly
- [ ] All 4 email providers can send emails
- [ ] CommunicationService sends emails via all providers
- [ ] Template rendering working (Handlebars)
- [ ] Notification service creates/reads notifications
- [ ] Notification rules trigger correctly

### **Webhooks**
- [ ] SendGrid webhook signature verification working
- [ ] Amazon SES SNS signature verification working
- [ ] Brevo token verification working
- [ ] Webhook processing updates communication_event status
- [ ] Idempotency working (duplicate webhooks ignored)
- [ ] Replay attack protection working (timestamp check)

### **Testing**
- [ ] Unit tests >80% coverage
- [ ] Integration tests passing (all 4 providers)
- [ ] Tenant isolation tests passing
- [ ] Webhook tests passing
- [ ] RBAC tests passing

### **Documentation**
- [ ] API documentation 100% complete (`communication_REST_API.md`)
- [ ] All 37 endpoints documented
- [ ] Swagger/OpenAPI accessible
- [ ] README updated

### **Migration**
- [ ] Auth module migrated to CommunicationService
- [ ] Password reset emails working
- [ ] Account activation emails working

---

## Next Steps

Once backend is complete:
1. Generate complete API documentation
2. Verify all tests passing
3. Deploy to staging environment
4. Configure webhook URLs in provider dashboards
5. Test end-to-end email flow with webhooks
6. **THEN** hand off to frontend developer with API docs

---

**End of Backend Module Documentation**

This document provides complete guidance for implementing the Communication/Notifications module backend. Follow the phases sequentially, reference the contract for detailed specifications, and maintain strict adherence to multi-tenant isolation rules.