# CRITICAL REVIEW: Voice Multilingual Architecture Fix
## Issues Found & Required Fixes Before Implementation

**Status**: ⚠️ **NO-GO WITHOUT FIXES**
**Review Date**: March 5, 2026
**Reviewer**: Architecture Review Agent

---

## Executive Summary

A comprehensive line-by-line review of sprints 13-21 against the existing codebase has identified **6 CRITICAL BLOCKERS** and **7 HIGH-RISK ISSUES** that would break production if implemented as-is.

**The architectural vision is CORRECT**, but execution details have critical gaps that must be fixed before implementation.

---

## ⛔ CRITICAL BLOCKERS (Must Fix Before Implementation)

### **BLOCKER 1: Schema Already Migrated - Sprints 14-15 Obsolete**

**Finding**: Git status shows migration `20260304_add_multi_language_voice_agent_profiles/` already exists.

**Verification Required**:
```bash
cd /var/www/lead360.app/api
npx prisma migrate status

# Check if this migration was applied:
# - Applied: Sprints 14-15 are OBSOLETE (skip them)
# - Not applied: Sprints 14-15 need execution
```

**Impact**: If already applied, implementing Sprint 14 again will FAIL or create duplicate tables.

**Fix**: Add Sprint 13.5: "Verify Migration State" before Sprint 14.

---

### **BLOCKER 2: Table Naming Inconsistency - Current vs Sprints Mismatch**

**Current Schema** (schema.prisma line 1227):
```prisma
model tenant_voice_agent_profile {  // Current name
  // ...
}
```

**Sprint 14-21 Expect**:
```prisma
model tenant_voice_ai_agent_profile_override {  // Different name!
  // ...
}
```

**Problem**: Note the missing `_ai_` in current vs. expected name.

**Impact**: ALL services, controllers, DTOs will use WRONG model name → Runtime errors.

**Fix Required**:
1. **Option A** (Recommended): Update Sprints 14-21 to use `tenant_voice_agent_profile_override` (matches current pattern)
2. **Option B**: Rename during migration to `tenant_voice_ai_agent_profile_override` (breaks backward compat)

**Decision Needed**: Which naming convention to use?

---

### **BLOCKER 3: Missing IVR Configuration Migration - Existing Configs Will Break**

**Current State**: IVR configs store `agent_profile_id` in JSON fields:
```typescript
// ivr_configuration.menu_options (JSON):
{
  "1": {
    "action": "voice_ai",
    "config": {
      "agent_profile_id": "old-tenant-profile-id-123"  // ← OLD TENANT ID
    }
  }
}
```

**After Migration**: This ID no longer exists (table renamed, IDs changed).

**Sprint 15 Does NOT Handle**: Updating these JSON fields.

**Impact**: 🔥 **ALL EXISTING IVR CONFIGS WILL BREAK** 🔥

**Fix Required**: Add Sprint 15B: "IVR Configuration Migration"

```typescript
// Migration script needed:
async function migrateIvrConfigs() {
  const configs = await prisma.ivr_configuration.findMany();

  for (const config of configs) {
    const menuOptions = JSON.parse(config.menu_options);
    let updated = false;

    // Map old tenant profile IDs → new global profile IDs
    for (const option of menuOptions) {
      if (option.action === 'voice_ai' && option.config?.agent_profile_id) {
        const oldId = option.config.agent_profile_id;

        // Look up what global profile this should reference
        const override = await prisma.tenant_voice_ai_agent_profile_override.findFirst({
          where: { id: oldId },
          include: { agent_profile: true },
        });

        if (override) {
          option.config.agent_profile_id = override.agent_profile_id; // Global ID
          updated = true;
        }
      }
    }

    if (updated) {
      await prisma.ivr_configuration.update({
        where: { id: config.id },
        data: { menu_options: JSON.stringify(menuOptions) },
      });
    }
  }
}
```

---

### **BLOCKER 4: Default Profile References Not Updated**

**Current Schema**:
```prisma
tenant_voice_ai_settings {
  default_agent_profile_id  String?  // References tenant_voice_agent_profile.id
}
```

**After Migration**:
- Table renamed to `tenant_voice_ai_agent_profile_override`
- IDs change
- References break

**Sprint 15 Solution** (line 261-282): Sets `default_agent_profile_id = NULL` (loses data!)

**Problem**: Doesn't preserve the default selection - just deletes it.

**Impact**: Users lose their default profile configuration.

**Fix Required**: Update references correctly:
```typescript
// In Sprint 15 migration:
const settings = await prisma.tenant_voice_ai_settings.findMany({
  where: { default_agent_profile_id: { not: null } },
});

for (const setting of settings) {
  // Find the override that replaced the old tenant profile
  const override = await prisma.tenant_voice_ai_agent_profile_override.findFirst({
    where: {
      tenant_id: setting.tenant_id,
      // Match by language_code or other criteria from old profile
    },
  });

  if (override) {
    await prisma.tenant_voice_ai_settings.update({
      where: { id: setting.id },
      data: { default_agent_profile_id: override.id },  // Update to new ID
    });
  } else {
    // Only set NULL if genuinely orphaned
    await prisma.tenant_voice_ai_settings.update({
      where: { id: setting.id },
      data: { default_agent_profile_id: null },
    });
  }
}
```

---

### **BLOCKER 5: Edge Case - Non-English/Portuguese/Spanish Profiles**

**Sprint 15 Creates Only**:
- English (en)
- Portuguese (pt)
- Spanish (es)

**What if tenant has**:
- French (fr)
- German (de)
- Italian (it)
- Custom language codes

**Sprint 15** (line 149-152): Marks as error, skips migration.

**Impact**: Tenants with other languages LOSE their profiles entirely.

**Fix Required**: Add step to Sprint 15:
```typescript
// Auto-create global profiles for ALL unique language codes found
const uniqueLanguages = await prisma.tenant_voice_agent_profile.findMany({
  distinct: ['language_code'],
  select: { language_code: true, language_name: true, voice_id: true },
});

for (const lang of uniqueLanguages) {
  // Check if global profile exists
  const exists = await prisma.voice_ai_agent_profile.findFirst({
    where: { language_code: lang.language_code },
  });

  if (!exists) {
    // Create global profile for this language
    await prisma.voice_ai_agent_profile.create({
      data: {
        language_code: lang.language_code,
        language_name: lang.language_name || languageCodeToName(lang.language_code),
        voice_id: lang.voice_id, // Use voice_id from first tenant profile
        display_name: `${lang.language_name} - Standard`,
        is_active: true,
        display_order: 100, // Sort after default 3
      },
    });
  }
}
```

---

### **BLOCKER 6: Backward Compatibility - Old Endpoints Still Allow Bad Pattern**

**Sprint 17** (line 388-395): "KEEP old endpoints with deprecation notice"

**Problem**: Tenants can still use old endpoints to create profiles:
```
POST /api/v1/voice-ai/agent-profiles  ← OLD ENDPOINT (still works!)
```

**This defeats the entire architectural fix!**

**Impact**: Tenants continue using old pattern, architecture remains broken.

**Fix Required**: Sprint 17 must DISABLE old endpoints:

```typescript
// In Sprint 17, replace old endpoints with 410 Gone:
@Post()
@HttpCode(HttpStatus.GONE)
@ApiOperation({ deprecated: true, summary: 'Endpoint removed' })
create() {
  throw new GoneException(
    'This endpoint has been removed. Use POST /api/v1/voice-ai/agent-profile-overrides instead. ' +
    'See migration guide: /api/docs'
  );
}
```

---

## ⚠️ HIGH RISK ISSUES (Should Fix)

### **ISSUE 7: Field Name Inconsistencies**

**Global Profiles** (Sprint 14):
- `default_greeting`
- `default_instructions`

**Tenant Overrides** (Sprint 17):
- `custom_greeting`
- `custom_instructions`

**Problem**: Confusing naming - both refer to customizable text.

**Recommendation**: Use consistent naming:
- Global: `default_greeting`, `default_instructions`
- Override: `custom_greeting`, `custom_instructions` (OK, distinguishes customization)

**OR**:
- Global: `greeting_template`, `instructions_template`
- Override: `greeting_override`, `instructions_override` (clearer intent)

---

### **ISSUE 8: Context Builder Backward Compatibility Risk**

**Sprint 18** changes context builder resolution from:
```typescript
// OLD: Query tenant profiles
const profile = await prisma.tenant_voice_agent_profile.findFirst({
  where: { id: agentProfileId, tenant_id: tenantId },
});
```

**To**:
```typescript
// NEW: Query global profiles
const globalProfile = await prisma.voice_ai_agent_profile.findFirst({
  where: { id: agentProfileId },  // NO tenant_id
});
```

**Risk**: If Sprint 18 runs BEFORE data migration (Sprint 15), ALL CALLS BREAK.

**Fix**: Add explicit prerequisite checks:
```typescript
// At start of Sprint 18 implementation:
const globalProfileCount = await prisma.voice_ai_agent_profile.count();
if (globalProfileCount === 0) {
  throw new Error('BLOCKER: Sprint 15 data migration must complete before Sprint 18');
}
```

---

### **ISSUE 9: Missing Rollback Scripts**

**Current State**: Each sprint has conceptual rollback, but no executable scripts.

**Risk**: If Sprint 16 fails mid-implementation, how to rollback cleanly?

**Fix**: Add actual rollback scripts:
```bash
# Sprint 14 rollback:
/api/scripts/rollback-sprint-14.sh

# Sprint 15 rollback:
/api/scripts/rollback-sprint-15.sh
```

---

### **ISSUE 10: Plan Limit Semantics Change Not Documented**

**Before**: `voice_ai_max_agent_profiles` = max profiles tenant can CREATE

**After**: `voice_ai_max_agent_profiles` = max profiles tenant can ACTIVATE

**Problem**: Column name is same, meaning changed.

**Impact**: Existing plan configs may be incorrect (e.g., plan says "1" meaning "1 creation", but now means "1 active selection").

**Fix**: Rename column in Sprint 14:
```sql
ALTER TABLE subscription_plan
CHANGE COLUMN voice_ai_max_agent_profiles voice_ai_max_active_languages INT;
```

Update Sprint 17 validation to use new column name.

---

## 📋 REQUIRED FIXES CHECKLIST

### **Before Implementation**:

- [ ] **Fix 1**: Add Sprint 13.5: Verify migration state (check if 20260304 already applied)
- [ ] **Fix 2**: Resolve table naming (`tenant_voice_agent_profile_override` vs `tenant_voice_ai_agent_profile_override`)
- [ ] **Fix 3**: Add Sprint 15B: IVR config migration script
- [ ] **Fix 4**: Update Sprint 15 to preserve default_agent_profile_id references
- [ ] **Fix 5**: Add auto-creation of global profiles for all unique languages found
- [ ] **Fix 6**: Change Sprint 17 to DISABLE old endpoints (not deprecate)
- [ ] **Fix 7**: Standardize field naming (default/custom vs template/override)
- [ ] **Fix 8**: Add prerequisite checks to Sprint 18 (verify Sprint 15 complete)
- [ ] **Fix 9**: Create executable rollback scripts
- [ ] **Fix 10**: Rename plan limit column for clarity

### **Testing Requirements**:

- [ ] Test migration on COPY of production database first
- [ ] Verify NO data loss (count records before/after)
- [ ] Test rollback scripts work
- [ ] Test existing IVR configs still function after migration
- [ ] Test existing calls continue working

---

## 🎯 REVISED IMPLEMENTATION PLAN

### **Phase 0: Pre-Flight Checks** (NEW)

**Sprint 13.5**: Verify Current State
- Check migration status
- Count existing tenant profiles
- Identify unique language codes
- List IVR configs using profiles
- Export current data as backup

### **Phase 1: Schema & Data** (Revised)

**Sprint 14**: Schema Migration (REVISED)
- Create `voice_ai_agent_profile` table
- Rename `tenant_voice_agent_profile` → `tenant_voice_agent_profile_override`
- Add `agent_profile_id` FK column (nullable)
- DO NOT add FK constraint yet

**Sprint 15**: Data Migration (REVISED)
- Create global profiles for ALL unique languages (not just en/pt/es)
- Map tenant profiles to overrides
- Update `default_agent_profile_id` references
- Add FK constraint

**Sprint 15B**: IVR Config Migration (NEW)
- Update IVR menu_options JSON with new profile IDs
- Update default_action JSON
- Verify all configs valid

### **Phase 2: Backend** (Minor Revisions)

**Sprint 16**: Admin Controller (OK as-is)

**Sprint 17**: Tenant Controller (REVISED)
- Add new override endpoints
- DISABLE old endpoints (return 410 Gone)
- Force all clients to new pattern

**Sprint 18**: Context Builder (REVISED)
- Add prerequisite check (Sprint 15 complete)
- Update resolution logic
- Maintain fallback for edge cases

**Sprint 19**: API Docs (OK as-is)

### **Phase 3: Frontend** (OK as-is)

**Sprint 20**: Admin UI
**Sprint 21**: Tenant UI + IVR

---

## 🚦 GO/NO-GO DECISION

**Current Status**: ⛔ **NO-GO**

**Blockers**: 6 critical issues must be resolved

**Estimated Fix Time**: 12-16 hours to revise sprints

**Recommendation**:
1. PAUSE current implementation
2. Apply fixes 1-10 to sprint files
3. Create Sprint 15B (IVR migration)
4. Test on staging data
5. Re-review before production

---

## 📞 NEXT STEPS

**Immediate Actions**:
1. User decision: Accept these fixes? (Yes/No)
2. If Yes: I'll revise sprint files 14-21 with fixes
3. If No: Discuss specific concerns

**After Fixes**:
1. Run Sprint 13.5 (verify state)
2. Test migration on copy of DB
3. Execute sprints 14-21 sequentially

---

**This review prevents production incidents. The architecture is sound; execution needs refinement.**
