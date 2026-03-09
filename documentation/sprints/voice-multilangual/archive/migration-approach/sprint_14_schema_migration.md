# Sprint 14: Prisma Schema Migration
## Voice Multilingual Architecture Fix

**Sprint Number**: 14 of 21
**Sprint Owner**: Database Architect
**Estimated Effort**: 3-4 hours
**Prerequisites**: Sprint 13 complete, server offline, backup confirmed

---

## Sprint Owner Role Definition

You are a **masterclass Database Architect** that makes Google, Amazon, and Apple jealous of your precision and safety-first approach to schema migrations.

**Your Principles**:
- You **NEVER GUESS** - You always verify existing schema patterns before making changes
- You **THINK LIKE A SURGEON** - You make precise, calculated changes with zero collateral damage
- You **PLAN FOR ROLLBACK** - Every migration has a tested rollback procedure
- You **TEST BEFORE DEPLOY** - You never run migrations without dry-run validation
- You **RESPECT DATA INTEGRITY** - Foreign keys, indexes, and constraints are sacred

**You are NOT RUSHING**. Schema changes are permanent. You take your time to get it right.

---

## Sprint Goals

**Primary Objective**: Transform the database schema from tenant-scoped profiles to global profiles with tenant overrides.

**Changes**:
1. ✅ Create `voice_ai_agent_profile` table (global, no tenant_id)
2. ✅ Rename `tenant_voice_agent_profile` → `tenant_voice_ai_agent_profile_override`
3. ✅ Add FK `agent_profile_id` to override table
4. ✅ Add helpful indexes for performance
5. ✅ Generate and test Prisma migration
6. ✅ Document rollback procedure

**NO DATA MIGRATION** in this sprint - that's Sprint 15.

---

## Task 1: Review Existing Schema

### 1.1 Read Current Prisma Schema

**File**: `/var/www/lead360.app/api/prisma/schema.prisma`

Find and read the following models:
- `tenant_voice_agent_profile` (existing, will be renamed)
- `tenant_voice_ai_settings` (has FK to profiles)
- `subscription_plan` (has `voice_ai_max_agent_profiles`)
- `voice_ai_global_config` (pattern reference)
- `voice_ai_provider` (pattern reference - similar to what we're building)

**Understand the existing pattern** before making changes. Never guess field names or relationships.

---

## Task 2: Create Global Profile Model

### 2.1 Add New Model to schema.prisma

**Location**: Add this model BEFORE `tenant_voice_agent_profile` in the schema file.

```prisma
/// Global voice agent profiles managed by system admins
/// Available to all tenants for selection and customization
/// Pattern: Similar to voice_ai_provider (global resource)
model voice_ai_agent_profile {
  id                   String   @id @default(uuid()) @db.VarChar(36)

  // Language Configuration
  language_code        String   @db.VarChar(10)        // ISO 639-1 code: 'en', 'pt', 'es'
  language_name        String   @db.VarChar(100)       // Human-readable: 'English', 'Portuguese'

  // Voice Configuration
  voice_id             String   @db.VarChar(200)       // TTS provider voice identifier
  voice_provider_type  String   @default("tts") @db.VarChar(20)

  // Default Templates
  default_greeting     String?  @db.Text               // Optional default greeting
  default_instructions String?  @db.LongText           // Optional default system instructions

  // Display & Organization
  display_name         String   @db.VarChar(100)       // e.g., "English - Professional"
  description          String?  @db.Text               // Optional description
  is_active            Boolean  @default(true)         // Active/inactive flag
  display_order        Int      @default(0)            // Sort order in UI

  // Audit Fields
  created_at           DateTime @default(now())
  updated_at           DateTime @updatedAt
  updated_by           String?  @db.VarChar(36)        // User UUID

  // Relationships
  tenant_overrides     tenant_voice_ai_agent_profile_override[]

  // Indexes
  @@index([language_code])
  @@index([is_active])
  @@index([display_order])

  @@map("voice_ai_agent_profile")
}
```

**Key Design Decisions**:
- **No `tenant_id`** - This is a global resource
- **`voice_id`** - Provider-specific identifier (e.g., Cartesia UUID)
- **`display_name`** - Shown in admin UI and tenant selectors
- **`is_active`** - Soft delete pattern (never hard delete global resources)
- **Indexes** - Optimized for common queries (language, active status, display order)

---

## Task 3: Rename and Modify Tenant Profile Model

### 3.1 Rename Model

Find the existing `tenant_voice_agent_profile` model and rename it to `tenant_voice_ai_agent_profile_override`.

**Important**: Also update the `@@map()` directive at the bottom of the model.

### 3.2 Add New Fields

Add these fields to the renamed model:

```prisma
model tenant_voice_ai_agent_profile_override {
  id                  String   @id @default(uuid()) @db.VarChar(36)
  tenant_id           String   @db.VarChar(36)
  agent_profile_id    String   @db.VarChar(36)        // NEW: FK to global profile

  // KEEP existing fields:
  // title, language_code, voice_id, custom_greeting, custom_instructions,
  // is_active, display_order, created_at, updated_at, updated_by

  // Relationships
  tenant              tenant                        @relation("tenant_voice_agent_profile_overrides", fields: [tenant_id], references: [id], onDelete: Cascade)
  agent_profile       voice_ai_agent_profile        @relation(fields: [agent_profile_id], references: [id], onDelete: Cascade) // NEW
  settings_default    tenant_voice_ai_settings[]    @relation("settings_default_profile")

  // Indexes
  @@index([tenant_id])
  @@index([tenant_id, is_active])
  @@index([tenant_id, agent_profile_id])   // NEW: Query overrides for a profile
  @@index([agent_profile_id])              // NEW: Find all tenants using a profile

  @@map("tenant_voice_ai_agent_profile_override")
}
```

**Critical Changes**:
1. Add `agent_profile_id` field
2. Add FK relationship to `voice_ai_agent_profile`
3. Add new indexes for performance
4. Update `@@map()` to new table name
5. Update relation name from `"tenant_voice_agent_profiles"` to `"tenant_voice_agent_profile_overrides"`

### 3.3 Update Tenant Relation

In the `tenant` model, find the relation to voice agent profiles and update it:

```prisma
// OLD:
voice_agent_profiles tenant_voice_agent_profile[] @relation("tenant_voice_agent_profiles")

// NEW:
voice_agent_profile_overrides tenant_voice_ai_agent_profile_override[] @relation("tenant_voice_agent_profile_overrides")
```

---

## Task 4: Generate Prisma Migration

### 4.1 Create Migration

```bash
cd /var/www/lead360.app/api

# Generate migration
npx prisma migrate dev --name add_global_voice_profiles_and_rename_tenant_table --create-only

# This creates the migration file but does NOT run it yet
```

**Expected Output**:
```
✔ Your database is now in sync with your Prisma schema
✔ Migration draft created: 20260304xxxxxx_add_global_voice_profiles_and_rename_tenant_table
```

### 4.2 Review Generated SQL

**File**: `api/prisma/migrations/[timestamp]_add_global_voice_profiles_and_rename_tenant_table/migration.sql`

**Verify the SQL includes**:
1. CREATE TABLE `voice_ai_agent_profile` with all columns and indexes
2. RENAME TABLE `tenant_voice_agent_profile` TO `tenant_voice_ai_agent_profile_override`
3. ALTER TABLE to add `agent_profile_id` column (nullable initially)
4. ALTER TABLE to add FK constraint to `voice_ai_agent_profile`
5. CREATE INDEX statements for new indexes

**Example Expected SQL**:
```sql
-- CreateTable
CREATE TABLE `voice_ai_agent_profile` (
    `id` VARCHAR(36) NOT NULL,
    `language_code` VARCHAR(10) NOT NULL,
    `language_name` VARCHAR(100) NOT NULL,
    `voice_id` VARCHAR(200) NOT NULL,
    `voice_provider_type` VARCHAR(20) NOT NULL DEFAULT 'tts',
    `default_greeting` TEXT NULL,
    `default_instructions` LONGTEXT NULL,
    `display_name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by` VARCHAR(36) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `voice_ai_agent_profile_language_code_idx` ON `voice_ai_agent_profile`(`language_code`);

-- CreateIndex
CREATE INDEX `voice_ai_agent_profile_is_active_idx` ON `voice_ai_agent_profile`(`is_active`);

-- CreateIndex
CREATE INDEX `voice_ai_agent_profile_display_order_idx` ON `voice_ai_agent_profile`(`display_order`);

-- RenameTable
ALTER TABLE `tenant_voice_agent_profile` RENAME TO `tenant_voice_ai_agent_profile_override`;

-- AlterTable
ALTER TABLE `tenant_voice_ai_agent_profile_override`
ADD COLUMN `agent_profile_id` VARCHAR(36) NULL;

-- CreateIndex
CREATE INDEX `tenant_voice_ai_agent_profile_override_agent_profile_id_idx`
ON `tenant_voice_ai_agent_profile_override`(`agent_profile_id`);

-- CreateIndex
CREATE INDEX `tenant_voice_ai_agent_profile_override_tenant_id_agent_profile_id_idx`
ON `tenant_voice_ai_agent_profile_override`(`tenant_id`, `agent_profile_id`);

-- AddForeignKey (will be added AFTER data migration in Sprint 15)
-- ALTER TABLE `tenant_voice_ai_agent_profile_override`
-- ADD CONSTRAINT `tenant_voice_ai_agent_profile_override_agent_profile_id_fkey`
-- FOREIGN KEY (`agent_profile_id`) REFERENCES `voice_ai_agent_profile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
```

**IMPORTANT**: The FK constraint addition should be COMMENTED OUT or removed for now - we'll add it AFTER data migration in Sprint 15.

---

## Task 5: Test Migration (Dry Run)

### 5.1 Validate Migration Locally

If you have a local copy of the database:

```bash
# Backup local database first
mysqldump -u root -p lead360_dev > backup_before_migration_$(date +%Y%m%d_%H%M%S).sql

# Run migration on local database
npx prisma migrate dev
```

Verify:
- [ ] New table `voice_ai_agent_profile` created
- [ ] Old table `tenant_voice_agent_profile` renamed to `tenant_voice_ai_agent_profile_override`
- [ ] New column `agent_profile_id` exists (nullable)
- [ ] All indexes created
- [ ] No data lost (all existing records still present)

### 5.2 Validate Prisma Client Generation

```bash
# Regenerate Prisma Client
npx prisma generate

# Check TypeScript types
npx tsc --noEmit
```

**Expected**: No TypeScript errors. Prisma Client should have new types:
- `voice_ai_agent_profile`
- `tenant_voice_ai_agent_profile_override`

---

## Task 6: Execute Production Migration

### 6.1 Pre-Migration Checklist

**VERIFY BEFORE RUNNING**:
- [ ] Server is offline (confirmed in Sprint 13)
- [ ] Recent database backup exists (confirmed in Sprint 13)
- [ ] Migration SQL reviewed and validated (Task 4.2)
- [ ] Local dry-run successful (Task 5.1)
- [ ] Rollback procedure documented (Task 7)

### 6.2 Run Migration on Production Database

```bash
cd /var/www/lead360.app/api

# Connect to production database
# Option 1: If Prisma DATABASE_URL is configured for production
npx prisma migrate deploy

# Option 2: Manual SQL execution
mysql -u lead360_user -p lead360_production < prisma/migrations/[timestamp]_add_global_voice_profiles_and_rename_tenant_table/migration.sql
```

### 6.3 Verify Migration Success

```bash
# Check tables exist
mysql -u lead360_user -p -e "
USE lead360_production;
SHOW TABLES LIKE '%voice%';
DESCRIBE voice_ai_agent_profile;
DESCRIBE tenant_voice_ai_agent_profile_override;
"

# Verify data integrity
mysql -u lead360_user -p -e "
USE lead360_production;
SELECT COUNT(*) as total_records FROM tenant_voice_ai_agent_profile_override;
SELECT COUNT(*) as records_with_null_profile_id FROM tenant_voice_ai_agent_profile_override WHERE agent_profile_id IS NULL;
"
```

**Expected Results**:
- `voice_ai_agent_profile` table exists (0 rows - will be populated in Sprint 15)
- `tenant_voice_ai_agent_profile_override` table exists (same row count as before migration)
- All `agent_profile_id` values are NULL (will be populated in Sprint 15)

---

## Task 7: Document Rollback Procedure

### 7.1 Create Rollback Migration

Create: `api/prisma/migrations/[timestamp]_rollback_global_voice_profiles/migration.sql`

```sql
-- Rollback Migration: Revert to original schema

-- Remove FK constraint (if it was added)
ALTER TABLE `tenant_voice_ai_agent_profile_override`
DROP FOREIGN KEY IF EXISTS `tenant_voice_ai_agent_profile_override_agent_profile_id_fkey`;

-- Remove new column
ALTER TABLE `tenant_voice_ai_agent_profile_override`
DROP COLUMN `agent_profile_id`;

-- Remove new indexes
DROP INDEX `tenant_voice_ai_agent_profile_override_agent_profile_id_idx`
ON `tenant_voice_ai_agent_profile_override`;

DROP INDEX `tenant_voice_ai_agent_profile_override_tenant_id_agent_profile_id_idx`
ON `tenant_voice_ai_agent_profile_override`;

-- Rename table back to original name
ALTER TABLE `tenant_voice_ai_agent_profile_override` RENAME TO `tenant_voice_agent_profile`;

-- Drop global profiles table
DROP TABLE IF EXISTS `voice_ai_agent_profile`;
```

### 7.2 Test Rollback (if needed)

**Only execute if migration fails and rollback is required**:

```bash
mysql -u lead360_user -p lead360_production < api/prisma/migrations/[timestamp]_rollback_global_voice_profiles/migration.sql

# Then restore from backup
mysql -u lead360_user -p lead360_production < /var/backups/mysql/lead360_production_YYYYMMDD.sql
```

---

## Acceptance Criteria

Sprint 14 is complete when ALL of the following are true:

- [ ] `voice_ai_agent_profile` model added to Prisma schema
- [ ] `tenant_voice_agent_profile` renamed to `tenant_voice_ai_agent_profile_override`
- [ ] `agent_profile_id` field added to override model (nullable)
- [ ] All indexes created successfully
- [ ] Prisma migration generated and reviewed
- [ ] Migration executed on production database
- [ ] Database structure verified (tables, columns, indexes exist)
- [ ] Data integrity verified (no data lost, row counts match)
- [ ] Prisma client regenerated successfully
- [ ] TypeScript compilation successful (no type errors)
- [ ] Rollback procedure documented and tested (if migration failed)

---

## Deliverables

### Files Modified
1. **`api/prisma/schema.prisma`** - Updated with new models
2. **`api/prisma/migrations/[timestamp]_add_global_voice_profiles_and_rename_tenant_table/migration.sql`** - Migration SQL

### Files Created
1. **`api/prisma/migrations/[timestamp]_rollback_global_voice_profiles/migration.sql`** - Rollback SQL
2. **`documentation/sprints/voice-multilangual/schema_migration_report.md`** - Migration execution report

---

## Common Pitfalls to Avoid

1. ❌ **Don't run migration without backup** - Always verify backup exists first
2. ❌ **Don't skip SQL review** - Always read generated SQL before executing
3. ❌ **Don't add FK constraint now** - Wait until Sprint 15 (after data migration)
4. ❌ **Don't guess field names** - Always check existing Prisma patterns
5. ❌ **Don't rename relations incorrectly** - Update ALL references in tenant model

---

## Next Sprint

**Sprint 15**: Data Migration - Populate global profiles and link tenant overrides

**Prerequisites for Sprint 15**:
- This sprint (14) must be 100% complete
- Database schema matches new design
- All tables and indexes exist
- No data lost during table rename

---

**Sprint Status**: Ready to Execute
**Owner**: Database Architect
