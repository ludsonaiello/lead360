# Voice Multilingual Implementation Guide
## Architecture Fix - Sprints 13-21

**Version**: 1.0
**Last Updated**: March 4, 2026
**Status**: Active Implementation Guide

---

## Overview

This guide coordinates the implementation of the voice multilingual architecture fix across 9 sprints (13-21). The fix addresses a critical architectural flaw where tenants create their own profiles instead of selecting from system-admin-managed global profiles.

---

## Quick Reference

| Sprint | Focus | Type | Status |
|--------|-------|------|--------|
| 13 | Data review & preparation | Backend | ✅ Created |
| 14 | Prisma schema migration | Backend | ✅ Created |
| 15 | Data migration execution | Backend | ✅ Created |
| 16 | Admin controller (global profiles) | Backend | 📝 Pending |
| 17 | Tenant override controller | Backend | 📝 Pending |
| 18 | Context builder + IVR update | Backend | 📝 Pending |
| 19 | API documentation | Backend | 📝 Pending |
| 20 | Admin UI (global profiles) | Frontend | 📝 Pending |
| 21 | Tenant UI + IVR builder | Frontend | 📝 Pending |

---

## Sprint 16: Admin Controller (Global Profiles)

### Owner: Backend Specialist - System Admin API

### Goal
Create system admin CRUD endpoints for managing global voice agent profiles.

### Key Files
- **NEW**: `api/src/modules/voice-ai/controllers/admin/voice-ai-global-agent-profiles.controller.ts`
- **NEW**: `api/src/modules/voice-ai/services/voice-ai-global-agent-profiles.service.ts`
- **NEW**: `api/src/modules/voice-ai/dto/create-global-agent-profile.dto.ts`
- **NEW**: `api/src/modules/voice-ai/dto/update-global-agent-profile.dto.ts`

### Endpoints
```
POST   /api/v1/system/voice-ai/agent-profiles
GET    /api/v1/system/voice-ai/agent-profiles
GET    /api/v1/system/voice-ai/agent-profiles/:id
PATCH  /api/v1/system/voice-ai/agent-profiles/:id
DELETE /api/v1/system/voice-ai/agent-profiles/:id
```

### Guards
- `JwtAuthGuard`
- `PlatformAdminGuard` (system admin only)

### Service Methods
```typescript
class VoiceAiGlobalAgentProfilesService {
  async create(dto: CreateGlobalAgentProfileDto, userId: string)
  async findAll(activeOnly?: boolean)
  async findOne(id: string)
  async update(id: string, dto: UpdateGlobalAgentProfileDto, userId: string)
  async remove(id: string) // Soft delete (is_active = false)
}
```

### Validation Rules
- `language_code`: 2-10 chars
- `display_name`: 1-100 chars, unique
- `voice_id`: 1-200 chars
- Cannot delete if tenant overrides exist (count check)

### Module Registration
Update `voice-ai.module.ts`:
```typescript
controllers: [
  // ... existing
  VoiceAiGlobalAgentProfilesController,
],
providers: [
  // ... existing
  VoiceAiGlobalAgentProfilesService,
],
```

---

## Sprint 17: Tenant Override Controller

### Owner: Backend Specialist - Tenant API

### Goal
Refactor tenant profile controller to manage overrides instead of creating profiles.

### Key Files
- **REFACTOR**: `api/src/modules/voice-ai/controllers/tenant/voice-agent-profiles.controller.ts`
- **REFACTOR**: `api/src/modules/voice-ai/services/voice-agent-profiles.service.ts`
- **NEW**: `api/src/modules/voice-ai/dto/create-agent-profile-override.dto.ts`
- **NEW**: `api/src/modules/voice-ai/dto/update-agent-profile-override.dto.ts`

### Endpoints (Updated)
```
GET    /api/v1/voice-ai/agent-profiles           → List available global profiles
GET    /api/v1/voice-ai/agent-profile-overrides → List tenant's overrides
POST   /api/v1/voice-ai/agent-profile-overrides → Create override for global profile
PATCH  /api/v1/voice-ai/agent-profile-overrides/:id → Update override
DELETE /api/v1/voice-ai/agent-profile-overrides/:id → Delete override
```

### New Service Logic
```typescript
class VoiceAgentProfilesService {
  // List global profiles (read-only for tenants)
  async listAvailableProfiles(activeOnly: boolean = true) {
    return prisma.voice_ai_agent_profile.findMany({
      where: { is_active: activeOnly },
      orderBy: { display_order: 'asc' },
    });
  }

  // List tenant's overrides
  async listTenantOverrides(tenantId: string) {
    return prisma.tenant_voice_ai_agent_profile_override.findMany({
      where: { tenant_id: tenantId },
      include: {
        agent_profile: true, // Include global profile details
      },
    });
  }

  // Create override
  async createOverride(tenantId: string, dto: CreateAgentProfileOverrideDto) {
    // Validate: global profile exists and is active
    // Validate: tenant hasn't exceeded plan limit
    // Create override record
  }

  // Update override (only custom fields: custom_greeting, custom_instructions)
  async updateOverride(overrideId: string, tenantId: string, dto: UpdateAgentProfileOverrideDto)

  // Delete override
  async deleteOverride(overrideId: string, tenantId: string)
}
```

### Plan Limit Enforcement
```typescript
async validatePlanLimit(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      subscription_plan: {
        select: {
          voice_ai_max_agent_profiles: true,
        },
      },
    },
  });

  const activeOverridesCount = await prisma.tenant_voice_ai_agent_profile_override.count({
    where: {
      tenant_id: tenantId,
      is_active: true,
    },
  });

  if (activeOverridesCount >= tenant.subscription_plan.voice_ai_max_agent_profiles) {
    throw new ForbiddenException(
      `Your plan allows a maximum of ${tenant.subscription_plan.voice_ai_max_agent_profiles} active voice agent profiles. Upgrade to add more.`
    );
  }
}
```

---

## Sprint 18: Context Builder + IVR Update

### Owner: Backend Specialist - Integration

### Goal
Update context resolution to merge global profiles with tenant overrides, and update IVR validation.

### Key Files
- **UPDATE**: `api/src/modules/voice-ai/services/voice-ai-context-builder.service.ts`
- **UPDATE**: `api/src/modules/communication/services/ivr-configuration.service.ts`

### Context Builder Changes

**Old Logic (3-step chain)**:
1. Try `agent_profile_id` from IVR → load tenant profile
2. Try `default_agent_profile_id` from settings → load tenant profile
3. Fall back to `enabled_languages` + `voice_id_override`

**New Logic (3-step chain with overrides)**:
1. Try `agent_profile_id` from IVR → load **global profile** + apply **tenant override**
2. Try `default_agent_profile_id` from settings → load **global profile** + apply **tenant override**
3. Fall back to `enabled_languages` + `voice_id_override`

```typescript
async buildContext(tenantId: string, callSid?: string, agentProfileId?: string) {
  // ... existing logic ...

  let resolvedProfile: {
    language: string;
    voice_id: string;
    greeting?: string;
    instructions?: string;
  } | null = null;

  // Step 1: Try explicit agent_profile_id from IVR
  if (agentProfileId) {
    const globalProfile = await prisma.voice_ai_agent_profile.findFirst({
      where: {
        id: agentProfileId,
        is_active: true,
      },
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

      context.active_agent_profile = {
        id: globalProfile.id,
        title: globalProfile.display_name,
        language_code: globalProfile.language_code,
        is_override: !!override,
      };
    }
  }

  // Step 2: Try default_agent_profile_id from settings
  if (!resolvedProfile && tenantSettings?.default_agent_profile_id) {
    const override = await prisma.tenant_voice_ai_agent_profile_override.findFirst({
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

  // Step 3: Fallback to existing behavior
  if (!resolvedProfile) {
    resolvedProfile = {
      language: enabledLanguages[0] ?? globalConfig.default_language ?? 'en',
      voice_id: tenantSettings?.voice_id_override ?? globalConfig.default_voice_id ?? null,
    };
  }

  context.behavior.language = resolvedProfile.language;
  context.providers.tts.voice_id = resolvedProfile.voice_id;

  if (resolvedProfile.greeting) {
    context.behavior.greeting = resolvedProfile.greeting.replace('{business_name}', tenant.company_name);
  }

  if (resolvedProfile.instructions) {
    context.llm.system_prompt = `${globalConfig.default_system_prompt}\n\n${resolvedProfile.instructions}`;
  }

  return context;
}
```

### IVR Validation Update

**Old**: Validate `agent_profile_id` against tenant profiles
**New**: Validate `agent_profile_id` against **global profiles**

```typescript
// In ivr-configuration.service.ts → createOrUpdate()

// Collect all agent_profile_id values from menu_options and default_action
const profileIds = [];

menuOptions.forEach((option) => {
  if (option.action === 'voice_ai' && option.config?.agent_profile_id) {
    profileIds.push(option.config.agent_profile_id);
  }
});

if (defaultAction?.action === 'voice_ai' && defaultAction.config?.agent_profile_id) {
  profileIds.push(defaultAction.config.agent_profile_id);
}

// Validate: All profile IDs must reference GLOBAL profiles (not tenant overrides)
if (profileIds.length > 0) {
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
      `Invalid voice agent profile ID(s): ${missingIds.join(', ')}. Profile must be a valid active global profile.`
    );
  }
}
```

---

## Sprint 19: API Documentation

### Owner: Documentation Specialist

### Goal
Update all API documentation to reflect new endpoints and architecture.

### Files to Update
- `api/documentation/voice_agent_profiles_REST_API.md` (complete rewrite)
- `api/documentation/voice_ai_multilingual_REST_API.md` (update)

### New Documentation Structure

```markdown
# Voice AI Agent Profiles API

## Architecture Overview

Voice agent profiles follow a **global template with tenant customization** pattern:
- **Global Profiles**: System admin creates language/voice templates (English, Portuguese, Spanish)
- **Tenant Overrides**: Tenants select profiles and optionally customize greetings/instructions
- **IVR Integration**: IVR references global profile IDs, context builder applies tenant overrides at runtime

## System Admin Endpoints

### Create Global Profile
**POST** `/api/v1/system/voice-ai/agent-profiles`

**Guards**: JwtAuthGuard + PlatformAdminGuard (system admin only)

**Request Body**:
```json
{
  "language_code": "en",
  "language_name": "English",
  "voice_id": "cartesia-uuid-here",
  "display_name": "English - Professional",
  "description": "Professional English voice for business calls",
  "default_greeting": "Hello, thank you for calling {business_name}!",
  "default_instructions": "You are a professional assistant...",
  "is_active": true,
  "display_order": 1
}
```

[... full endpoint documentation ...]

## Tenant Endpoints

### List Available Global Profiles
**GET** `/api/v1/voice-ai/agent-profiles?active_only=true`

**Guards**: JwtAuthGuard

**Response**: Array of global profiles (read-only)

[... full endpoint documentation ...]

### Create Tenant Override
**POST** `/api/v1/voice-ai/agent-profile-overrides`

**Guards**: JwtAuthGuard + RolesGuard (Owner, Admin)

**Request Body**:
```json
{
  "agent_profile_id": "00000000-0000-0000-0000-000000000001",
  "custom_greeting": "Welcome to our business!",
  "custom_instructions": "Be extra friendly to our customers.",
  "is_active": true
}
```

[... full endpoint documentation ...]
```

---

## Sprint 20: Admin UI (Global Profiles)

### Owner: Frontend Specialist - Admin Portal

### Goal
Create admin portal for managing global voice agent profiles.

### New Pages
```
app/src/app/(dashboard)/admin/voice-ai/agent-profiles/
├── page.tsx                     (List all global profiles)
├── new/
│   └── page.tsx                 (Create new global profile)
└── [id]/
    ├── page.tsx                 (View global profile details)
    └── edit/
        └── page.tsx             (Edit global profile)
```

### Components
```
app/src/components/voice-ai/admin/
├── GlobalProfilesList.tsx       (Table of global profiles)
├── GlobalProfileForm.tsx        (Create/Edit form)
└── GlobalProfileCard.tsx        (Profile display card)
```

### API Integration
```typescript
// app/src/lib/api/voice-ai-admin.ts
export const voiceAiAdminApi = {
  globalProfiles: {
    list: (activeOnly = false) =>
      axios.get(`/system/voice-ai/agent-profiles?active_only=${activeOnly}`),

    create: (data: CreateGlobalProfileDto) =>
      axios.post('/system/voice-ai/agent-profiles', data),

    update: (id: string, data: UpdateGlobalProfileDto) =>
      axios.patch(`/system/voice-ai/agent-profiles/${id}`, data),

    delete: (id: string) =>
      axios.delete(`/system/voice-ai/agent-profiles/${id}`),
  },
};
```

### UI Requirements
- Table with columns: Language, Display Name, Voice ID, Active Status, Actions
- Create/Edit form with validation
- Voice ID autocomplete (fetch from TTS provider API if available)
- Preview greeting/instructions
- Soft delete confirmation modal
- Success/error toasts

---

## Sprint 21: Tenant UI + IVR Builder

### Owner: Frontend Specialist - Tenant Portal

### Goal
Update tenant UI to show available profiles and allow customization. Update IVR builder to select global profiles.

### Updated Pages
```
app/src/app/(dashboard)/voice-ai/agent-profiles/
├── page.tsx                     (List available + overrides)
├── [id]/
│   └── customize/
│       └── page.tsx             (Create/Edit override)
```

### IVR Builder Update
```
app/src/components/communication/ivr/
└── IvrActionConfig.tsx          (Update voice_ai action selector)
```

### UI Flow

**Agent Profiles Page**:
1. Show "Available Profiles" (global profiles, read-only)
   - Card layout with language, display name, description
   - "Customize" button → creates override
2. Show "My Customized Profiles" (tenant overrides)
   - Card layout with override details
   - "Edit" / "Deactivate" / "Delete" buttons

**Customize Profile Modal**:
```typescript
interface CustomizeProfileForm {
  agent_profile_id: string;           // Hidden (selected from available)
  custom_greeting?: string;            // Optional override
  custom_instructions?: string;        // Optional override
  is_active: boolean;                  // Activate/deactivate
}
```

**IVR Builder Update**:
- **OLD**: "Create New Profile" button in IVR action config
- **NEW**: "Select Profile" dropdown showing global profiles
  - Fetch: `GET /api/v1/voice-ai/agent-profiles?active_only=true`
  - Display: `${language_name} - ${display_name}`
  - Value: `id` (global profile UUID)

---

## Testing Strategy

### Unit Tests (Each Sprint)
- Controller endpoint tests
- Service method tests
- DTO validation tests

### Integration Tests
- E2E flow: Admin creates profile → Tenant creates override → IVR uses → Call resolves context
- Multi-tenant isolation (tenant A cannot see tenant B's overrides)
- Plan limit enforcement

### Manual Testing Checklist
- [ ] Admin can create/edit/delete global profiles
- [ ] Tenant can see available profiles (read-only)
- [ ] Tenant can create overrides (within plan limit)
- [ ] Tenant cannot exceed plan limit (403 error)
- [ ] IVR builder shows global profiles
- [ ] Call context resolves correctly (global + override merged)
- [ ] Deactivating global profile doesn't break existing IVR configs

---

## Rollback Plan

If any sprint fails critically:

1. **Database Rollback** (Sprints 14-15 only):
   ```bash
   # Restore from backup
   mysql -u lead360_user -p lead360_production < /var/backups/mysql/backup_before_migration.sql

   # Revert Prisma schema
   git checkout HEAD~1 -- api/prisma/schema.prisma
   npx prisma generate
   ```

2. **Code Rollback** (Sprints 16-21):
   ```bash
   # Revert commits
   git revert <commit-hash>

   # Redeploy
   npm run build
   pm2 restart all
   ```

---

## Success Criteria (All Sprints)

### Backend Complete When:
- [ ] Global profiles table exists with 3+ profiles
- [ ] Tenant override table exists with FK to global profiles
- [ ] Admin CRUD endpoints working
- [ ] Tenant override endpoints working
- [ ] Context builder merges global + override correctly
- [ ] IVR validates against global profile IDs
- [ ] All tests passing (>80% coverage)

### Frontend Complete When:
- [ ] Admin UI manages global profiles
- [ ] Tenant UI shows available profiles + overrides
- [ ] IVR builder selects global profiles
- [ ] All forms validate correctly
- [ ] Error handling works (modals for errors)
- [ ] Mobile responsive

---

## Contact & Support

**Product Owner**: Ludson
**Architecture Questions**: Escalate to product owner
**Implementation Issues**: Document in sprint completion report

---

**Guide Version**: 1.0
**Last Updated**: March 4, 2026
**Status**: Active - Sprints 13-15 detailed, 16-21 summarized
