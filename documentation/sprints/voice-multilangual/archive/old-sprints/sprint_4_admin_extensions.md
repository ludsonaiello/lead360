# Sprint 4: Admin API Extensions

## 🎯 Sprint Owner Role

You are a **MASTERCLASS PLATFORM ADMINISTRATOR DEVELOPER** that makes Google, Amazon, and Apple platform engineers jealous.

You build admin APIs that control platform-wide configuration with **precision** and **safety**. You **think deeply** about system-wide impact, **breathe validation logic**, and **never rush** through changes that affect multiple tenants. You **always review** existing admin patterns and **never guess** validation rules or field types.

**100% quality or beyond**. Admin APIs can affect every tenant - mistakes here are catastrophic.

---

## 📋 Sprint Objective

Extend existing admin endpoints to support voice agent profile configuration:
1. Add `voice_ai_max_agent_profiles` to plan config DTO/service
2. Add `default_agent_profile_id` to admin override DTO/service
3. Add validation for profile ownership
4. Test admin operations

**Dependencies**: Sprint 3 complete (profile CRUD must exist)

---

## 📚 Required Reading

1. **Contract**: `/var/www/lead360.app/documentation/contracts/voice-multilangual-contract.md` - Section 8
2. **Existing Admin DTOs**:
   - `/var/www/lead360.app/api/src/modules/voice-ai/dto/update-plan-voice-config.dto.ts`
   - `/var/www/lead360.app/api/src/modules/voice-ai/dto/admin-override-tenant-voice.dto.ts`
3. **Existing Admin Services**:
   - `/var/www/lead360.app/api/src/modules/voice-ai/services/voice-ai-plan-config.service.ts`
   - `/var/www/lead360.app/api/src/modules/voice-ai/services/voice-ai-settings.service.ts`

---

## 🔐 Test Environment

**Database**: `mysql://lead360_user:978@F32c@127.0.0.1:3306/lead360`
**Admin**: `ludsonaiello@gmail.com` / `978@F32c`
**Server**: `npm run start:dev`

---

## 📐 Implementation

### Change 1: Update Plan Config DTO

**File**: `/var/www/lead360.app/api/src/modules/voice-ai/dto/update-plan-voice-config.dto.ts`

```typescript
// Add this field to the existing DTO
@ApiProperty({
  description: 'Maximum number of voice agent profiles allowed for this plan',
  example: 3,
  required: false,
  minimum: 1,
  maximum: 50,
})
@IsOptional()
@IsInt()
@Min(1)
@Max(50)
voice_ai_max_agent_profiles?: number;
```

**Change 2: Update Plan Config Service**

**File**: `/var/www/lead360.app/api/src/modules/voice-ai/services/voice-ai-plan-config.service.ts`

Find the `updatePlanVoiceConfig()` method and add handling for new field:

```typescript
// Inside updatePlanVoiceConfig method, add to updateData object:
if (dto.voice_ai_max_agent_profiles !== undefined) {
  updateData.voice_ai_max_agent_profiles = dto.voice_ai_max_agent_profiles;
}
```

Also update the `PlanWithVoiceConfig` interface to include the new field:

```typescript
interface PlanWithVoiceConfig {
  // ... existing fields
  voice_ai_max_agent_profiles: number;
}
```

---

### Change 3: Update Admin Override DTO

**File**: `/var/www/lead360.app/api/src/modules/voice-ai/dto/admin-override-tenant-voice.dto.ts`

```typescript
// Add this field to the existing DTO
@ApiProperty({
  description:
    'Default voice agent profile ID for this tenant. Used when IVR voice_ai action has no profile specified.',
  example: 'uuid-here',
  required: false,
})
@IsOptional()
@IsUUID('4')
default_agent_profile_id?: string | null;
```

**Change 4: Update Admin Override Service**

**File**: `/var/www/lead360.app/api/src/modules/voice-ai/services/voice-ai-settings.service.ts`

Find the `adminOverride()` method and add validation + handling:

```typescript
async adminOverride(tenantId: string, dto: AdminOverrideTenantVoiceDto) {
  // ... existing code

  // NEW: Validate profile ownership if default_agent_profile_id is being set
  if (dto.default_agent_profile_id !== undefined && dto.default_agent_profile_id !== null) {
    const profile = await this.prisma.tenant_voice_agent_profile.findFirst({
      where: {
        id: dto.default_agent_profile_id,
        tenant_id: tenantId, // CRITICAL: Verify belongs to this tenant
      },
    });

    if (!profile) {
      throw new BadRequestException(
        `Voice agent profile with ID "${dto.default_agent_profile_id}" not found for this tenant`,
      );
    }
  }

  // Build updateData object - add new field
  const updateData: any = {};
  // ... existing field assignments

  if (dto.default_agent_profile_id !== undefined) {
    updateData.default_agent_profile_id = dto.default_agent_profile_id;
  }

  // ... rest of method
}
```

**CRITICAL**: Verify profile belongs to target tenant before allowing admin to set it.

---

## ✅ Acceptance Criteria

### Plan Config
- ✅ UpdatePlanVoiceConfigDto accepts `voice_ai_max_agent_profiles`
- ✅ Validation: Min 1, Max 50, integer
- ✅ Service updates subscription_plan table
- ✅ PlanWithVoiceConfig interface includes new field
- ✅ Swagger docs updated

### Admin Override
- ✅ AdminOverrideTenantVoiceDto accepts `default_agent_profile_id`
- ✅ Validation: UUID format, can be null
- ✅ Service validates profile belongs to target tenant (400 if not)
- ✅ Service updates tenant_voice_ai_settings table
- ✅ Swagger docs updated

### Testing
```bash
# Test plan config update
curl -X PATCH http://localhost:8000/api/v1/system/voice-ai/plans/<PLAN_ID> \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"voice_ai_max_agent_profiles": 5}'

# Test admin override
curl -X PATCH http://localhost:8000/api/v1/system/voice-ai/tenants/<TENANT_ID>/override \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"default_agent_profile_id": "<PROFILE_ID>"}'

# Test validation (should fail with 400)
curl -X PATCH http://localhost:8000/api/v1/system/voice-ai/tenants/<TENANT_ID>/override \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"default_agent_profile_id": "wrong-tenant-profile-id"}'
```

---

## 📊 Sprint Completion Report

```markdown
## Sprint 4 Completion: Admin Extensions

**Status**: ✅ Complete

### Changes Made
- ✅ update-plan-voice-config.dto.ts (added voice_ai_max_agent_profiles)
- ✅ voice-ai-plan-config.service.ts (handles new field)
- ✅ admin-override-tenant-voice.dto.ts (added default_agent_profile_id)
- ✅ voice-ai-settings.service.ts (validates + handles new field)

### Testing
- ✅ Plan config accepts new field
- ✅ Admin override accepts new field
- ✅ Validation rejects foreign tenant profile
- ✅ Swagger docs updated

**Sprint Owner**: [Name]
**Date**: [Date]
```

🚀 **Extend admin APIs safely!**
