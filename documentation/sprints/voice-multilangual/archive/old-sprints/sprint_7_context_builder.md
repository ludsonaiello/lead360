# Sprint 7: Context Builder - Language & Voice Resolution

## 🎯 Sprint Owner Role

You are a **MASTERCLASS AI CONTEXT ARCHITECT** that makes Google, Amazon, and Apple AI engineers jealous.

You build context resolution systems that are **intelligent** and **performant**. You **think deeply** about resolution chains, **breathe data aggregation**, and **never rush** through changes that affect AI agent behavior. You **always verify** existing context patterns and **never guess** fallback logic.

**100% quality or beyond**. The context builder powers every AI call - mistakes here affect conversation quality for all customers.

---

## 📋 Sprint Objective

Update VoiceAiContextBuilderService to resolve language/voice from agent profiles:
1. Add optional `agentProfileId` parameter to `buildContext()` method
2. Implement 3-step resolution chain (profile → default → fallback)
3. Extend VoiceAiContext interface with `active_agent_profile` field
4. Implement **APPEND** behavior for custom_instructions (confirmed requirement)
5. Write comprehensive tests

**Dependencies**: Sprint 6 complete (SIP service passes profile ID)

---

## 📚 Required Reading

1. **Contract**: `/var/www/lead360.app/documentation/contracts/voice-multilangual-contract.md` - Section 9
2. **Context Builder**: `/var/www/lead360.app/api/src/modules/voice-ai/services/voice-ai-context-builder.service.ts`
3. **Context Interface**: `/var/www/lead360.app/api/src/modules/voice-ai/interfaces/voice-ai-context.interface.ts`
4. **Agent Utils Types**: `/var/www/lead360.app/api/src/modules/voice-ai/agent/utils/api-types.ts`

---

## 🔐 Test Environment

**Database**: `mysql://lead360_user:978@F32c@127.0.0.1:3306/lead360`
**Tenant User**: `contact@honeydo4you.com` / `978@F32c`
**Server**: `npm run start:dev`

---

## 📐 Implementation

### Change 1: Extend VoiceAiContext Interface

**File**: `/var/www/lead360.app/api/src/modules/voice-ai/interfaces/voice-ai-context.interface.ts`

```typescript
// Add this interface near top of file
export interface ActiveAgentProfile {
  id: string;
  title: string;
  language_code: string;
}

// Find FullVoiceAiContext interface and add new field:
export interface FullVoiceAiContext {
  // ... existing fields

  active_agent_profile?: ActiveAgentProfile | null; // NEW FIELD
}
```

**Also update**: `/var/www/lead360.app/api/src/modules/voice-ai/agent/utils/api-types.ts`

Mirror the same change in the agent utils copy of this interface.

---

### Change 2: Update buildContext() Signature & Resolution Logic

**File**: `/var/www/lead360.app/api/src/modules/voice-ai/services/voice-ai-context-builder.service.ts`

```typescript
/**
 * Builds complete VoiceAI context for a tenant
 * @param tenantId - Tenant UUID
 * @param callSid - Twilio call SID (optional)
 * @param agentProfileId - Voice agent profile ID for language/voice selection (optional) - NEW
 */
async buildContext(
  tenantId: string,
  callSid?: string,
  agentProfileId?: string, // NEW PARAMETER
): Promise<FullVoiceAiContext> {
  // Step 1-4: Load tenant, plan, settings, global config (EXISTING CODE - no changes)
  const [tenant, globalConfig] = await Promise.all([
    this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        subscription_plan: true,
        tenant_voice_ai_settings: true,
      },
    }),
    this.prisma.voice_ai_global_config.findFirst({
      where: { is_active: true },
      // ... existing includes
    }),
  ]);

  if (!tenant) {
    throw new NotFoundException(`Tenant ${tenantId} not found`);
  }

  const tenantSettings = tenant.tenant_voice_ai_settings;

  // NEW: Step 4.5 - Resolve language, voice, greeting, and instructions from agent profile
  const profileResolution = await this.resolveAgentProfile(
    tenantId,
    agentProfileId,
    tenantSettings,
  );

  // Use profile-resolved values or fall back to existing logic
  const language =
    profileResolution.language ||
    this.parseJsonArray(tenantSettings?.enabled_languages)[0] ||
    globalConfig?.default_language ||
    'en';

  const ttsVoiceId =
    profileResolution.voice_id ||
    tenantSettings?.voice_id_override ||
    globalConfig?.default_voice_id ||
    null;

  const greeting =
    profileResolution.custom_greeting ||
    tenantSettings?.custom_greeting ||
    globalConfig?.default_greeting_template ||
    'Hello! How can I help you today?';

  // NEW: Build system_prompt with APPEND behavior for profile instructions
  let systemPrompt =
    globalConfig?.default_system_prompt || 'You are a helpful assistant.';

  // Append tenant-level instructions
  if (tenantSettings?.custom_instructions) {
    systemPrompt += '\n\n' + tenantSettings.custom_instructions;
  }

  // Append profile-level instructions (CONFIRMED: APPEND, not replace)
  if (profileResolution.custom_instructions) {
    systemPrompt += '\n\n' + profileResolution.custom_instructions;
  }

  // ... rest of existing code (quota, providers, services, etc.)

  // Build final context
  const context: FullVoiceAiContext = {
    // ... existing fields
    behavior: {
      language, // Profile-resolved or fallback
      greeting, // Profile-resolved or fallback
      system_prompt: systemPrompt, // With appended instructions
      // ... other behavior fields
    },
    providers: {
      // ... existing providers
      tts: {
        provider_id: ttsProviderId,
        voice_id: ttsVoiceId, // Profile-resolved or fallback
        // ... other TTS config
      },
    },
    active_agent_profile: profileResolution.active_profile, // NEW FIELD
    // ... rest of context
  };

  return context;
}

// NEW METHOD: 3-step agent profile resolution
private async resolveAgentProfile(
  tenantId: string,
  agentProfileId: string | undefined,
  tenantSettings: any,
): Promise<{
  language: string | null;
  voice_id: string | null;
  custom_greeting: string | null;
  custom_instructions: string | null;
  active_profile: ActiveAgentProfile | null;
}> {
  // Step 1: Try explicit agentProfileId (from IVR config)
  if (agentProfileId) {
    const profile = await this.prisma.tenant_voice_agent_profile.findFirst({
      where: {
        id: agentProfileId,
        tenant_id: tenantId,
        is_active: true,
      },
    });

    if (profile) {
      return {
        language: profile.language_code,
        voice_id: profile.voice_id,
        custom_greeting: profile.custom_greeting,
        custom_instructions: profile.custom_instructions,
        active_profile: {
          id: profile.id,
          title: profile.title,
          language_code: profile.language_code,
        },
      };
    }
  }

  // Step 2: Try default_agent_profile_id from settings
  if (tenantSettings?.default_agent_profile_id) {
    const profile = await this.prisma.tenant_voice_agent_profile.findFirst({
      where: {
        id: tenantSettings.default_agent_profile_id,
        tenant_id: tenantId,
        is_active: true,
      },
    });

    if (profile) {
      return {
        language: profile.language_code,
        voice_id: profile.voice_id,
        custom_greeting: profile.custom_greeting,
        custom_instructions: profile.custom_instructions,
        active_profile: {
          id: profile.id,
          title: profile.title,
          language_code: profile.language_code,
        },
      };
    }
  }

  // Step 3: No profile resolved - return nulls (fall through to existing behavior)
  return {
    language: null,
    voice_id: null,
    custom_greeting: null,
    custom_instructions: null,
    active_profile: null,
  };
}
```

**Key Points**:
- ✅ 3-step resolution: agentProfileId → default_agent_profile_id → fallback
- ✅ Only active profiles are resolved
- ✅ Profile not found = graceful fallback (no error thrown)
- ✅ custom_instructions **APPENDS** (confirmed requirement)
- ✅ active_agent_profile populated in context when profile resolved

---

### Change 3: Add Unit Tests

**File**: `/var/www/lead360.app/api/src/modules/voice-ai/services/voice-ai-context-builder.service.spec.ts`

```typescript
describe('buildContext - agent profile resolution', () => {
  const mockProfile = {
    id: 'profile-123',
    tenant_id: 'tenant-123',
    title: 'Spanish Agent',
    language_code: 'es',
    voice_id: 'spanish-voice-id',
    custom_greeting: 'Hola!',
    custom_instructions: 'Speak in Spanish.',
    is_active: true,
  };

  it('should resolve language and voice from agentProfileId (Step 1)', async () => {
    jest.spyOn(prisma.tenant, 'findUnique').mockResolvedValue({
      id: 'tenant-123',
      subscription_plan: { voice_ai_enabled: true },
      tenant_voice_ai_settings: {
        enabled_languages: '["en"]',
        voice_id_override: 'default-voice',
        default_agent_profile_id: null,
      },
    } as any);

    jest
      .spyOn(prisma.tenant_voice_agent_profile, 'findFirst')
      .mockResolvedValue(mockProfile as any);

    const context = await service.buildContext(
      'tenant-123',
      'CA123',
      'profile-123',
    );

    expect(context.behavior.language).toBe('es'); // From profile
    expect(context.providers.tts.voice_id).toBe('spanish-voice-id'); // From profile
    expect(context.behavior.greeting).toBe('Hola!'); // From profile
    expect(context.behavior.system_prompt).toContain('Speak in Spanish.'); // Appended
    expect(context.active_agent_profile).toEqual({
      id: 'profile-123',
      title: 'Spanish Agent',
      language_code: 'es',
    });
  });

  it('should fall back to default_agent_profile_id if agentProfileId not provided (Step 2)', async () => {
    jest.spyOn(prisma.tenant, 'findUnique').mockResolvedValue({
      id: 'tenant-123',
      subscription_plan: { voice_ai_enabled: true },
      tenant_voice_ai_settings: {
        default_agent_profile_id: 'profile-123',
        enabled_languages: '["en"]',
        voice_id_override: 'default-voice',
      },
    } as any);

    jest
      .spyOn(prisma.tenant_voice_agent_profile, 'findFirst')
      .mockResolvedValue(mockProfile as any);

    const context = await service.buildContext('tenant-123', 'CA123');

    expect(context.behavior.language).toBe('es'); // From default profile
    expect(context.active_agent_profile).not.toBeNull();
  });

  it('should fall back to existing behavior if no profile resolved (Step 3)', async () => {
    jest.spyOn(prisma.tenant, 'findUnique').mockResolvedValue({
      id: 'tenant-123',
      subscription_plan: { voice_ai_enabled: true },
      tenant_voice_ai_settings: {
        default_agent_profile_id: null,
        enabled_languages: '["fr"]',
        voice_id_override: 'fallback-voice',
      },
    } as any);

    jest
      .spyOn(prisma.tenant_voice_agent_profile, 'findFirst')
      .mockResolvedValue(null); // No profile found

    const context = await service.buildContext('tenant-123', 'CA123');

    expect(context.behavior.language).toBe('fr'); // From enabled_languages
    expect(context.providers.tts.voice_id).toBe('fallback-voice'); // From override
    expect(context.active_agent_profile).toBeNull(); // No profile resolved
  });

  it('should gracefully fall back if profile is inactive', async () => {
    jest.spyOn(prisma.tenant_voice_agent_profile, 'findFirst').mockResolvedValue(null); // Inactive filtered out

    const context = await service.buildContext(
      'tenant-123',
      'CA123',
      'inactive-profile-id',
    );

    expect(context.active_agent_profile).toBeNull();
    // Falls through to existing behavior
  });

  it('should APPEND profile custom_instructions to tenant instructions', async () => {
    jest.spyOn(prisma.tenant, 'findUnique').mockResolvedValue({
      id: 'tenant-123',
      subscription_plan: { voice_ai_enabled: true },
      tenant_voice_ai_settings: {
        custom_instructions: 'You work for a plumbing company.',
      },
    } as any);

    jest
      .spyOn(prisma.tenant_voice_agent_profile, 'findFirst')
      .mockResolvedValue({
        ...mockProfile,
        custom_instructions: 'You speak Spanish.',
      } as any);

    const context = await service.buildContext(
      'tenant-123',
      'CA123',
      'profile-123',
    );

    expect(context.behavior.system_prompt).toContain(
      'You work for a plumbing company.',
    );
    expect(context.behavior.system_prompt).toContain('You speak Spanish.');
    // Both instructions present (APPEND behavior)
  });
});
```

---

## ✅ Acceptance Criteria

### Interface Changes
- ✅ VoiceAiContext interface has `active_agent_profile` field
- ✅ api-types.ts mirrors the change

### Context Builder
- ✅ buildContext() accepts optional `agentProfileId` parameter
- ✅ Step 1: Resolves from explicit agentProfileId (if provided and active)
- ✅ Step 2: Falls back to default_agent_profile_id from settings
- ✅ Step 3: Falls back to existing behavior (enabled_languages, voice_id_override)
- ✅ Inactive profiles ignored (graceful fallback)
- ✅ Profile not found = graceful fallback (no error)
- ✅ custom_instructions **APPENDS** (not replaces)
- ✅ active_agent_profile populated when profile resolved

### Testing
- ✅ All 3 resolution steps tested
- ✅ APPEND behavior tested
- ✅ Inactive profile fallback tested
- ✅ Null profile fallback tested

**Manual Test**:
```bash
# Create profile
TOKEN=$(curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' \
  | jq -r '.access_token')

PROFILE_ID=$(curl -X POST http://localhost:8000/api/v1/voice-ai/agent-profiles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Spanish Agent",
    "language_code": "es",
    "voice_id": "spanish-voice",
    "custom_instructions": "Speak Spanish only."
  }' | jq -r '.id')

# Simulate internal context call (from agent worker)
# Will need to add route in Sprint 8
```

---

## 📊 Sprint Completion Report

```markdown
## Sprint 7 Completion: Context Builder

**Status**: ✅ Complete

### Changes Made
- ✅ voice-ai-context.interface.ts (added active_agent_profile field)
- ✅ api-types.ts (mirrored interface change)
- ✅ voice-ai-context-builder.service.ts (3-step resolution + APPEND logic)

### Resolution Logic Implemented
- ✅ Step 1: agentProfileId (from IVR) - WORKING
- ✅ Step 2: default_agent_profile_id (from settings) - WORKING
- ✅ Step 3: Fallback (existing behavior) - WORKING
- ✅ Inactive profiles ignored gracefully
- ✅ custom_instructions APPENDS (confirmed)

### Testing
- ✅ Unit tests covering all 3 steps
- ✅ APPEND behavior verified
- ✅ Graceful fallback verified

**Next Steps**: Sprint 8 will expose this via internal endpoint for agent worker.

**Sprint Owner**: [Name]
**Date**: [Date]
```

🚀 **Smart context resolution with multi-language support!**
