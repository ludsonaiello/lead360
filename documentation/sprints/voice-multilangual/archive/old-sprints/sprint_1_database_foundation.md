# Sprint 1: Database Foundation & Schema Migration

## 🎯 Sprint Owner Role

You are a **MASTERCLASS DATABASE ARCHITECT** that makes Google, Amazon, and Apple database engineers jealous of your work.

You are building a database schema that will handle real business data for thousands of tenants. You **think deeply**, **breathe database design**, and **never rush**. You **always review your work** multiple times before executing migrations. You **never guess** table names, column types, or relationships - you **always verify** by reading the existing schema and understanding established patterns.

You **respect multi-tenant isolation as sacred** - every tenant-scoped table MUST have proper indexes and foreign keys. You understand that a single mistake in schema design can cause data breaches or performance issues that affect the entire platform.

Your code quality must be **100% perfect or beyond**. Migrations are irreversible in production - you get ONE chance to get it right.

---

## 📋 Sprint Objective

Create the database foundation for the multi-language voice agent profiles feature by:
1. Adding a new `tenant_voice_agent_profile` table
2. Adding `voice_ai_max_agent_profiles` column to `subscription_plan` table
3. Adding `default_agent_profile_id` column to `tenant_voice_ai_settings` table
4. Creating a properly named migration
5. Executing the migration and verifying schema correctness

---

## 📚 Required Reading (READ IN THIS ORDER)

1. **Feature Contract** (your bible): `/var/www/lead360.app/documentation/contracts/voice-multilangual-contract.md`
   - Section 4: New Database Model (tenant_voice_agent_profile)
   - Section 5: Schema Modifications to Existing Models
   - Section 12: Prisma Migration Requirements

2. **Existing Schema** (study patterns): `/var/www/lead360.app/api/prisma/schema.prisma`
   - Study `tenant_voice_ai_settings` model (lines ~300-350)
   - Study `subscription_plan` model (lines ~100-150)
   - Study `tenant_voice_transfer_number` model (similar pattern to what you're building)
   - Understand index patterns, relation patterns, onDelete behaviors

3. **Recent Migrations** (understand naming and structure):
   - `/var/www/lead360.app/api/prisma/migrations/20260227_add_voice_conversational_phrases/`
   - `/var/www/lead360.app/api/prisma/migrations/20260206_sprint_11_admin_crud_enhancements/`

---

## 🔐 Test Environment

**Database Connection**:
```bash
DATABASE_URL="mysql://lead360_user:978@F32c@127.0.0.1:3306/lead360"
```

**Test Credentials**:
- System Admin: `ludsonaiello@gmail.com` / `978@F32c`
- Tenant User: `contact@honeydo4you.com` / `978@F32c`

**Server Mode**: Development server (`npm run start:dev` in `/var/www/lead360.app/api/`)
**NOT using PM2** - direct dev server for immediate feedback

---

## 📐 Technical Specification

### 1. New Table: `tenant_voice_agent_profile`

**Purpose**: Stores named voice agent profiles with language + voice bindings per tenant

**Prisma Model** (add to schema.prisma):

```prisma
model tenant_voice_agent_profile {
  id                   String   @id @default(uuid()) @db.VarChar(36)
  tenant_id            String   @db.VarChar(36)
  title                String   @db.VarChar(100)
  language_code        String   @db.VarChar(10)
  voice_id             String   @db.VarChar(200)
  custom_greeting      String?  @db.Text
  custom_instructions  String?  @db.LongText
  is_active            Boolean  @default(true)
  display_order        Int      @default(0)
  created_at           DateTime @default(now())
  updated_at           DateTime @updatedAt
  updated_by           String?  @db.VarChar(36)

  tenant               tenant   @relation("tenant_voice_agent_profiles", fields: [tenant_id], references: [id], onDelete: Cascade)

  settings_default     tenant_voice_ai_settings[] @relation("settings_default_profile")

  @@index([tenant_id])
  @@index([tenant_id, is_active])
  @@index([tenant_id, language_code])
  @@map("tenant_voice_agent_profile")
}
```

**Business Rules**:
- `tenant_id`: Multi-tenant isolation (CRITICAL - every query filters by this)
- `title`: Human-readable name (e.g., "Main Agent", "Agente Portugues")
- `language_code`: BCP-47 code ('en', 'pt', 'es')
- `voice_id`: Provider-specific TTS voice ID (Cartesia UUID)
- `custom_greeting`: Profile-level greeting (overrides tenant default if set)
- `custom_instructions`: **APPENDS** to tenant-level instructions (confirmed requirement)
- `is_active`: Inactive profiles cannot be selected in new IVR configs
- `display_order`: Sort order in UI dropdowns

**Indexes**:
- Primary: `tenant_id` (most common query filter)
- Composite: `tenant_id + is_active` (list active profiles)
- Composite: `tenant_id + language_code` (filter by language)

---

### 2. Extend `subscription_plan` Table

**Add Column**:
```prisma
voice_ai_max_agent_profiles  Int  @default(1)
```

**Purpose**: Controls how many active agent profiles a tenant can create

**Business Rule**:
- Minimum value: 1 (enforced at service layer, not database)
- Default: 1 for all existing plans (confirmed requirement)
- Used by service to enforce quota before creating new profiles

**Migration Note**: All existing `subscription_plan` rows will receive default value of `1`

---

### 3. Extend `tenant_voice_ai_settings` Table

**Add Column**:
```prisma
default_agent_profile_id  String?  @db.VarChar(36)
```

**Add Relation**:
```prisma
default_agent_profile  tenant_voice_agent_profile?  @relation("settings_default_profile", fields: [default_agent_profile_id], references: [id], onDelete: SetNull)
```

**Purpose**: Fallback profile when IVR voice_ai action has no profile specified

**Business Rule**:
- Nullable (optional fallback)
- If profile is deleted, this FK automatically becomes NULL (`onDelete: SetNull`)
- If NULL and no IVR profile, existing behavior applies (voice_id_override + default_language)

---

## 🔨 Implementation Tasks

### Task 1: Update Prisma Schema (30 minutes)

**File**: `/var/www/lead360.app/api/prisma/schema.prisma`

**Steps**:
1. **Locate insertion point** for new model:
   - Search for `model tenant_voice_ai_settings` (around line 300)
   - Add new `tenant_voice_agent_profile` model AFTER `tenant_voice_ai_settings`

2. **Add new model** (copy spec from above)
   - Include ALL columns with exact types
   - Include ALL indexes
   - Include ALL relations
   - Double-check relation names match both sides

3. **Update `subscription_plan` model**:
   - Search for `model subscription_plan` (around line 100)
   - Find existing voice_ai fields (voice_ai_enabled, voice_ai_minutes_included)
   - Add `voice_ai_max_agent_profiles Int @default(1)` after other voice_ai fields

4. **Update `tenant_voice_ai_settings` model**:
   - Search for `model tenant_voice_ai_settings`
   - Add `default_agent_profile_id String? @db.VarChar(36)` column
   - Add relation to `tenant_voice_agent_profile` (see spec above)

5. **Update `tenant` model**:
   - Search for `model tenant`
   - Add to relations section: `voice_agent_profiles tenant_voice_agent_profile[] @relation("tenant_voice_agent_profiles")`

**Validation**:
```bash
cd /var/www/lead360.app/api
npx prisma format
npx prisma validate
```

If validation fails, review error messages carefully and fix syntax issues.

---

### Task 2: Create Migration (30 minutes)

**Generate Migration**:
```bash
cd /var/www/lead360.app/api
npx prisma migrate dev --name add_multi_language_voice_agent_profiles
```

**What This Does**:
1. Compares current schema with database state
2. Generates SQL migration file
3. **Automatically applies migration to dev database**
4. Updates Prisma client

**Expected Migration File Location**:
`/var/www/lead360.app/api/prisma/migrations/YYYYMMDD_add_multi_language_voice_agent_profiles/migration.sql`

**Expected Migration SQL** (verify this matches what Prisma generates):

```sql
-- CreateTable
CREATE TABLE `tenant_voice_agent_profile` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `title` VARCHAR(100) NOT NULL,
    `language_code` VARCHAR(10) NOT NULL,
    `voice_id` VARCHAR(200) NOT NULL,
    `custom_greeting` TEXT NULL,
    `custom_instructions` LONGTEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by` VARCHAR(36) NULL,

    INDEX `tenant_voice_agent_profile_tenant_id_idx`(`tenant_id`),
    INDEX `tenant_voice_agent_profile_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
    INDEX `tenant_voice_agent_profile_tenant_id_language_code_idx`(`tenant_id`, `language_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable subscription_plan
ALTER TABLE `subscription_plan` ADD COLUMN `voice_ai_max_agent_profiles` INTEGER NOT NULL DEFAULT 1;

-- AlterTable tenant_voice_ai_settings
ALTER TABLE `tenant_voice_ai_settings` ADD COLUMN `default_agent_profile_id` VARCHAR(36) NULL;

-- AddForeignKey (tenant_voice_agent_profile → tenant)
ALTER TABLE `tenant_voice_agent_profile` ADD CONSTRAINT `tenant_voice_agent_profile_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey (tenant_voice_ai_settings → tenant_voice_agent_profile)
ALTER TABLE `tenant_voice_ai_settings` ADD CONSTRAINT `tenant_voice_ai_settings_default_agent_profile_id_fkey` FOREIGN KEY (`default_agent_profile_id`) REFERENCES `tenant_voice_agent_profile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
```

**Review Checklist**:
- ✅ Table name: `tenant_voice_agent_profile` (singular, snake_case)
- ✅ All columns present with correct types
- ✅ All indexes created (3 indexes)
- ✅ Foreign keys with correct onDelete behavior (Cascade for tenant, SetNull for default_agent_profile_id)
- ✅ `subscription_plan` column added with DEFAULT 1
- ✅ `tenant_voice_ai_settings` column added as NULL

---

### Task 3: Verify Migration Success (15 minutes)

**Check 1: Prisma Client Updated**
```bash
cd /var/www/lead360.app/api
npx prisma generate
```

**Check 2: Query New Model**
Create test file `/var/www/lead360.app/api/test-schema.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testSchema() {
  console.log('Testing new schema...');

  // Test 1: Can query new table
  const profiles = await prisma.tenant_voice_agent_profile.findMany({
    take: 1,
  });
  console.log('✅ tenant_voice_agent_profile table accessible');

  // Test 2: subscription_plan has new column
  const plan = await prisma.subscription_plan.findFirst({
    select: { voice_ai_max_agent_profiles: true },
  });
  console.log('✅ voice_ai_max_agent_profiles column exists:', plan?.voice_ai_max_agent_profiles);

  // Test 3: tenant_voice_ai_settings has new column
  const settings = await prisma.tenant_voice_ai_settings.findFirst({
    select: { default_agent_profile_id: true },
  });
  console.log('✅ default_agent_profile_id column exists (nullable)');

  console.log('✅ All schema changes verified!');
}

testSchema()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Run test:
```bash
cd /var/www/lead360.app/api
npx ts-node test-schema.ts
```

Expected output:
```
Testing new schema...
✅ tenant_voice_agent_profile table accessible
✅ voice_ai_max_agent_profiles column exists: 1
✅ default_agent_profile_id column exists (nullable)
✅ All schema changes verified!
```

**Check 3: Foreign Key Behavior**

Test onDelete: SetNull behavior:
```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testForeignKeys() {
  // Create test profile
  const profile = await prisma.tenant_voice_agent_profile.create({
    data: {
      tenant_id: '<existing-tenant-id>',  // Use real tenant ID from your test data
      title: 'Test Profile',
      language_code: 'en',
      voice_id: 'test-voice-id',
      is_active: true,
    },
  });
  console.log('✅ Created test profile:', profile.id);

  // Set as default in settings
  await prisma.tenant_voice_ai_settings.update({
    where: { tenant_id: profile.tenant_id },
    data: { default_agent_profile_id: profile.id },
  });
  console.log('✅ Set as default profile in settings');

  // Delete profile - FK should become NULL
  await prisma.tenant_voice_agent_profile.delete({
    where: { id: profile.id },
  });
  console.log('✅ Deleted profile');

  // Verify settings FK is now NULL
  const settings = await prisma.tenant_voice_ai_settings.findUnique({
    where: { tenant_id: profile.tenant_id },
    select: { default_agent_profile_id: true },
  });

  if (settings?.default_agent_profile_id === null) {
    console.log('✅ FK correctly set to NULL after delete');
  } else {
    console.error('❌ FK not NULL after delete - onDelete: SetNull not working!');
  }
}

testForeignKeys()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**Check 4: Indexes Created**

Verify indexes exist in database:
```bash
mysql -u lead360_user -p'978@F32c' lead360 -e "SHOW INDEXES FROM tenant_voice_agent_profile;"
```

Expected output should show 4 indexes:
1. PRIMARY (id)
2. tenant_voice_agent_profile_tenant_id_idx
3. tenant_voice_agent_profile_tenant_id_is_active_idx
4. tenant_voice_agent_profile_tenant_id_language_code_idx

---

## ✅ Acceptance Criteria

Before marking this sprint complete, verify ALL of the following:

### Database Schema
- ✅ `tenant_voice_agent_profile` table exists with all 13 columns
- ✅ All column types match specification exactly
- ✅ All 3 indexes created (tenant_id, tenant_id+is_active, tenant_id+language_code)
- ✅ `subscription_plan.voice_ai_max_agent_profiles` column exists with default value 1
- ✅ `tenant_voice_ai_settings.default_agent_profile_id` column exists (nullable)

### Foreign Keys
- ✅ `tenant_voice_agent_profile.tenant_id` → `tenant.id` (onDelete: Cascade)
- ✅ `tenant_voice_ai_settings.default_agent_profile_id` → `tenant_voice_agent_profile.id` (onDelete: SetNull)
- ✅ Deleting a profile sets settings FK to NULL (tested)
- ✅ Deleting a tenant deletes all its profiles (cascade tested)

### Prisma Client
- ✅ `npx prisma generate` runs without errors
- ✅ Can query `tenant_voice_agent_profile` via Prisma
- ✅ Can select new columns on `subscription_plan` and `tenant_voice_ai_settings`
- ✅ TypeScript types updated (no compilation errors)

### Migration
- ✅ Migration file created with correct name format
- ✅ Migration applied successfully
- ✅ Migration SQL reviewed and matches specification
- ✅ No errors in migration log

### Documentation
- ✅ Migration file is self-documenting (clear SQL)
- ✅ Schema comments added if needed
- ✅ This sprint document updated with any deviations

---

## 🚨 Common Issues & Solutions

### Issue 1: Migration Fails - "Table already exists"
**Cause**: Migration was partially applied or run twice
**Solution**:
```bash
# Reset to last migration
npx prisma migrate reset

# Re-run migration
npx prisma migrate dev --name add_multi_language_voice_agent_profiles
```

### Issue 2: Foreign Key Constraint Error
**Cause**: Trying to set `default_agent_profile_id` to non-existent profile
**Solution**: Verify profile exists and belongs to same tenant before setting FK

### Issue 3: Prisma Validate Fails - Relation Error
**Cause**: Relation names don't match on both sides
**Solution**: Ensure `@relation("name")` is identical in both models

### Issue 4: TypeScript Compilation Errors After Migration
**Cause**: Prisma client not regenerated
**Solution**:
```bash
npx prisma generate
npm run build
```

---

## 📊 Sprint Completion Report Template

```markdown
## Sprint 1 Completion Report: Database Foundation

**Status**: ✅ Complete / ⚠️ Needs Review / ❌ Blocked

### Schema Changes Applied
- ✅ tenant_voice_agent_profile table created (13 columns, 3 indexes)
- ✅ subscription_plan.voice_ai_max_agent_profiles added (default: 1)
- ✅ tenant_voice_ai_settings.default_agent_profile_id added (nullable)

### Foreign Keys Verified
- ✅ tenant_id → tenant.id (onDelete: Cascade) - TESTED
- ✅ default_agent_profile_id → tenant_voice_agent_profile.id (onDelete: SetNull) - TESTED

### Migration Details
- Migration name: add_multi_language_voice_agent_profiles
- Migration timestamp: YYYYMMDDHHMMSS
- SQL file location: /var/www/lead360.app/api/prisma/migrations/[timestamp]_add_multi_language_voice_agent_profiles/migration.sql
- Applied successfully: ✅ Yes / ❌ No

### Testing Performed
- ✅ Can query new table via Prisma
- ✅ Can select new columns on existing tables
- ✅ FK onDelete: SetNull behavior verified
- ✅ FK onDelete: Cascade behavior verified
- ✅ Indexes verified in database

### Issues Encountered
[List any issues and how they were resolved, or write "None"]

### Next Sprint Dependencies
- ✅ Schema ready for Sprint 2 (service layer development)
- ✅ Prisma client updated and types available

**Sprint Owner**: [Your Name]
**Completion Date**: [Date]
```

---

## 🎯 Remember

- **Multi-tenant isolation is SACRED** - the `tenant_id` index is CRITICAL
- **Foreign keys protect data integrity** - onDelete behavior must match business rules
- **Migrations are irreversible in production** - review SQL THREE times before applying
- **Test FK behavior** - don't just assume onDelete works, verify it
- **Document deviations** - if you change anything from spec, document WHY

**You are a masterclass developer. Your migration will be perfect. Review it, test it, verify it, then mark it complete.**

🚀 **Ready to build the foundation? Let's go!**
