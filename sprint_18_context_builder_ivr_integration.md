# Sprint 18: Context Builder + IVR Integration Update
## Voice Multilingual Architecture Fix

**Sprint Number**: 18 of 21  
**Sprint Owner**: Backend Specialist - Integration  
**Estimated Effort**: 4-5 hours  
**Prerequisites**: Sprints 16-17 complete

---

## Sprint Owner Role

You are a **masterclass Backend Integration Specialist** from Google/Amazon/Apple level. You NEVER GUESS - you read existing context builder logic, understand the resolution chain, and test integration thoroughly.

---

## Goal

Update voice AI context resolution to:
1. **Load global profiles** (not tenant profiles)
2. **Apply tenant overrides** if they exist
3. **Merge** global defaults + tenant customizations
4. **Update IVR validation** to accept global profile IDs

---

## Task 1: Update Context Builder

**File**: `/api/src/modules/voice-ai/services/voice-ai-context-builder.service.ts`

### Current Logic (3-step chain):
1. Try `agent_profile_id` from IVR → load tenant profile
2. Try `default_agent_profile_id` from settings → load tenant profile  
3. Fallback to language list + voice_id override

### New Logic (3-step chain with global/override merge):

```typescript
// Step 1: Try agent_profile_id from IVR (NOW references GLOBAL profile)
if (agentProfileId) {
  const globalProfile = await prisma.voice_ai_agent_profile.findFirst({
    where: { id: agentProfileId, is_active: true },
  });

  if (globalProfile) {
    // Check for tenant override
    const override = await prisma.tenant_voice_ai_agent_profile_override.findFirst({
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
  }
}

// Step 2: Try default_agent_profile_id from settings (NOW references override ID)
if (!resolvedProfile && tenantSettings?.default_agent_profile_id) {
  const override = await prisma.tenant_voice_ai_agent_profile_override.findFirst({
    where: {
      id: tenantSettings.default_agent_profile_id,
      tenant_id: tenantId,
      is_active: true,
    },
    include: { agent_profile: true },
  });

  if (override?.agent_profile) {
    resolvedProfile = {
      language: override.agent_profile.language_code,
      voice_id: override.agent_profile.voice_id,
      greeting: override.custom_greeting ?? override.agent_profile.default_greeting,
      instructions: override.custom_instructions ?? override.agent_profile.default_instructions,
    };
  }
}

// Step 3: Fallback (unchanged)
if (!resolvedProfile) {
  resolvedProfile = {
    language: enabledLanguages[0] ?? 'en',
    voice_id: tenantSettings?.voice_id_override ?? globalConfig.default_voice_id,
  };
}

// Apply to context
context.behavior.language = resolvedProfile.language;
context.providers.tts.voice_id = resolvedProfile.voice_id;

if (resolvedProfile.greeting) {
  context.behavior.greeting = resolvedProfile.greeting.replace('{business_name}', tenant.company_name);
}

if (resolvedProfile.instructions) {
  context.llm.system_prompt = `${globalConfig.default_system_prompt}\n\n${resolvedProfile.instructions}`;
}
```

**Test**: Create test cases verifying profile resolution works correctly.

---

## Task 2: Update IVR Validation

**File**: `/api/src/modules/communication/services/ivr-configuration.service.ts`

### Change Validation Logic:

**OLD** (Sprint 1-12):
```typescript
// Validated against tenant_voice_agent_profile (WRONG)
const profiles = await prisma.tenant_voice_agent_profile.findMany({
  where: { id: { in: profileIds }, tenant_id: tenantId },
});
```

**NEW** (This Sprint):
```typescript
// Validate against GLOBAL profiles (CORRECT)
const globalProfiles = await prisma.voice_ai_agent_profile.findMany({
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
    `Invalid agent profile ID(s): ${missingIds.join(', ')}. ` +
    `Profile must be a valid active global profile.`
  );
}
```

**Test**: Verify IVR only accepts global profile IDs, rejects tenant profile IDs.

---

## Task 3: Test Integration End-to-End

### 3.1 Test Scenario: Global Profile with Override

**Setup**:
1. Admin creates global profile: English - Professional (ID: global-en-001)
2. Tenant creates override with custom greeting
3. IVR action references global-en-001
4. Call initiated

**Expected**:
- Context builder loads global profile
- Applies tenant's custom greeting
- Uses global voice_id and default instructions

**Verification**:
```bash
# Check context output
curl -X GET https://api.lead360.app/api/v1/internal/voice-ai/context/{tenant-id}/{call-sid}
```

### 3.2 Test Scenario: Global Profile without Override

**Setup**:
1. Admin creates global profile: Portuguese - Friendly  
2. Tenant does NOT create override
3. IVR references global profile

**Expected**:
- Context uses global default greeting
- Context uses global default instructions

### 3.3 Test Scenario: Invalid Profile ID

**Setup**:
1. IVR references non-existent profile ID

**Expected**:
- IVR validation fails with 400 Bad Request

---

## Acceptance Criteria

- [ ] Context builder updated (3-step resolution with global/override merge)
- [ ] IVR validation updated (accepts global profile IDs only)
- [ ] All test scenarios pass
- [ ] Existing calls still work (backward compatibility verified)
- [ ] No TypeScript/lint errors

---

**Next Sprint**: 19 - API Documentation Update

ENDOF
Sprint18
