# Sprint 18: Context Builder + IVR Integration Update
## Voice Multilingual Architecture Fix

**Sprint Number**: 18 of 21
**Sprint Owner**: Backend Specialist - Integration
**Estimated Effort**: 4-5 hours
**Prerequisites**: Sprints 16-17 complete (admin + tenant APIs working)

---

## Sprint Owner Role

You are a **masterclass Backend Integration Specialist** that makes Google, Amazon, and Apple jealous. You NEVER GUESS - you read existing context builder logic thoroughly, understand the resolution chain completely, and test integration exhaustively before marking complete.

---

## Goal

Update voice AI context resolution and IVR validation to work with the new global profile + tenant override architecture:

1. **Context Builder**: Load global profiles + apply tenant overrides
2. **IVR Validation**: Validate against global profile IDs (not tenant profiles)
3. **Backward Compatibility**: Existing calls continue working during transition

---

## Task 1: Update Context Builder Service

**File**: `/api/src/modules/voice-ai/services/voice-ai-context-builder.service.ts`

### 1.1 Read Existing Logic

**Understand current 3-step resolution chain**:
1. Try `agent_profile_id` from IVR → loads tenant profile
2. Try `default_agent_profile_id` from settings → loads tenant profile
3. Fallback to `enabled_languages` + `voice_id_override`

### 1.2 Update Resolution Logic

**Find the method**: `buildContext()` or similar

**Replace profile resolution with**:

```typescript
// Step 1: Try agent_profile_id from IVR (NOW references GLOBAL profile)
let resolvedProfile: {
  language: string;
  voice_id: string;
  greeting?: string;
  instructions?: string;
} | null = null;

if (agentProfileId) {
  const globalProfile = await this.prisma.voice_ai_agent_profile.findFirst({
    where: {
      id: agentProfileId,
      is_active: true,
    },
  });

  if (globalProfile) {
    // Check for tenant override
    const override = await this.prisma.tenant_voice_ai_agent_profile_override.findFirst({
      where: {
        tenant_id: tenantId,
        agent_profile_id: globalProfile.id,
        is_active: true,
      },
    });

    resolvedProfile = {
      language: globalProfile.language_code,
      voice_id: globalProfile.voice_id,
      greeting: override?.custom_greeting ?? globalProfile.default_greeting,
      instructions: override?.custom_instructions ?? globalProfile.default_instructions,
    };

    context.active_agent_profile = {
      id: globalProfile.id,
      title: globalProfile.display_name,
      language_code: globalProfile.language_code,
      is_override: !!override,
    };
  }
}

// Step 2: Try default_agent_profile_id from settings (NOW references override ID)
if (!resolvedProfile && tenantSettings?.default_agent_profile_id) {
  const override = await this.prisma.tenant_voice_ai_agent_profile_override.findFirst({
    where: {
      id: tenantSettings.default_agent_profile_id,
      tenant_id: tenantId,
      is_active: true,
    },
    include: {
      agent_profile: true,
    },
  });

  if (override?.agent_profile) {
    resolvedProfile = {
      language: override.agent_profile.language_code,
      voice_id: override.agent_profile.voice_id,
      greeting: override.custom_greeting ?? override.agent_profile.default_greeting,
      instructions: override.custom_instructions ?? override.agent_profile.default_instructions,
    };

    context.active_agent_profile = {
      id: override.agent_profile.id,
      title: override.agent_profile.display_name,
      language_code: override.agent_profile.language_code,
      is_override: true,
    };
  }
}

// Step 3: Fallback to existing behavior (unchanged)
if (!resolvedProfile) {
  const enabledLanguages = JSON.parse(tenantSettings?.enabled_languages || '["en"]');
  resolvedProfile = {
    language: enabledLanguages[0] ?? globalConfig.default_language ?? 'en',
    voice_id: tenantSettings?.voice_id_override ?? globalConfig.default_voice_id ?? null,
  };
}

// Apply resolved profile to context
context.behavior.language = resolvedProfile.language;
context.providers.tts.voice_id = resolvedProfile.voice_id;

if (resolvedProfile.greeting) {
  context.behavior.greeting = resolvedProfile.greeting.replace(
    '{business_name}',
    tenant.company_name
  );
}

if (resolvedProfile.instructions) {
  context.llm.system_prompt = `${globalConfig.default_system_prompt}\n\n${resolvedProfile.instructions}`;
}
```

---

## Task 2: Update IVR Validation

**File**: `/api/src/modules/communication/services/ivr-configuration.service.ts`

### 2.1 Find IVR Validation Logic

**Look for**: Method that validates voice_ai actions in `createOrUpdate()` or similar

### 2.2 Update Validation

**OLD Validation** (Sprint 1-12):
```typescript
// Validated against tenant profiles (WRONG)
const profiles = await this.prisma.tenant_voice_agent_profile.findMany({
  where: {
    id: { in: profileIds },
    tenant_id: tenantId,
  },
});
```

**NEW Validation** (This Sprint):
```typescript
// Extract all agent_profile_id values from IVR config
const profileIds: string[] = [];

// From menu_options
if (menuOptions && Array.isArray(menuOptions)) {
  menuOptions.forEach((option) => {
    if (option.action === 'voice_ai' && option.config?.agent_profile_id) {
      profileIds.push(option.config.agent_profile_id);
    }
  });
}

// From default_action
if (defaultAction?.action === 'voice_ai' && defaultAction.config?.agent_profile_id) {
  profileIds.push(defaultAction.config.agent_profile_id);
}

// Validate: All profile IDs must reference GLOBAL profiles (not tenant overrides)
if (profileIds.length > 0) {
  const globalProfiles = await this.prisma.voice_ai_agent_profile.findMany({
    where: {
      id: { in: profileIds },
      is_active: true,
    },
  });

  if (globalProfiles.length !== profileIds.length) {
    const missingIds = profileIds.filter(
      (id) => !globalProfiles.some((p) => p.id === id)
    );
    throw new BadRequestException(
      `Invalid voice agent profile ID(s): ${missingIds.join(', ')}. ` +
      `Profile must be a valid active global profile. ` +
      `To see available profiles, use GET /api/v1/voice-ai/available-profiles`
    );
  }
}
```

---

## Task 3: Test Integration End-to-End

### 3.1 Test Scenario: Global Profile with Tenant Override

**Setup**:
1. Admin creates global profile "English - Professional" (ID: `global-en-001`)
2. Tenant creates override with custom greeting: "Welcome to Acme Plumbing!"
3. IVR action references `global-en-001`
4. Initiate test call

**Expected Result**:
- Context builder loads global profile (`global-en-001`)
- Applies tenant's custom greeting
- Uses global `voice_id`
- Uses global `default_instructions` (no override)

**Verification**:
```bash
# Check context endpoint
curl -X GET https://api.lead360.app/api/v1/internal/voice-ai/context/{tenant-id}/{call-sid} \
  -H "Authorization: Bearer $INTERNAL_TOKEN"

# Verify response contains:
# - language: "en"
# - greeting: "Welcome to Acme Plumbing!" (tenant override)
# - voice_id: (global voice ID)
# - system_prompt: (includes global default instructions)
```

### 3.2 Test Scenario: Global Profile without Override

**Setup**:
1. Admin creates global profile "Portuguese - Friendly"
2. Tenant does NOT create override
3. IVR references Portuguese profile
4. Initiate test call

**Expected Result**:
- Context uses global `default_greeting`
- Context uses global `default_instructions`
- No tenant customization applied

### 3.3 Test Scenario: Invalid Profile ID

**Setup**:
1. IVR action references non-existent profile ID: `fake-profile-999`

**Expected Result**:
- IVR validation fails with `400 Bad Request`
- Error message: "Invalid voice agent profile ID(s): fake-profile-999..."

### 3.4 Test Scenario: Inactive Global Profile

**Setup**:
1. Admin deactivates global profile (`is_active=false`)
2. Tenant tries to use it in IVR

**Expected Result**:
- IVR validation fails (profile not found in active profiles)
- Existing IVR configs with this profile return error during context resolution

---

## Task 4: Backward Compatibility Check

**Verify**:
- [ ] Existing calls (before migration) still work
- [ ] Old IVR configs (if any exist with tenant profile IDs) handled gracefully
- [ ] Context builder doesn't crash if profile not found (falls back to Step 3)

**If old IVR configs exist with tenant profile IDs**:
- Add migration script to update IVR configs (convert tenant profile IDs → global profile IDs)
- Or: Add fallback logic to handle old tenant profile IDs during transition period

---

## Acceptance Criteria

- [ ] Context builder updated (3-step resolution with global/override merge)
- [ ] IVR validation updated (accepts only global profile IDs)
- [ ] Test scenario 3.1 passes (global + override)
- [ ] Test scenario 3.2 passes (global only, no override)
- [ ] Test scenario 3.3 passes (invalid ID rejected)
- [ ] Test scenario 3.4 passes (inactive profile rejected)
- [ ] Backward compatibility verified (existing calls work)
- [ ] No TypeScript/lint errors
- [ ] All tests passing

---

## Deliverables

### Files Modified
1. `/api/src/modules/voice-ai/services/voice-ai-context-builder.service.ts` - Profile resolution logic
2. `/api/src/modules/communication/services/ivr-configuration.service.ts` - IVR validation logic

### Optional
- Migration script if old IVR configs need updating

---

## Next Sprint

**Sprint 19**: API Documentation - Update REST API docs with new endpoints and architecture

---

**Sprint Status**: Ready to Execute
