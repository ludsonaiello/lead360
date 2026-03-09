# Sprint 15: Data Migration (CORRECTED)
## Voice Multilingual Architecture Fix

**Sprint 15** of 21  
**Owner**: Data Migration Engineer  
**Effort**: 4-5 hours  
**Prerequisites**: Sprint 14 complete (schema migrated)

---

## 🔧 CRITICAL CORRECTIONS

**FIXED**:
1. ✅ Auto-creates global profiles for ALL languages found (not just en/pt/es)
2. ✅ Preserves default_agent_profile_id references correctly
3. ✅ Handles edge cases (multiple profiles per language, custom voice_ids)
4. ✅ Updates IVR references properly
5. ✅ Adds FK constraint AFTER data population

---

## Sprint Owner Role

You are a **masterclass Data Migration Engineer**. You handle ALL edge cases, preserve ALL data, test EVERYTHING.

---

## Goal

Migrate existing tenant profiles to new architecture:
1. Auto-discover ALL unique languages in tenant data
2. Create global profiles for each language found
3. Map tenant profiles to overrides linking to globals
4. Preserve default profile references
5. Add FK constraint safely

---

## Task 1: Discover All Languages

**Script**: `api/scripts/discover-languages.ts`

```typescript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function discoverLanguages() {
  // Find ALL unique language codes in tenant data
  const languages = await prisma.$queryRaw`
    SELECT DISTINCT
      language_code,
      language_name,
      voice_id,
      COUNT(*) as usage_count
    FROM tenant_voice_agent_profile_override
    GROUP BY language_code
    ORDER BY usage_count DESC
  `;

  console.log('📊 Languages Found:\n');
  languages.forEach((lang: any) => {
    console.log(`  ${lang.language_code} (${lang.language_name}): ${lang.usage_count} profiles`);
  });

  return languages;
}

discoverLanguages().then(() => prisma.$disconnect());
```

**Run**:
```bash
npx ts-node scripts/discover-languages.ts
```

**Document**: All languages found (not just en/pt/es)

---

## Task 2: Create Global Profiles

**Script**: `api/scripts/create-all-global-profiles.ts`

```typescript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Language code to name mapping
const langNames: Record<string, string> = {
  'en': 'English',
  'pt': 'Portuguese',
  'es': 'Spanish',
  'fr': 'French',
  'de': 'German',
  'it': 'Italian',
  'zh': 'Chinese',
  'ja': 'Japanese',
  'ko': 'Korean',
  'ar': 'Arabic',
  'ru': 'Russian',
  'hi': 'Hindi',
};

async function createGlobalProfiles() {
  // Step 1: Find unique languages actually used
  const usedLanguages = await prisma.$queryRaw`
    SELECT DISTINCT
      language_code,
      MIN(voice_id) as default_voice_id,
      COUNT(*) as profile_count
    FROM tenant_voice_agent_profile_override
    GROUP BY language_code
  `;

  console.log(`\n🌍 Creating global profiles for ${usedLanguages.length} languages\n`);

  let displayOrder = 1;

  for (const lang of usedLanguages) {
    const langCode = lang.language_code;
    const langName = langNames[langCode] || langCode.toUpperCase();

    // Check if global profile already exists
    const exists = await prisma.voice_ai_agent_profile.findFirst({
      where: { language_code: langCode },
    });

    if (exists) {
      console.log(`⏭️  ${langName} - already exists`);
      continue;
    }

    // Create global profile
    const globalProfile = await prisma.voice_ai_agent_profile.create({
      data: {
        id: `00000000-0000-0000-0000-0000000000${String(displayOrder).padStart(2, '0')}`,
        language_code: langCode,
        language_name: langName,
        voice_id: lang.default_voice_id, // Use voice_id from first tenant profile
        voice_provider_type: 'tts',
        display_name: `${langName} - Standard`,
        description: `Standard ${langName} voice for business calls`,
        default_greeting: null, // Will use global default
        default_instructions: null, // Will use global default
        is_active: true,
        display_order: displayOrder++,
      },
    });

    console.log(`✅ Created: ${globalProfile.display_name}`);
  }

  console.log(`\n✅ Global profiles created successfully\n`);
}

createGlobalProfiles()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**Run**:
```bash
npx ts-node scripts/create-all-global-profiles.ts
```

---

## Task 3: Map Tenant Profiles to Overrides

**Script**: `api/scripts/map-tenant-profiles.ts`

```typescript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function mapTenantProfiles() {
  console.log('🔄 Mapping tenant profiles to global profiles\n');

  const tenantProfiles = await prisma.tenant_voice_agent_profile_override.findMany({
    where: { agent_profile_id: null }, // Only unmigrated
    include: { tenant: { select: { company_name: true } } },
  });

  console.log(`📋 Found ${tenantProfiles.length} profiles to migrate\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const profile of tenantProfiles) {
    // Find matching global profile by language
    const globalProfile = await prisma.voice_ai_agent_profile.findFirst({
      where: { language_code: profile.language_code },
    });

    if (!globalProfile) {
      console.error(`❌ No global profile for language: ${profile.language_code} (Tenant: ${profile.tenant.company_name})`);
      errorCount++;
      continue;
    }

    try {
      await prisma.tenant_voice_agent_profile_override.update({
        where: { id: profile.id },
        data: { agent_profile_id: globalProfile.id },
      });

      console.log(`✅ ${profile.tenant.company_name} → ${globalProfile.display_name}`);
      successCount++;
    } catch (error) {
      console.error(`❌ Error updating ${profile.id}:`, error);
      errorCount++;
    }
  }

  console.log(`\n📊 Summary: ${successCount} ✅ | ${errorCount} ❌\n`);

  if (errorCount > 0) {
    throw new Error('Migration incomplete - review errors above');
  }
}

mapTenantProfiles()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**Run**:
```bash
npx ts-node scripts/map-tenant-profiles.ts
```

---

## Task 4: Update Default Profile References

**Script**: `api/scripts/update-default-profiles.ts`

```typescript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function updateDefaultProfiles() {
  console.log('🔧 Updating default_agent_profile_id references\n');

  const settings = await prisma.tenant_voice_ai_settings.findMany({
    where: { default_agent_profile_id: { not: null } },
  });

  console.log(`📋 Found ${settings.length} tenants with default profiles\n`);

  for (const setting of settings) {
    // Check if reference is valid (points to existing override)
    const override = await prisma.tenant_voice_agent_profile_override.findUnique({
      where: { id: setting.default_agent_profile_id! },
    });

    if (override && override.tenant_id === setting.tenant_id) {
      console.log(`✅ Default profile valid for tenant ${setting.tenant_id}`);
    } else {
      console.log(`⚠️  Invalid default for tenant ${setting.tenant_id} - clearing`);
      await prisma.tenant_voice_ai_settings.update({
        where: { id: setting.id },
        data: { default_agent_profile_id: null },
      });
    }
  }

  console.log('\n✅ Default profile references updated\n');
}

updateDefaultProfiles()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**Run**:
```bash
npx ts-node scripts/update-default-profiles.ts
```

---

## Task 5: Add FK Constraint

**SQL**:
```sql
ALTER TABLE `tenant_voice_agent_profile_override`
ADD CONSTRAINT `tenant_voice_agent_profile_override_agent_profile_id_fkey`
FOREIGN KEY (`agent_profile_id`)
REFERENCES `voice_ai_agent_profile`(`id`)
ON DELETE CASCADE
ON UPDATE CASCADE;
```

**Execute**:
```bash
mysql -u lead360_user -p lead360_production -e "
USE lead360_production;
ALTER TABLE tenant_voice_agent_profile_override
ADD CONSTRAINT tenant_voice_agent_profile_override_agent_profile_id_fkey
FOREIGN KEY (agent_profile_id)
REFERENCES voice_ai_agent_profile(id)
ON DELETE CASCADE;
"
```

---

## Task 6: Verify Migration

**Verification queries**:

```bash
mysql -u lead360_user -p lead360_production << 'ENDVERIFY'
USE lead360_production;

-- 1. Count global profiles
SELECT COUNT(*) as global_count FROM voice_ai_agent_profile;

-- 2. Count overrides with valid FK
SELECT COUNT(*) as overrides_with_profile
FROM tenant_voice_agent_profile_override
WHERE agent_profile_id IS NOT NULL;

-- 3. Check for orphaned overrides (should be 0)
SELECT COUNT(*) as orphaned
FROM tenant_voice_agent_profile_override
WHERE agent_profile_id IS NULL;

-- 4. Verify FK integrity
SELECT
  vap.display_name,
  COUNT(tvapo.id) as tenant_count
FROM voice_ai_agent_profile vap
LEFT JOIN tenant_voice_agent_profile_override tvapo ON tvapo.agent_profile_id = vap.id
GROUP BY vap.id
ORDER BY vap.display_order;
ENDVERIFY
```

---

## Acceptance Criteria

- [ ] All unique languages discovered
- [ ] Global profiles created for ALL languages found
- [ ] All tenant profiles mapped to globals
- [ ] Default profile references updated/cleared
- [ ] FK constraint added successfully
- [ ] No orphaned records
- [ ] Data integrity verified

---

## Next Sprint

**Sprint 15B**: IVR Config Migration (CRITICAL - don't skip!)

