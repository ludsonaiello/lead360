# Archived Sprints: Voice Multilingual (Sprints 1-12)

**Archive Date**: March 4, 2026
**Reason**: Architectural flaw identified - requires complete refactor
**Status**: DO NOT IMPLEMENT - Reference only

---

## Why These Sprints Were Archived

The original voice multilingual implementation (Sprints 1-12) contained a **critical architectural flaw**:

### ❌ Original Design (INCORRECT - Archived)

```
tenant_voice_agent_profile (tenant-scoped)
├─ Tenants create their own profiles with full control
├─ Tenants define: id, language, voice_id, prompts, greetings
├─ Plan limit: max profiles tenant can CREATE
└─ Result: Every tenant recreates similar profiles, no centralized control
```

**Problems**:
1. No centralized language/voice management
2. Tenants need technical knowledge (TTS voice IDs)
3. Updates require manual per-tenant changes
4. Plan limits don't make business sense
5. Inefficient duplication across tenants

### ✅ Correct Design (Implemented in Sprints 13-21)

```
voice_ai_agent_profile (GLOBAL, admin-managed)
├─ System admin creates profile templates
├─ Defines: language, voice_id, default prompts
├─ Available to ALL tenants (read-only)
└─ Examples: "English - Professional", "Portuguese - Friendly"

tenant_voice_ai_agent_profile_override (tenant customizations)
├─ References global profile (FK)
├─ Tenant can: override instructions/prompts, activate/deactivate
├─ Plan limit: max profiles tenant can ACTIVATE
└─ IVR references global profile ID + applies tenant overrides
```

**Benefits**:
1. ✅ Centralized management (admin updates once, affects all tenants)
2. ✅ Better UX (tenants select from curated list)
3. ✅ Tenant customization still possible
4. ✅ Plan limits make business sense
5. ✅ Easy to add new languages

---

## Architectural Pattern Alignment

The correct design follows the established Lead360 pattern for global resources:

**Similar to `voice_ai_provider` pattern**:
- Global table (no `tenant_id`)
- System admin manages
- Tenants reference via FK but cannot modify
- Tenant-level overrides possible

This matches:
- `voice_ai_global_config` (singleton pattern)
- `voice_ai_provider` (global list pattern)
- Admin override pattern (global → tenant → override)

---

## Files in This Archive

### Original Sprint Files (DO NOT IMPLEMENT)
- `sprint_01_database_foundation.md` - Created tenant-scoped table (incorrect)
- `sprint_02_core_service_dtos.md` - Tenant CRUD service (needs refactor)
- `sprint_03_tenant_crud_controller.md` - Tenant creation endpoints (incorrect pattern)
- `sprint_04_admin_extensions.md` - Admin extensions (needs update)
- `sprint_05_ivr_integration.md` - IVR integration (validation needs update)
- `sprint_06_sip_service_twiml.md` - SIP TwiML (correct, no changes needed)
- `sprint_07_context_builder.md` - Context resolution (needs refactor for overrides)
- `sprint_08_internal_endpoint.md` - Internal endpoint (correct, minor updates)
- `sprint_09_api_documentation_testing.md` - Docs for old endpoints (needs complete rewrite)
- `sprint_10_frontend_profile_crud.md` - Frontend for tenant creation (incorrect UX)
- `sprint_11_frontend_ivr_extension.md` - IVR builder (needs update)
- `sprint_12_frontend_admin_ui.md` - Admin UI (completely different requirements)

### Completion Reports (Historical Reference)
- `sprint_1_completion_report.md` - Sprint 1 completion (archived implementation)
- `SPRINT_9_COMPLETION_REPORT.md` - Sprint 9 completion (archived implementation)
- `SPRINT_9_FINAL_REVIEW.md` - Sprint 9 review (archived implementation)

### Migration Plan (Historical)
- `MIGRATION_SPRINTS_13-21_SUMMARY.md` - Original migration plan (outdated)

---

## What Was Actually Implemented

Based on git status, the following was partially implemented from these sprints:

### Database (Implemented - Needs Migration)
- ✅ `tenant_voice_agent_profile` table created
- ✅ `subscription_plan.voice_ai_max_agent_profiles` added
- ✅ `tenant_voice_ai_settings.default_agent_profile_id` added
- ⚠️ Migration: `20260304_add_multi_language_voice_agent_profiles`

### Backend API (Implemented - Needs Refactor)
- ✅ `/api/v1/voice-ai/agent-profiles` endpoints (tenant CRUD)
- ✅ `VoiceAgentProfilesService` (tenant-scoped)
- ✅ `VoiceAgentProfilesController` (tenant controller)
- ✅ DTOs: `CreateVoiceAgentProfileDto`, `UpdateVoiceAgentProfileDto`
- ⚠️ All need refactoring to global/override pattern

### Backend Integration (Implemented - Needs Updates)
- ✅ IVR `agent_profile_id` support
- ✅ Context builder profile resolution (3-step chain)
- ✅ SIP TwiML `X-Agent-Profile-Id` header
- ⚠️ Validation needs update (global profile IDs)

### Frontend (Planned - Not Implemented)
- ❌ Profile management UI (never built - good, would be wrong)
- ❌ IVR builder extension (never built)
- ❌ Admin UI extensions (never built)

### Documentation (Implemented - Needs Complete Rewrite)
- ✅ `api/documentation/voice_agent_profiles_REST_API.md`
- ✅ `api/documentation/voice_ai_multilingual_REST_API.md`
- ⚠️ Documents incorrect tenant-scoped endpoints

---

## Current State of Codebase

**What exists in production**:
```
api/prisma/schema.prisma
├─ tenant_voice_agent_profile (tenant-scoped) ← NEEDS RENAME + FK
├─ subscription_plan.voice_ai_max_agent_profiles ← NEEDS SEMANTIC UPDATE
└─ tenant_voice_ai_settings.default_agent_profile_id ← OK

api/src/modules/voice-ai/
├─ controllers/tenant/voice-agent-profiles.controller.ts ← NEEDS REFACTOR
├─ services/voice-agent-profiles.service.ts ← NEEDS SPLIT
├─ dto/create-voice-agent-profile.dto.ts ← NEEDS SPLIT
└─ dto/update-voice-agent-profile.dto.ts ← NEEDS SPLIT

app/src/app/(dashboard)/voice-ai/agent-profiles/
└─ (not implemented yet)
```

---

## Migration Path (Sprints 13-21)

**New sprints implement the correct architecture**:

| Sprint | Focus | Status |
|--------|-------|--------|
| 13 | Archive old sprints + data review | Pending |
| 14 | Schema: Create global table + rename tenant table | Pending |
| 15 | Data migration: Existing profiles → global + overrides | Pending |
| 16 | Backend: Admin controller (global profiles CRUD) | Pending |
| 17 | Backend: Tenant override controller (refactor) | Pending |
| 18 | Backend: Context builder + IVR update | Pending |
| 19 | Backend: API documentation rewrite | Pending |
| 20 | Frontend: Admin UI (global profile management) | Pending |
| 21 | Frontend: Tenant UI (selection/override) + IVR | Pending |

---

## Key Lessons Learned

1. **Always validate architecture against existing patterns** before implementation
2. **Global resources should be admin-managed**, tenants should select/customize
3. **Plan limits should control usage**, not creation of definitions
4. **Multi-tenant doesn't mean everything is tenant-scoped** - some resources are shared

---

## References

- **Feature Contract**: `/documentation/contracts/voice-multilangual-contract.md` (original spec)
- **Corrected Plan**: `/root/.claude/plans/nested-wishing-allen.md`
- **New Sprint Files**: `/documentation/sprints/voice-multilangual/sprint_13_*.md` through `sprint_21_*.md`
- **Implementation Guide**: `/documentation/sprints/voice-multilangual/IMPLEMENTATION_GUIDE.md`

---

**⚠️ IMPORTANT**: Do NOT implement anything from these archived sprints. They document an incorrect architecture and are preserved only for historical reference and learning purposes.

**Use Sprints 13-21 instead** for the correct implementation.

---

**Archived by**: System AI (Claude Code)
**Date**: March 4, 2026
**Reason**: Architectural flaw - complete refactor required
