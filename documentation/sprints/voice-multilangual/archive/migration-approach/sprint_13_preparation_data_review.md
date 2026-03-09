# Sprint 13: Preparation & Data Review
## Voice Multilingual Architecture Fix

**Sprint Number**: 13 of 21
**Sprint Owner**: Data Migration Specialist
**Estimated Effort**: 2-3 hours
**Prerequisites**: None - First sprint in refactor series

---

## Sprint Owner Role Definition

You are a **masterclass Data Migration Specialist** that makes Google, Amazon, and Apple jealous of your meticulous preparation and attention to detail.

**Your Principles**:
- You **NEVER GUESS** - You always verify data structures before planning migrations
- You **BREATHE QUALITY** - Every data point is accounted for, every edge case considered
- You **THINK BEFORE YOU ACT** - You analyze current state thoroughly before proposing changes
- You **REVIEW YOUR WORK** - You double-check every query, every count, every assumption
- You **RESPECT THE DATA** - You understand that data loss is unacceptable

You are **NOT RUSHING**. You take your time to understand the current state, identify all data to be migrated, and plan for edge cases.

---

## Context & Background

### Architectural Flaw Identified

The original voice multilingual implementation (Sprints 1-12) allowed **tenants to create their own profiles**, which violates the correct architecture where **system admins define global profiles** and **tenants select/customize them**.

### Correct Architecture (Target State)

```
voice_ai_agent_profile (GLOBAL, admin-managed)
├─ System admin creates profile templates
├─ Defines: language, voice_id, default prompts
├─ Available to ALL tenants (read-only)
└─ Examples: "English - Professional", "Portuguese - Friendly"

tenant_voice_ai_agent_profile_override (tenant customizations)
├─ References global profile (FK)
├─ Tenant can: override instructions/prompts, activate/deactivate
├─ Plan limit: max profiles tenant can ACTIVATE (not create)
└─ IVR references global profile ID + applies tenant overrides
```

---

## Sprint 13 Goals

This sprint is **PREPARATORY ONLY** - no code changes, no schema changes, no deployments.

Your objectives:
1. ✅ Review current database state
2. ✅ Document all existing `tenant_voice_agent_profile` records
3. ✅ Identify unique language/voice combinations to create global profiles
4. ✅ Document all IVR configurations referencing agent profiles
5. ✅ Create data migration plan document
6. ✅ Validate that server is ready for migration (offline, backups taken)

---

## Task 1: Database State Review

### 1.1 Review Current Schema

**File to read**: `/var/www/lead360.app/api/prisma/schema.prisma`

Find and document:
- `tenant_voice_agent_profile` model structure (all fields)
- `subscription_plan.voice_ai_max_agent_profiles` field
- `tenant_voice_ai_settings.default_agent_profile_id` field
- All relationships and foreign keys

**Action**: Use Prisma Studio or direct database query to understand the current schema.

```bash
# Open Prisma Studio to explore schema
cd /var/www/lead360.app/api
npx prisma studio
```

### 1.2 Count Existing Records

Execute these SQL queries (or Prisma queries) to understand data volume:

```sql
-- Count tenant profiles
SELECT COUNT(*) as total_profiles
FROM tenant_voice_agent_profile;

-- Count by tenant
SELECT tenant_id, COUNT(*) as profile_count
FROM tenant_voice_agent_profile
GROUP BY tenant_id
ORDER BY profile_count DESC;

-- Count by language
SELECT language_code, COUNT(*) as count
FROM tenant_voice_agent_profile
GROUP BY language_code
ORDER BY count DESC;

-- Count by active status
SELECT is_active, COUNT(*) as count
FROM tenant_voice_agent_profile
GROUP BY is_active;

-- Find unique language/voice combinations
SELECT DISTINCT language_code, voice_id, COUNT(*) as usage_count
FROM tenant_voice_agent_profile
GROUP BY language_code, voice_id
ORDER BY usage_count DESC;
```

**Document Results**: Create a `data_review_results.md` file with all findings.

---

## Task 2: Identify Data to Migrate

### 2.1 Extract All Tenant Profiles

Query all tenant profiles and save to JSON for reference:

```typescript
// Script: api/scripts/extract-tenant-profiles.ts
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function extractProfiles() {
  const profiles = await prisma.tenant_voice_agent_profile.findMany({
    include: {
      tenant: {
        select: {
          id: true,
          company_name: true,
        }
      }
    },
    orderBy: [
      { language_code: 'asc' },
      { created_at: 'asc' }
    ]
  });

  const dataDir = './migration-data';
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(
    `${dataDir}/existing_tenant_profiles_${new Date().toISOString().split('T')[0]}.json`,
    JSON.stringify(profiles, null, 2)
  );

  console.log(`✅ Extracted ${profiles.length} tenant profiles`);
  console.log(`📁 Saved to ${dataDir}/existing_tenant_profiles_*.json`);
}

extractProfiles()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**Run the script**:
```bash
cd /var/www/lead360.app/api
npx ts-node scripts/extract-tenant-profiles.ts
```

### 2.2 Identify Global Profiles to Create

Based on the data extraction, identify the global profiles that should be created.

**Default profiles** (confirmed by user):
- English (en-US) - Professional
- Portuguese (pt-BR) - Friendly
- Spanish (es-ES) - Formal

**Additional profiles** (if data shows usage):
- Analyze the unique language/voice combinations from Task 1.2
- Recommend additional global profiles based on actual tenant usage

**Document**: Create `global_profiles_plan.md` listing all global profiles to create.

---

## Task 3: Review IVR Configurations

### 3.1 Find IVR Configs Using Agent Profiles

Query IVR configurations that reference agent profiles:

```sql
-- Find IVR configs with voice_ai actions
SELECT
  ic.id,
  ic.tenant_id,
  ic.name,
  ic.menu_options,
  ic.default_action
FROM ivr_configuration ic
WHERE
  ic.menu_options LIKE '%"action":"voice_ai"%'
  OR ic.default_action LIKE '%"action":"voice_ai"%';
```

**Or use Prisma**:

```typescript
// Script: api/scripts/review-ivr-configs.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function reviewIvrConfigs() {
  const configs = await prisma.ivr_configuration.findMany({
    where: {
      OR: [
        { menu_options: { contains: '"action":"voice_ai"' } },
        { default_action: { contains: '"action":"voice_ai"' } }
      ]
    },
    include: {
      tenant: {
        select: {
          id: true,
          company_name: true,
        }
      }
    }
  });

  console.log(`\n📋 Found ${configs.length} IVR configurations using voice_ai action\n`);

  for (const config of configs) {
    console.log(`IVR: ${config.name} (Tenant: ${config.tenant.company_name})`);

    // Parse menu_options to find agent_profile_id references
    try {
      const menuOptions = JSON.parse(config.menu_options as string);
      menuOptions.forEach((option: any) => {
        if (option.action === 'voice_ai' && option.config?.agent_profile_id) {
          console.log(`  - Digit ${option.digit}: References profile ${option.config.agent_profile_id}`);
        }
      });
    } catch (e) {
      console.error(`  ⚠️ Error parsing menu_options for ${config.id}`);
    }

    // Check default_action
    try {
      if (config.default_action) {
        const defaultAction = JSON.parse(config.default_action as string);
        if (defaultAction.action === 'voice_ai' && defaultAction.config?.agent_profile_id) {
          console.log(`  - Default action: References profile ${defaultAction.config.agent_profile_id}`);
        }
      }
    } catch (e) {
      console.error(`  ⚠️ Error parsing default_action for ${config.id}`);
    }

    console.log('');
  }
}

reviewIvrConfigs()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**Document Results**: Save output to `ivr_agent_profile_references.md`.

---

## Task 4: Check Subscription Plan Limits

### 4.1 Review Plan Configurations

Query subscription plans to understand current limits:

```sql
SELECT
  id,
  name,
  voice_ai_enabled,
  voice_ai_max_agent_profiles,
  voice_ai_minutes_included
FROM subscription_plan
WHERE voice_ai_enabled = true
ORDER BY voice_ai_max_agent_profiles ASC;
```

**Document**: How many tenants are on each plan? How many profiles are they using vs. their limit?

```sql
SELECT
  sp.name as plan_name,
  sp.voice_ai_max_agent_profiles as plan_limit,
  t.company_name as tenant_name,
  COUNT(tvap.id) as active_profiles
FROM tenant t
LEFT JOIN subscription_plan sp ON t.subscription_plan_id = sp.id
LEFT JOIN tenant_voice_agent_profile tvap ON tvap.tenant_id = t.id AND tvap.is_active = true
WHERE sp.voice_ai_enabled = true
GROUP BY t.id, sp.id
HAVING active_profiles > sp.voice_ai_max_agent_profiles;
```

**Result**: Identify any tenants currently **exceeding their plan limits** (edge case to handle).

---

## Task 5: Validate Server Status

### 5.1 Confirm Server is Offline

The user confirmed "server is off, run now the migration". Validate:

```bash
# Check if API is running
curl -I https://api.lead360.app/health || echo "✅ API is offline"

# Check if app is running
curl -I https://app.lead360.app || echo "✅ App is offline"

# Check if Prisma Studio is accessible (should be from localhost only)
netstat -tuln | grep 5555 || echo "✅ Prisma Studio not running"
```

### 5.2 Verify Database Backups

```bash
# Check last database backup
ls -lh /var/backups/mysql/ | tail -5

# Or wherever backups are stored
# Verify backup is recent (within last 24 hours)
```

**CRITICAL**: Do NOT proceed with schema changes in Sprint 14 unless a recent backup exists.

---

## Task 6: Create Migration Plan Document

### 6.1 Write Comprehensive Plan

Create `/var/www/lead360.app/documentation/sprints/voice-multilangual/MIGRATION_PLAN.md`:

**Content should include**:
1. **Current State Summary**:
   - Total profiles count
   - Profiles per tenant breakdown
   - Language distribution
   - IVR references count

2. **Target State**:
   - Global profiles to create (list with details)
   - Tenant overrides mapping strategy
   - IVR reference update strategy

3. **Migration Steps** (high-level):
   - Sprint 14: Schema changes
   - Sprint 15: Data migration execution
   - Sprint 16-18: Backend refactor
   - Sprint 19: Documentation
   - Sprint 20-21: Frontend

4. **Rollback Plan**:
   - Database backup restore procedure
   - Prisma migration rollback commands
   - Verification steps

5. **Risk Assessment**:
   - Data loss risk: LOW (backup exists, dry-run first)
   - IVR breakage risk: MEDIUM (profile ID references)
   - Downtime risk: NONE (server already offline)

6. **Success Criteria**:
   - All existing profiles migrated
   - All IVR references updated
   - No data loss
   - Schema matches new design

---

## Acceptance Criteria

Sprint 13 is complete when ALL of the following are true:

- [ ] Database state documented (`data_review_results.md`)
- [ ] All tenant profiles extracted to JSON file
- [ ] Global profiles plan created (`global_profiles_plan.md`)
- [ ] IVR references documented (`ivr_agent_profile_references.md`)
- [ ] Plan limits reviewed (no tenants over limit, or edge cases documented)
- [ ] Server status validated (offline + recent backup confirmed)
- [ ] Migration plan document created (`MIGRATION_PLAN.md`)
- [ ] No schema changes made (this sprint is read-only)
- [ ] All scripts executed successfully without errors

---

## Deliverables

### Files to Create

1. **`migration-data/existing_tenant_profiles_YYYY-MM-DD.json`** - Extracted tenant profiles
2. **`documentation/sprints/voice-multilangual/data_review_results.md`** - Database state analysis
3. **`documentation/sprints/voice-multilangual/global_profiles_plan.md`** - Global profiles to create
4. **`documentation/sprints/voice-multilangual/ivr_agent_profile_references.md`** - IVR usage analysis
5. **`documentation/sprints/voice-multilangual/MIGRATION_PLAN.md`** - Complete migration plan

### Scripts to Create

1. **`api/scripts/extract-tenant-profiles.ts`** - Profile extraction script
2. **`api/scripts/review-ivr-configs.ts`** - IVR analysis script

---

## Testing & Validation

### Read-Only Validation

This sprint involves NO database writes. All scripts should be read-only.

**Validate**:
- [ ] All Prisma queries use `findMany`, `findFirst`, `count` (NO `create`, `update`, `delete`)
- [ ] All SQL queries are SELECT-only (NO INSERT, UPDATE, DELETE)
- [ ] JSON extraction scripts only write to `/migration-data/` directory, not to database

---

## Common Pitfalls to Avoid

1. ❌ **Don't modify database** - This sprint is analysis only
2. ❌ **Don't guess data structures** - Always query actual database
3. ❌ **Don't skip edge cases** - Document tenants over limit, unusual language codes, etc.
4. ❌ **Don't proceed without backup** - Verify backup exists and is recent
5. ❌ **Don't rush** - Take time to understand current state thoroughly

---

## Next Sprint

**Sprint 14**: Schema Migration - Create global profiles table, rename tenant table, add FK

**Prerequisites for Sprint 14**:
- This sprint (13) must be 100% complete
- Migration plan document reviewed and approved
- Database backup confirmed
- Server confirmed offline

---

## Questions or Issues?

If you encounter:
- **Missing data**: Document it in `data_review_results.md` and flag for review
- **Edge cases**: Document in migration plan with proposed solution
- **Script errors**: Fix and re-run, never skip validation
- **Unexpected findings**: Escalate to product owner before proceeding

**Remember**: You are a **masterclass specialist**. Your thoroughness now prevents data loss later.

---

**Sprint Status**: Ready to Execute
**Owner**: Data Migration Specialist
**Reviewer**: Product Owner (Ludson)
