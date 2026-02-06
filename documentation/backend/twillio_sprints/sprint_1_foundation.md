# Sprint 1: Foundation & Database Schema

**Duration**: Week 1
**Goal**: Establish database foundation and module structure for Twilio integration
**Sprint Type**: Infrastructure & Database Setup
**Estimated Effort**: 2-3 days

---

## Overview

This sprint establishes the foundational database schema and module structure required for the Twilio SMS/Calls integration. All new database tables will follow existing Lead360 patterns with strict multi-tenant isolation, proper indexing, and encrypted credential storage.

---

## Prerequisites

- [ ] Read `/var/www/lead360.app/documentation/BACKEND_AGENT.md`
- [ ] Read `/var/www/lead360.app/documentation/contracts/twillio-contract.md`
- [ ] Read `/var/www/lead360.app/documentation/backend/module-twillio.md`
- [ ] Understand existing communication module structure
- [ ] Understand Prisma schema conventions (snake_case, tenant_id enforcement)

---

## Task Breakdown

### Task 1.1: Update Prisma Schema

**File**: `/var/www/lead360.app/api/prisma/schema.prisma`

**Action**: Add 7 new models following existing patterns

#### Model 1: TenantSmsConfig

```prisma
model TenantSmsConfig {
  id                String    @id @default(uuid())
  tenant_id         String
  provider_id       String
  credentials       String    @db.Text // Encrypted JSON
  from_phone        String    // E.164 format
  is_active         Boolean   @default(true)
  is_verified       Boolean   @default(false)
  webhook_secret    String?
  created_at        DateTime  @default(now())
  updated_at        DateTime  @updatedAt

  // Relations
  tenant            Tenant    @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  provider          CommunicationProvider @relation(fields: [provider_id], references: [id])

  // Indexes
  @@unique([tenant_id, provider_id])
  @@index([tenant_id, is_active])
  @@index([provider_id])
  @@map("tenant_sms_config")
}
```

#### Model 2: TenantWhatsAppConfig

```prisma
model TenantWhatsAppConfig {
  id                String    @id @default(uuid())
  tenant_id         String
  provider_id       String
  credentials       String    @db.Text // Encrypted JSON
  from_phone        String    // E.164 format with 'whatsapp:' prefix
  is_active         Boolean   @default(true)
  is_verified       Boolean   @default(false)
  webhook_secret    String?
  created_at        DateTime  @default(now())
  updated_at        DateTime  @updatedAt

  // Relations
  tenant            Tenant    @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  provider          CommunicationProvider @relation(fields: [provider_id], references: [id])

  // Indexes
  @@unique([tenant_id, provider_id])
  @@index([tenant_id, is_active])
  @@index([provider_id])
  @@map("tenant_whatsapp_config")
}
```

#### Model 3: CallRecord

```prisma
model CallRecord {
  id                        String    @id @default(uuid())
  tenant_id                 String?   // Nullable for system-level calls
  lead_id                   String?   // Nullable until matched
  twilio_config_id          String?
  twilio_call_sid           String    @unique
  direction                 String    // 'inbound' | 'outbound'
  from_number               String
  to_number                 String
  status                    String    // 'initiated' | 'ringing' | 'in_progress' | 'completed' | 'failed' | 'no_answer' | 'busy' | 'canceled'
  call_type                 String    // 'customer_call' | 'office_bypass_call' | 'ivr_routed_call'
  initiated_by              String?   // User ID if outbound
  call_reason               String?   @db.Text
  recording_url             String?
  recording_duration_seconds Int?
  recording_status          String    @default("pending") // 'pending' | 'available' | 'processing_transcription' | 'transcribed' | 'failed'
  transcription_id          String?   @unique
  ivr_action_taken          Json?
  consent_message_played    Boolean   @default(false)
  cost                      Decimal?  @db.Decimal(10, 4)
  started_at                DateTime?
  ended_at                  DateTime?
  created_at                DateTime  @default(now())
  updated_at                DateTime  @updatedAt

  // Relations
  tenant                    Tenant?   @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  lead                      Lead?     @relation(fields: [lead_id], references: [id], onDelete: SetNull)
  initiated_by_user         User?     @relation(fields: [initiated_by], references: [id], onDelete: SetNull)
  transcription             CallTranscription? @relation(fields: [transcription_id], references: [id])

  // Indexes
  @@index([tenant_id, created_at])
  @@index([tenant_id, status])
  @@index([tenant_id, lead_id])
  @@index([twilio_call_sid])
  @@index([from_number])
  @@index([to_number])
  @@index([recording_status])
  @@map("call_record")
}
```

#### Model 4: IvrConfiguration

```prisma
model IvrConfiguration {
  id                String    @id @default(uuid())
  tenant_id         String    @unique
  twilio_config_id  String?
  ivr_enabled       Boolean   @default(false)
  greeting_message  String    @db.Text
  menu_options      Json      // Array of menu option objects
  default_action    Json      // Action if no input
  timeout_seconds   Int       @default(10)
  max_retries       Int       @default(3)
  status            String    @default("active") // 'active' | 'inactive'
  created_at        DateTime  @default(now())
  updated_at        DateTime  @updatedAt

  // Relations
  tenant            Tenant    @relation(fields: [tenant_id], references: [id], onDelete: Cascade)

  // Indexes
  @@index([tenant_id])
  @@map("ivr_configuration")
}
```

#### Model 5: OfficeNumberWhitelist

```prisma
model OfficeNumberWhitelist {
  id                String    @id @default(uuid())
  tenant_id         String
  phone_number      String    // E.164 format
  label             String
  status            String    @default("active") // 'active' | 'inactive'
  created_at        DateTime  @default(now())
  updated_at        DateTime  @updatedAt

  // Relations
  tenant            Tenant    @relation(fields: [tenant_id], references: [id], onDelete: Cascade)

  // Indexes
  @@unique([tenant_id, phone_number])
  @@index([tenant_id, status])
  @@index([phone_number])
  @@map("office_number_whitelist")
}
```

#### Model 6: CallTranscription

```prisma
model CallTranscription {
  id                        String    @id @default(uuid())
  tenant_id                 String?   // Nullable for system-level
  call_record_id            String    @unique
  transcription_provider    String    // 'openai_whisper' | 'oracle' | 'assemblyai'
  status                    String    @default("queued") // 'queued' | 'processing' | 'completed' | 'failed'
  transcription_text        String?   @db.Text // Full-text searchable
  language_detected         String?   // ISO code
  confidence_score          Decimal?  @db.Decimal(3, 2)
  processing_duration_seconds Int?
  cost                      Decimal?  @db.Decimal(10, 4)
  error_message             String?   @db.Text
  created_at                DateTime  @default(now())
  completed_at              DateTime?

  // Relations
  tenant                    Tenant?   @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  call_record               CallRecord @relation(fields: [call_record_id], references: [id], onDelete: Cascade)

  // Indexes
  @@index([tenant_id, status])
  @@index([call_record_id])
  @@fulltext([transcription_text]) // Full-text search index
  @@map("call_transcription")
}
```

#### Model 7: TranscriptionProviderConfiguration

```prisma
model TranscriptionProviderConfiguration {
  id                String    @id @default(uuid())
  tenant_id         String?   // Nullable for system-level providers
  provider_name     String    // 'openai_whisper' | 'oracle' | 'assemblyai' | 'deepgram'
  is_system_default Boolean   @default(false)
  status            String    @default("active") // 'active' | 'inactive'
  configuration_json String   @db.Text // Encrypted JSON (API keys, model settings)
  usage_limit       Int?      // Messages per month
  usage_current     Int       @default(0)
  cost_per_minute   Decimal?  @db.Decimal(10, 4)
  created_at        DateTime  @default(now())
  updated_at        DateTime  @updatedAt

  // Relations
  tenant            Tenant?   @relation(fields: [tenant_id], references: [id], onDelete: Cascade)

  // Indexes
  @@index([tenant_id])
  @@index([provider_name])
  @@index([is_system_default, status])
  @@map("transcription_provider_configuration")
}
```

**CRITICAL**: Add relations to existing models:

```prisma
// In Tenant model, add these relations:
model Tenant {
  // ... existing fields

  tenant_sms_configs            TenantSmsConfig[]
  tenant_whatsapp_configs       TenantWhatsAppConfig[]
  call_records                  CallRecord[]
  ivr_configuration             IvrConfiguration?
  office_number_whitelists      OfficeNumberWhitelist[]
  call_transcriptions           CallTranscription[]
  transcription_provider_configs TranscriptionProviderConfiguration[]

  // ... existing relations
}

// In User model, add:
model User {
  // ... existing fields

  initiated_calls               CallRecord[]

  // ... existing relations
}

// In Lead model, add:
model Lead {
  // ... existing fields

  call_records                  CallRecord[]

  // ... existing relations
}

// In CommunicationProvider model, add:
model CommunicationProvider {
  // ... existing fields

  tenant_sms_configs            TenantSmsConfig[]
  tenant_whatsapp_configs       TenantWhatsAppConfig[]

  // ... existing relations
}
```

---

### Task 1.2: Create Database Migration

**Command**:
```bash
cd /var/www/lead360.app/api
npx prisma migrate dev --name add_twilio_sms_whatsapp_call_support
```

**Expected Output**:
- Migration file created in `prisma/migrations/[timestamp]_add_twilio_sms_whatsapp_call_support/`
- Migration SQL generated
- Migration applied to database
- No errors

**Post-Migration Verification**:
```bash
# Regenerate Prisma Client
npx prisma generate

# Verify no errors
echo "Migration complete!"
```

---

### Task 1.3: Register BullMQ Queues

**File**: `/var/www/lead360.app/api/src/modules/communication/communication.module.ts`

**Action**: Add new queues to BullModule registration

**Find this section**:
```typescript
BullModule.registerQueue(
  { name: 'communication-email' },
  { name: 'communication-sms' },
  { name: 'communication-whatsapp' },
  { name: 'communication-notifications' },
),
```

**Change to**:
```typescript
BullModule.registerQueue(
  { name: 'communication-email' },
  { name: 'communication-sms' },
  { name: 'communication-whatsapp' },
  { name: 'communication-notifications' },
  { name: 'communication-call-transcription' },      // NEW
  { name: 'communication-twilio-usage-sync' },       // NEW
),
```

---

### Task 1.4: Update Prisma Middleware for Tenant Isolation

**File**: `/var/www/lead360.app/api/src/core/database/prisma.service.ts`

**Action**: Add new tenant-scoped models to middleware

**Find the TENANT_SCOPED_MODELS array** and add:
```typescript
const TENANT_SCOPED_MODELS = [
  'User',
  'AuditLog',
  'RefreshToken',
  'Role',
  'Permission',
  // ... existing models
  'TenantSmsConfig',              // NEW
  'TenantWhatsAppConfig',         // NEW
  'CallRecord',                   // NEW (nullable tenant_id, but enforce when present)
  'IvrConfiguration',             // NEW
  'OfficeNumberWhitelist',        // NEW
  'CallTranscription',            // NEW (nullable tenant_id, but enforce when present)
  'TranscriptionProviderConfiguration', // NEW (nullable tenant_id for system-level)
];
```

**Special Handling for Nullable tenant_id**:

For `CallRecord` and `CallTranscription` which have nullable `tenant_id`, the middleware should:
- Enforce `tenant_id` filter when tenant context exists
- Allow queries without `tenant_id` only for system-level operations (SystemAdmin role)

---

## Acceptance Criteria

- [ ] All 7 Prisma models created with correct fields and types
- [ ] All models use `String @id @default(uuid())` for primary keys
- [ ] All tenant-scoped tables have `tenant_id` field with proper index
- [ ] All relations defined correctly (foreign keys, cascade rules)
- [ ] All indexes created for performance (tenant_id composites)
- [ ] Unique constraints added where needed (twilio_call_sid, etc.)
- [ ] Full-text index added to `call_transcription.transcription_text`
- [ ] Database migration runs successfully without errors
- [ ] Prisma Client regenerated successfully
- [ ] BullMQ queues registered in module
- [ ] Prisma middleware updated to enforce tenant isolation
- [ ] No breaking changes to existing models
- [ ] Migration reversible (can rollback if needed)

---

## Verification Steps

### 1. Schema Validation
```bash
cd /var/www/lead360.app/api
npx prisma validate
```
**Expected**: "The schema is valid ✓"

### 2. Migration Test
```bash
# Run migration
npx prisma migrate dev --name add_twilio_sms_whatsapp_call_support

# Check for errors
echo $?  # Should be 0
```

### 3. Database Verification
```bash
# Connect to database and verify tables exist
npx prisma studio
# Or use MySQL client to check tables
```

### 4. Module Registration
```bash
# Start development server
npm run start:dev

# Check logs for BullMQ queue registration
# Should see: "Registered queue: communication-call-transcription"
# Should see: "Registered queue: communication-twilio-usage-sync"
```

---

## Rollback Plan

If migration fails:
```bash
# Rollback migration
npx prisma migrate reset

# Or manually drop tables
# DROP TABLE call_transcription;
# DROP TABLE transcription_provider_configuration;
# DROP TABLE call_record;
# DROP TABLE ivr_configuration;
# DROP TABLE office_number_whitelist;
# DROP TABLE tenant_sms_config;
# DROP TABLE tenant_whatsapp_config;
```

---

## Files Modified

- `/api/prisma/schema.prisma`
- `/api/src/modules/communication/communication.module.ts`
- `/api/src/core/database/prisma.service.ts`

---

## Files Created

- `/api/prisma/migrations/[timestamp]_add_twilio_sms_whatsapp_call_support/migration.sql`

---

## Common Issues & Solutions

**Issue 1**: Migration fails due to existing data
- **Solution**: Ensure tenant_id is nullable during migration, then backfill data

**Issue 2**: Relation errors
- **Solution**: Verify all referenced models exist (Tenant, User, Lead, CommunicationProvider)

**Issue 3**: Index creation fails
- **Solution**: Check for duplicate index names, ensure unique constraint violations don't exist

---

## Next Steps

After Sprint 1 completion:
- ✅ Database schema established
- ➡️ Proceed to **Sprint 2: SMS & WhatsApp Configuration Management**

---

**Sprint 1 Complete**: Database foundation ready for Twilio integration
