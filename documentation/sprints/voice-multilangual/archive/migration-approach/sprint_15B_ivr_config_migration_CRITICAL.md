# Sprint 15B: IVR Configuration Migration (CRITICAL)
## Voice Multilingual Architecture Fix

**Sprint 15B** (NEW - MANDATORY)  
**Owner**: Integration Engineer  
**Effort**: 2-3 hours  
**Prerequisites**: Sprint 15 complete

---

## 🚨 CRITICAL: WITHOUT THIS SPRINT, ALL IVR CONFIGS BREAK

**Problem**: IVR configs store `agent_profile_id` in JSON. After Sprint 15, these IDs reference OVERRIDES, but should reference GLOBAL profiles.

**Impact if skipped**: 🔥 **EVERY EXISTING IVR CONFIGURATION BREAKS** 🔥

---

## Sprint Owner Role

You are a **masterclass Integration Engineer**. You understand JSON data structures, handle migrations safely, validate thoroughly.

---

## Goal

Update all IVR configurations to reference global profile IDs instead of override IDs:

1. Find all IVR configs using voice_ai actions
2. Parse JSON menu_options and default_action
3. Map old IDs (override) → new IDs (global)
4. Update JSON and save
5. Verify all configs valid

---

## Task 1: Understand Current IVR Structure

**Table**: `ivr_configuration`
**Fields**: `menu_options` (JSON), `default_action` (JSON)

**Current Structure**:
```json
{
  "menu_options": [
    {
      "digit": "1",
      "action": "voice_ai",
      "config": {
        "agent_profile_id": "old-override-id-here"  ← NEEDS UPDATE
      }
    }
  ],
  "default_action": {
    "action": "voice_ai",
    "config": {
      "agent_profile_id": "another-override-id"  ← NEEDS UPDATE
    }
  }
}
```

**After Migration** (what IVRs should reference):
- GLOBAL profile IDs (from `voice_ai_agent_profile.id`)
- NOT override IDs (from `tenant_voice_agent_profile_override.id`)

---

## Task 2: Create Mapping Script

**Script**: `api/scripts/migrate-ivr-configs.ts`

```typescript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function migrateIvrConfigs() {
  console.log('🔄 Migrating IVR configurations\n');

  // Get all IVR configs
  const configs = await prisma.ivr_configuration.findMany({
    where: {
      OR: [
        { menu_options: { contains: '"action":"voice_ai"' } },
        { default_action: { contains: '"action":"voice_ai"' } },
      ],
    },
    include: {
      tenant: { select: { company_name: true } },
    },
  });

  console.log(`📋 Found ${configs.length} IVR configs to review\n`);

  let updatedCount = 0;
  let errorCount = 0;

  for (const config of configs) {
    let updated = false;
    let menuOptions = JSON.parse(config.menu_options as string || '[]');
    let defaultAction = config.default_action
      ? JSON.parse(config.default_action as string)
      : null;

    // Process menu_options
    for (const option of menuOptions) {
      if (option.action === 'voice_ai' && option.config?.agent_profile_id) {
        const oldId = option.config.agent_profile_id;

        // Look up the override to find global profile ID
        const override = await prisma.tenant_voice_agent_profile_override.findUnique({
          where: { id: oldId },
          select: { agent_profile_id: true },
        });

        if (override?.agent_profile_id) {
          console.log(`  ✅ Digit ${option.digit}: ${oldId} → ${override.agent_profile_id}`);
          option.config.agent_profile_id = override.agent_profile_id;
          updated = true;
        } else {
          console.warn(`  ⚠️  Digit ${option.digit}: Invalid ID ${oldId} - removing`);
          delete option.config.agent_profile_id;
          updated = true;
          errorCount++;
        }
      }
    }

    // Process default_action
    if (defaultAction?.action === 'voice_ai' && defaultAction.config?.agent_profile_id) {
      const oldId = defaultAction.config.agent_profile_id;

      const override = await prisma.tenant_voice_agent_profile_override.findUnique({
        where: { id: oldId },
        select: { agent_profile_id: true },
      });

      if (override?.agent_profile_id) {
        console.log(`  ✅ Default action: ${oldId} → ${override.agent_profile_id}`);
        defaultAction.config.agent_profile_id = override.agent_profile_id;
        updated = true;
      } else {
        console.warn(`  ⚠️  Default action: Invalid ID ${oldId} - removing`);
        delete defaultAction.config.agent_profile_id;
        updated = true;
        errorCount++;
      }
    }

    // Save if updated
    if (updated) {
      await prisma.ivr_configuration.update({
        where: { id: config.id },
        data: {
          menu_options: JSON.stringify(menuOptions),
          default_action: defaultAction ? JSON.stringify(defaultAction) : null,
        },
      });

      console.log(`✅ Updated IVR "${config.name}" (${config.tenant.company_name})\n`);
      updatedCount++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`  ✅ Updated: ${updatedCount} IVR configs`);
  console.log(`  ⚠️  Warnings: ${errorCount} invalid references\n`);
}

migrateIvrConfigs()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

---

## Task 3: Execute Migration

```bash
cd /var/www/lead360.app/api
npx ts-node scripts/migrate-ivr-configs.ts
```

**Expected Output**:
```
🔄 Migrating IVR configurations

📋 Found 12 IVR configs to review

  ✅ Digit 1: abc-123 → 00000000-0000-0000-0000-000000000001
  ✅ Digit 2: def-456 → 00000000-0000-0000-0000-000000000002
✅ Updated IVR "Main Menu" (Acme Plumbing)

...

📊 Summary:
  ✅ Updated: 12 IVR configs
  ⚠️  Warnings: 0 invalid references
```

---

## Task 4: Verify IVR Configs

**Verification Script**: `api/scripts/verify-ivr-configs.ts`

```typescript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function verifyIvrConfigs() {
  console.log('🔍 Verifying IVR configurations\n');

  const configs = await prisma.ivr_configuration.findMany({
    where: {
      OR: [
        { menu_options: { contains: '"action":"voice_ai"' } },
        { default_action: { contains: '"action":"voice_ai"' } },
      ],
    },
  });

  let validCount = 0;
  let invalidCount = 0;

  for (const config of configs) {
    const menuOptions = JSON.parse(config.menu_options as string || '[]');
    const defaultAction = config.default_action
      ? JSON.parse(config.default_action as string)
      : null;

    // Collect all profile IDs
    const profileIds: string[] = [];

    menuOptions.forEach((opt: any) => {
      if (opt.action === 'voice_ai' && opt.config?.agent_profile_id) {
        profileIds.push(opt.config.agent_profile_id);
      }
    });

    if (defaultAction?.action === 'voice_ai' && defaultAction.config?.agent_profile_id) {
      profileIds.push(defaultAction.config.agent_profile_id);
    }

    if (profileIds.length === 0) continue;

    // Verify all IDs reference GLOBAL profiles (not overrides)
    for (const profileId of profileIds) {
      const globalProfile = await prisma.voice_ai_agent_profile.findUnique({
        where: { id: profileId },
      });

      if (globalProfile) {
        console.log(`  ✅ ${config.name}: ${profileId} → ${globalProfile.display_name}`);
        validCount++;
      } else {
        console.error(`  ❌ ${config.name}: Invalid ID ${profileId}`);
        invalidCount++;
      }
    }
  }

  console.log(`\n📊 Verification:`);
  console.log(`  ✅ Valid: ${validCount}`);
  console.log(`  ❌ Invalid: ${invalidCount}\n`);

  if (invalidCount > 0) {
    throw new Error('IVR verification failed - invalid profile IDs found');
  }

  console.log('✅ All IVR configs valid!\n');
}

verifyIvrConfigs()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**Run**:
```bash
npx ts-node scripts/verify-ivr-configs.ts
```

**Expected**: All IVR configs reference valid global profile IDs

---

## Task 5: Test Sample IVR

**Manual Test**:
1. Pick one IVR config
2. Check JSON structure
3. Verify profile ID is global
4. Test call flow (if possible)

**SQL**:
```sql
SELECT
  ic.name,
  ic.menu_options,
  ic.default_action,
  t.company_name
FROM ivr_configuration ic
JOIN tenant t ON t.id = ic.tenant_id
WHERE ic.menu_options LIKE '%voice_ai%'
LIMIT 1;
```

**Verify**:
- Profile IDs in JSON match `voice_ai_agent_profile.id` (global)
- NOT `tenant_voice_agent_profile_override.id` (override)

---

## Acceptance Criteria

- [ ] All IVR configs identified
- [ ] JSON parsed and updated successfully
- [ ] All profile ID references updated (override → global)
- [ ] Invalid references handled (removed or fixed)
- [ ] Verification script passes (all IDs valid)
- [ ] Manual spot-check successful
- [ ] No IVR configs broken

---

## Rollback

**If migration fails**:
```bash
# Restore from backup
mysql -u lead360_user -p lead360_production < backup_before_sprint15B.sql
```

---

## Next Sprint

**Sprint 16**: Admin Controller for Global Profiles

---

**Sprint Status**: CRITICAL - DO NOT SKIP
**This sprint prevents production outage**

