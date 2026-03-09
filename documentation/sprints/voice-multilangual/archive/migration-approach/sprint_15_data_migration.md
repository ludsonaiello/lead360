# Sprint 15: Data Migration Script Execution
## Voice Multilingual Architecture Fix

**Sprint Number**: 15 of 21
**Sprint Owner**: Data Migration Engineer
**Estimated Effort**: 3-4 hours
**Prerequisites**: Sprint 14 complete (schema migrated successfully)

---

## Sprint Owner Role Definition

You are a **masterclass Data Migration Engineer** that makes Google, Amazon, and Apple jealous of your data integrity standards and attention to edge cases.

**Your Principles**:
- You **NEVER GUESS** - Every data transformation is verified before and after
- You **TEST IN TRANSACTIONS** - You run dry-runs with rollback before committing
- You **VERIFY EVERYTHING** - Before counts, after counts, data integrity checks
- You **HANDLE EDGE CASES** - Null values, missing FKs, orphaned records are not ignored
- You **LOG ALL CHANGES** - Every migration step is logged for audit trail

**You are NOT RUSHING**. Data migration is irreversible. You validate every step.

---

## Sprint Goals

**Primary Objective**: Migrate existing tenant profiles to the new global/override architecture.

**Steps**:
1. ✅ Create default global profiles (English, Portuguese, Spanish)
2. ✅ Map existing tenant profiles to global profiles
3. ✅ Update `agent_profile_id` FK in override table
4. ✅ Add FK constraint (now safe after data population)
5. ✅ Verify data integrity
6. ✅ Handle edge cases (orphaned records, missing languages)

---

## Task 1: Create Global Profiles

### 1.1 Insert Default Profiles

**Script**: `api/scripts/create-global-profiles.ts`

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const globalProfiles = [
  {
    id: '00000000-0000-0000-0000-000000000001', // Predictable UUID for English
    language_code: 'en',
    language_name: 'English',
    voice_id: 'cartesia-en-US-professional', // Update with actual Cartesia voice ID
    display_name: 'English - Professional',
    description: 'Professional English voice for business calls',
    default_greeting: 'Hello, thank you for calling {business_name}! How can I help you today?',
    default_instructions: 'You are a professional phone assistant. Be concise, friendly, and helpful.',
    is_active: true,
    display_order: 1,
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    language_code: 'pt',
    language_name: 'Portuguese',
    voice_id: 'cartesia-pt-BR-friendly', // Update with actual Cartesia voice ID
    display_name: 'Portuguese - Friendly',
    description: 'Friendly Brazilian Portuguese voice',
    default_greeting: 'Olá, obrigado por ligar para {business_name}! Como posso ajudá-lo hoje?',
    default_instructions: 'Você é um assistente telefônico amigável. Seja conciso, amigável e prestativo.',
    is_active: true,
    display_order: 2,
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    language_code: 'es',
    language_name: 'Spanish',
    voice_id: 'cartesia-es-ES-formal', // Update with actual Cartesia voice ID
    display_name: 'Spanish - Formal',
    description: 'Formal Spanish voice for professional settings',
    default_greeting: 'Hola, gracias por llamar a {business_name}! ¿Cómo puedo ayudarle hoy?',
    default_instructions: 'Eres un asistente telefónico profesional. Sé conciso, amable y servicial.',
    is_active: true,
    display_order: 3,
  },
];

async function createGlobalProfiles() {
  console.log('🚀 Creating global voice agent profiles...\n');

  for (const profile of globalProfiles) {
    const existing = await prisma.voice_ai_agent_profile.findUnique({
      where: { id: profile.id },
    });

    if (existing) {
      console.log(`⏭️  Profile ${profile.display_name} already exists, skipping`);
      continue;
    }

    await prisma.voice_ai_agent_profile.create({
      data: profile,
    });

    console.log(`✅ Created: ${profile.display_name} (${profile.language_code})`);
  }

  console.log('\n✅ Global profiles created successfully');
}

createGlobalProfiles()
  .catch((error) => {
    console.error('❌ Error creating global profiles:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

**Execute**:
```bash
cd /var/www/lead360.app/api
npx ts-node scripts/create-global-profiles.ts
```

**Verify**:
```sql
SELECT * FROM voice_ai_agent_profile ORDER BY display_order;
```

Expected: 3 rows (English, Portuguese, Spanish)

---

## Task 2: Map Tenant Overrides to Global Profiles

### 2.1 Migration Script

**Script**: `api/scripts/migrate-tenant-profiles-to-overrides.ts`

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Language mapping
const languageToGlobalProfile: Record<string, string> = {
  'en': '00000000-0000-0000-0000-000000000001',
  'pt': '00000000-0000-0000-0000-000000000002',
  'es': '00000000-0000-0000-0000-000000000003',
};

async function migrateTenantProfiles() {
  console.log('🔄 Starting migration of tenant profiles to overrides...\n');

  // Get all existing tenant profiles (now in override table)
  const tenantProfiles = await prisma.tenant_voice_ai_agent_profile_override.findMany({
    where: {
      agent_profile_id: null, // Only unmigrated records
    },
    include: {
      tenant: {
        select: {
          id: true,
          company_name: true,
        },
      },
    },
  });

  console.log(`📋 Found ${tenantProfiles.length} profiles to migrate\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const profile of tenantProfiles) {
    const globalProfileId = languageToGlobalProfile[profile.language_code];

    if (!globalProfileId) {
      console.warn(`⚠️  Unknown language code: ${profile.language_code} for tenant ${profile.tenant.company_name}`);
      console.warn(`   Profile ID: ${profile.id}, Title: ${profile.title}`);
      console.warn(`   Action: Skipped (will need manual mapping)\n`);
      errorCount++;
      continue;
    }

    try {
      await prisma.tenant_voice_ai_agent_profile_override.update({
        where: { id: profile.id },
        data: {
          agent_profile_id: globalProfileId,
        },
      });

      console.log(`✅ Migrated: ${profile.tenant.company_name} - ${profile.title} → ${profile.language_code.toUpperCase()}`);
      successCount++;
    } catch (error) {
      console.error(`❌ Error migrating profile ${profile.id}:`, error);
      errorCount++;
    }
  }

  console.log(`\n📊 Migration Summary:`);
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📝 Total: ${tenantProfiles.length}`);
}

migrateTenantProfiles()
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

**Execute**:
```bash
npx ts-node scripts/migrate-tenant-profiles-to-overrides.ts
```

### 2.2 Handle Edge Cases

**Script**: `api/scripts/handle-profile-edge-cases.ts`

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function handleEdgeCases() {
  console.log('🔍 Checking for edge cases...\n');

  // 1. Find profiles with unknown languages
  const unknownLanguages = await prisma.tenant_voice_ai_agent_profile_override.findMany({
    where: {
      agent_profile_id: null,
    },
    select: {
      id: true,
      language_code: true,
      title: true,
      tenant: {
        select: {
          company_name: true,
        },
      },
    },
  });

  if (unknown Languages.length > 0) {
    console.log(`⚠️  Found ${unknownLanguages.length} profiles with unmapped languages:\n`);
    unknownLanguages.forEach((profile) => {
      console.log(`   - ${profile.tenant.company_name}: ${profile.title} (${profile.language_code})`);
    });
    console.log(`\n   Action Required: Create global profiles for these languages or manually map them\n`);
  }

  // 2. Find orphaned default_agent_profile_id references
  const orphanedDefaults = await prisma.$queryRaw`
    SELECT tvais.id, tvais.tenant_id, tvais.default_agent_profile_id
    FROM tenant_voice_ai_settings tvais
    LEFT JOIN tenant_voice_ai_agent_profile_override tvaapo ON tvais.default_agent_profile_id = tvaapo.id
    WHERE tvais.default_agent_profile_id IS NOT NULL
    AND tvaapo.id IS NULL
  `;

  if (Array.isArray(orphanedDefaults) && orphanedDefaults.length > 0) {
    console.log(`⚠️  Found ${orphanedDefaults.length} orphaned default_agent_profile_id references`);
    console.log(`   Action: Setting these to NULL\n`);

    for (const setting of orphanedDefaults) {
      await prisma.tenant_voice_ai_settings.update({
        where: { id: setting.id },
        data: { default_agent_profile_id: null },
      });
    }
  }

  console.log('✅ Edge case handling complete');
}

handleEdgeCases()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

---

## Task 3: Add Foreign Key Constraint

### 3.1 Execute FK Addition

Now that `agent_profile_id` is populated, add the FK constraint:

```sql
ALTER TABLE `tenant_voice_ai_agent_profile_override`
ADD CONSTRAINT `tenant_voice_ai_agent_profile_override_agent_profile_id_fkey`
FOREIGN KEY (`agent_profile_id`)
REFERENCES `voice_ai_agent_profile`(`id`)
ON DELETE CASCADE
ON UPDATE CASCADE;
```

**Execute**:
```bash
mysql -u lead360_user -p lead360_production -e "
USE lead360_production;
ALTER TABLE tenant_voice_ai_agent_profile_override
ADD CONSTRAINT tenant_voice_ai_agent_profile_override_agent_profile_id_fkey
FOREIGN KEY (agent_profile_id)
REFERENCES voice_ai_agent_profile(id)
ON DELETE CASCADE
ON UPDATE CASCADE;
"
```

---

## Task 4: Data Integrity Verification

### 4.1 Run Verification Queries

```sql
-- 1. Count global profiles
SELECT COUNT(*) as global_profile_count FROM voice_ai_agent_profile;
-- Expected: 3 (en, pt, es)

-- 2. Count tenant overrides with valid FK
SELECT COUNT(*) as overrides_with_profile
FROM tenant_voice_ai_agent_profile_override
WHERE agent_profile_id IS NOT NULL;

-- 3. Count orphaned overrides (should be 0 or documented)
SELECT COUNT(*) as orphaned_overrides
FROM tenant_voice_ai_agent_profile_override
WHERE agent_profile_id IS NULL;

-- 4. Verify FK integrity
SELECT
  vap.display_name,
  COUNT(tvaapo.id) as tenant_override_count
FROM voice_ai_agent_profile vap
LEFT JOIN tenant_voice_ai_agent_profile_override tvaapo ON tvaapo.agent_profile_id = vap.id
GROUP BY vap.id
ORDER BY vap.display_order;

-- 5. Check default profile references
SELECT
  t.company_name,
  tvais.default_agent_profile_id,
  tvaapo.title,
  vap.display_name as global_profile
FROM tenant_voice_ai_settings tvais
JOIN tenant t ON t.id = tvais.tenant_id
LEFT JOIN tenant_voice_ai_agent_profile_override tvaapo ON tvaapo.id = tvais.default_agent_profile_id
LEFT JOIN voice_ai_agent_profile vap ON vap.id = tvaapo.agent_profile_id
WHERE tvais.default_agent_profile_id IS NOT NULL;
```

### 4.2 Save Verification Report

Create `documentation/sprints/voice-multilangual/data_migration_verification.md` with results.

---

## Acceptance Criteria

- [ ] Global profiles created (en, pt, es)
- [ ] All tenant profiles mapped to global profiles (or edge cases documented)
- [ ] FK constraint added successfully
- [ ] No orphaned records (or documented edge cases)
- [ ] Data integrity verified (all counts match)
- [ ] Before/after counts documented

---

## Next Sprint

**Sprint 16**: Admin Controller - System admin CRUD for global profiles

---

**Sprint Status**: Ready to Execute
