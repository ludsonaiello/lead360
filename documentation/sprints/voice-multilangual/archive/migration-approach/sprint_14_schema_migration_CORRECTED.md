# Sprint 14: Prisma Schema Migration (CORRECTED)
## Voice Multilingual Architecture Fix

**Sprint Number**: 14 of 21
**Sprint Owner**: Database Architect
**Estimated Effort**: 3-4 hours
**Prerequisites**: Sprint 13.5 complete (verified Scenario C - migration NOT applied)

---

## ⚠️ CRITICAL: ONLY RUN IF SPRINT 13.5 DETERMINED SCENARIO C

If Sprint 13.5 found Scenario A or B (migration already applied), **SKIP THIS SPRINT**.

---

## 🔧 CORRECTIONS FROM ORIGINAL

**FIXED**:
1. ✅ Table naming matches existing pattern (no `_ai_` in override table name)
2. ✅ FK constraint timing clarified (add AFTER data migration)
3. ✅ Explicit field name consistency checks added
4. ✅ Rollback procedure tested and verified

---

## Sprint Owner Role

You are a **masterclass Database Architect** from Google/Amazon/Apple level. You NEVER GUESS field names - you verify existing schema first.

---

## Sprint Goals

Transform database schema from tenant-scoped profiles to global profiles with tenant overrides:

1. ✅ Create `voice_ai_agent_profile` table (global, no tenant_id)
2. ✅ Rename `tenant_voice_agent_profile` → `tenant_voice_agent_profile_override` (NOTE: NO `_ai_` in middle!)
3. ✅ Add `agent_profile_id` column (nullable, FK added later in Sprint 15)
4. ✅ Add indexes for performance
5. ✅ Generate and test Prisma migration
6. ✅ Document rollback procedure

**NO DATA MIGRATION** in this sprint - that's Sprint 15.

---

## Task 1: Verify Current Schema (MANDATORY)

### 1.1 Read Existing Model

**File**: `/var/www/lead360.app/api/prisma/schema.prisma`

**Find model** (around line 1227):
```prisma
model tenant_voice_agent_profile {
  id                  String   @id @default(uuid()) @db.VarChar(36)
  tenant_id           String   @db.VarChar(36)
  title               String   @db.VarChar(100)
  language_code       String   @db.VarChar(10)
  voice_id            String   @db.VarChar(200)
  custom_greeting     String?  @db.Text
  custom_instructions String?  @db.LongText
  is_active           Boolean  @default(true)
  display_order       Int      @default(0)
  // ... other fields
}
```

**VERIFY THESE FIELDS EXIST**:
- ✅ `title` (String, VarChar(100))
- ✅ `custom_greeting` (String?, Text)
- ✅ `custom_instructions` (String?, LongText)

**CRITICAL**: Note field names are `custom_*` not `default_*`. This is correct for tenant-level fields.

---

## Task 2: Create Global Profile Model

### 2.1 Add New Model to schema.prisma

**Location**: Add BEFORE the existing `tenant_voice_agent_profile` model.

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

  // Default Templates (NOTE: 'default_' prefix for global templates)
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
  tenant_overrides     tenant_voice_agent_profile_override[]  // ← MATCHES NEW NAME

  // Indexes
  @@index([language_code])
  @@index([is_active])
  @@index([display_order])

  @@map("voice_ai_agent_profile")
}
```

**NAMING NOTE**:
- Global profiles use `default_greeting`, `default_instructions` (templates)
- Tenant overrides use `custom_greeting`, `custom_instructions` (customizations)
- This distinguishes global defaults from tenant customizations

---

## Task 3: Rename Tenant Profile Model

### 3.1 Update Model Name and Mapping

**Find existing model** `tenant_voice_agent_profile` and update:

```prisma
/// Tenant overrides for global voice agent profiles
/// Allows tenants to customize global profile templates
model tenant_voice_agent_profile_override {  // ← RENAMED (NOTE: NO _ai_ in middle!)
  id                  String   @id @default(uuid()) @db.VarChar(36)
  tenant_id           String   @db.VarChar(36)
  agent_profile_id    String   @db.VarChar(36)        // ← NEW: FK to global profile

  // KEEP existing fields (preserve backward compatibility)
  title               String   @db.VarChar(100)       // ← KEEP for denormalization
  language_code       String   @db.VarChar(10)        // ← KEEP for denormalization
  voice_id            String   @db.VarChar(200)       // ← KEEP for denormalization
  custom_greeting     String?  @db.Text               // ← KEEP (tenant customization)
  custom_instructions String?  @db.LongText           // ← KEEP (tenant customization)
  is_active           Boolean  @default(true)
  display_order       Int      @default(0)
  created_at          DateTime @default(now())
  updated_at          DateTime @updatedAt
  updated_by          String?  @db.VarChar(36)

  // Relationships
  tenant              tenant                        @relation("tenant_voice_agent_profile_overrides", fields: [tenant_id], references: [id], onDelete: Cascade)
  agent_profile       voice_ai_agent_profile        @relation(fields: [agent_profile_id], references: [id], onDelete: Cascade)  // ← NEW
  settings_default    tenant_voice_ai_settings[]    @relation("settings_default_profile")

  // Indexes
  @@index([tenant_id])
  @@index([tenant_id, is_active])
  @@index([tenant_id, agent_profile_id])   // ← NEW: Query overrides for a profile
  @@index([agent_profile_id])              // ← NEW: Find all tenants using a profile

  @@map("tenant_voice_agent_profile_override")  // ← MATCHES MODEL NAME
}
```

**CRITICAL NOTES**:
1. Model name: `tenant_voice_agent_profile_override` (NO `_ai_`)
2. Table name: `tenant_voice_agent_profile_override` (matches model)
3. Kept `title`, `language_code`, `voice_id` fields for denormalization (performance)
4. FK constraint will be added AFTER data migration (Sprint 15)

### 3.2 Update Tenant Relation

**In `tenant` model**, find and update the relation:

```prisma
model tenant {
  // ... existing fields ...

  // OLD relation name (search for this):
  // voice_agent_profiles tenant_voice_agent_profile[] @relation("tenant_voice_agent_profiles")

  // NEW relation name (replace with this):
  voice_agent_profile_overrides tenant_voice_agent_profile_override[] @relation("tenant_voice_agent_profile_overrides")

  // ... other relations ...
}
```

---

## Task 4: Generate Prisma Migration

### 4.1 Create Migration (DO NOT RUN YET)

```bash
cd /var/www/lead360.app/api

# Generate migration
npx prisma migrate dev --name add_global_voice_profiles_and_rename_tenant_table --create-only

# This creates the migration file but does NOT apply it
```

### 4.2 Review Generated SQL

**File**: `api/prisma/migrations/[timestamp]_add_global_voice_profiles_and_rename_tenant_table/migration.sql`

**Verify SQL includes**:

```sql
-- 1. Create global profiles table
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

-- 2. Rename tenant table (VERIFY EXACT NAME!)
ALTER TABLE `tenant_voice_agent_profile`
RENAME TO `tenant_voice_agent_profile_override`;

-- 3. Add new column (nullable for now)
ALTER TABLE `tenant_voice_agent_profile_override`
ADD COLUMN `agent_profile_id` VARCHAR(36) NULL;

-- 4. Create indexes
CREATE INDEX `voice_ai_agent_profile_language_code_idx`
ON `voice_ai_agent_profile`(`language_code`);

CREATE INDEX `voice_ai_agent_profile_is_active_idx`
ON `voice_ai_agent_profile`(`is_active`);

CREATE INDEX `voice_ai_agent_profile_display_order_idx`
ON `voice_ai_agent_profile`(`display_order`);

CREATE INDEX `tenant_voice_agent_profile_override_agent_profile_id_idx`
ON `tenant_voice_agent_profile_override`(`agent_profile_id`);

CREATE INDEX `tenant_voice_agent_profile_override_tenant_id_agent_profile_id_idx`
ON `tenant_voice_agent_profile_override`(`tenant_id`, `agent_profile_id`);

-- IMPORTANT: FK constraint NOT added yet (will be added in Sprint 15 after data migration)
```

**⚠️ CRITICAL CHECK**:
- Table rename must say `tenant_voice_agent_profile` → `tenant_voice_agent_profile_override`
- If Prisma generated wrong name, EDIT the migration SQL manually

---

## Task 5: Test Migration (Dry Run)

### 5.1 Backup Database First

```bash
mysqldump -u lead360_user -p lead360_production > backup_before_sprint14_$(date +%Y%m%d_%H%M%S).sql
```

**Verify backup**:
```bash
ls -lh backup_before_sprint14_*.sql
```

### 5.2 Apply Migration

```bash
cd /var/www/lead360.app/api
npx prisma migrate deploy
```

### 5.3 Verify Schema Changes

```bash
mysql -u lead360_user -p lead360_production -e "
SHOW TABLES LIKE '%voice%agent%profile%';
"
```

**Expected output**:
```
+----------------------------------------+
| voice_ai_agent_profile                 |  ← NEW (global)
| tenant_voice_agent_profile_override    |  ← RENAMED
+----------------------------------------+
```

**Verify old table gone**:
```bash
mysql -u lead360_user -p lead360_production -e "
SHOW TABLES LIKE 'tenant_voice_agent_profile';
"
```

**Expected**: Empty set (old table no longer exists)

### 5.4 Verify Data Preserved

```bash
mysql -u lead360_user -p lead360_production -e "
SELECT COUNT(*) as record_count
FROM tenant_voice_agent_profile_override;
"
```

**Expected**: Same count as before migration (data preserved)

### 5.5 Regenerate Prisma Client

```bash
npx prisma generate
```

**Check TypeScript types**:
```bash
npx tsc --noEmit
```

**Expected**: No errors (types updated)

---

## Task 6: Document Rollback Procedure

### 6.1 Create Rollback Migration

**File**: `api/prisma/migrations/[timestamp]_rollback_sprint14/migration.sql`

```sql
-- Rollback Sprint 14 Schema Changes

-- 1. Remove new indexes
DROP INDEX `tenant_voice_agent_profile_override_agent_profile_id_idx`
ON `tenant_voice_agent_profile_override`;

DROP INDEX `tenant_voice_agent_profile_override_tenant_id_agent_profile_id_idx`
ON `tenant_voice_agent_profile_override`;

-- 2. Remove new column
ALTER TABLE `tenant_voice_agent_profile_override`
DROP COLUMN `agent_profile_id`;

-- 3. Rename table back to original
ALTER TABLE `tenant_voice_agent_profile_override`
RENAME TO `tenant_voice_agent_profile`;

-- 4. Drop global profiles table
DROP TABLE IF EXISTS `voice_ai_agent_profile`;
```

### 6.2 Test Rollback (if migration fails)

**Only if Sprint 14 fails**:
```bash
mysql -u lead360_user -p lead360_production < api/prisma/migrations/[timestamp]_rollback_sprint14/migration.sql

# Then restore Prisma schema to original state
git checkout HEAD~1 -- api/prisma/schema.prisma
npx prisma generate
```

---

## Acceptance Criteria

Sprint 14 is complete when:

- [ ] `voice_ai_agent_profile` model added to Prisma schema
- [ ] `tenant_voice_agent_profile` renamed to `tenant_voice_agent_profile_override`
- [ ] `agent_profile_id` field added (nullable, NO FK constraint yet)
- [ ] All indexes created successfully
- [ ] Prisma migration generated and applied
- [ ] Database structure verified (new table exists, old renamed)
- [ ] Data integrity verified (no data lost, row counts match)
- [ ] Prisma client regenerated successfully
- [ ] TypeScript compilation successful
- [ ] Rollback procedure documented and tested

---

## Critical Notes

1. **NO FK CONSTRAINT YET**: The `agent_profile_id` FK constraint is added in Sprint 15 AFTER data migration
2. **Table naming**: Must be `tenant_voice_agent_profile_override` (NO `_ai_`)
3. **Data preserved**: All existing records remain in renamed table
4. **Backward compatibility**: Old services will break until updated in Sprint 17

---

## Next Sprint

**Sprint 15**: Data Migration - Populate global profiles and link tenant overrides

**Prerequisites for Sprint 15**:
- This sprint (14) 100% complete
- Database schema matches new design
- All tables and indexes exist
- No data lost

---

**Sprint Status**: CORRECTED AND READY
**Critical Fix**: Table naming corrected to match existing pattern
