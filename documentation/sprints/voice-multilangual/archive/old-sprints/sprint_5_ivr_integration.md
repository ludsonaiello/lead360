# Sprint 5: IVR Integration - Agent Profile Selection

## 🎯 Sprint Owner Role

You are a **MASTERCLASS IVR INTEGRATION SPECIALIST** that makes Google, Amazon, and Apple telephony engineers jealous.

You integrate voice routing systems with **precision** and **safety**. You **think deeply** about call flows, **breathe validation logic**, and **never rush** through changes that affect live customer calls. You **always verify** existing IVR patterns and **never guess** JSON validation rules.

**100% quality or beyond**. IVR handles real customer calls - mistakes here affect business operations.

---

## 📋 Sprint Objective

Extend IVR configuration to support agent profile selection:
1. Add optional `agent_profile_id` to IVR config DTOs
2. Validate profile ownership when saving IVR config
3. Pass profile ID to VoiceAiSipService when executing voice_ai action
4. Maintain backward compatibility (configs without profile ID still work)

**Dependencies**: Sprint 3 complete (profile API must exist)

---

## 📚 Required Reading

1. **Contract**: `/var/www/lead360.app/documentation/contracts/voice-multilangual-contract.md` - Section 6
2. **IVR DTO**: `/var/www/lead360.app/api/src/modules/communication/dto/ivr/create-ivr-config.dto.ts`
3. **IVR Service**: `/var/www/lead360.app/api/src/modules/communication/services/ivr-configuration.service.ts`
4. **IVR Exploration Report**: Review findings from plan mode (menu options structure, validation patterns)

---

## 🔐 Test Environment

**Database**: `mysql://lead360_user:978@F32c@127.0.0.1:3306/lead360`
**Tenant User**: `contact@honeydo4you.com` / `978@F32c`
**Server**: `npm run start:dev`

---

## 📐 Implementation

### Change 1: Extend IVR DTO Config Type

**File**: `/var/www/lead360.app/api/src/modules/communication/dto/ivr/create-ivr-config.dto.ts`

Find the `IvrMenuOptionDto` class and extend the `config` field type documentation:

```typescript
// Around line 96-167, update the config field:
export class IvrMenuOptionDto {
  // ... existing fields

  @ApiProperty({
    description:
      'Action-specific configuration. ' +
      'For route_to_number/route_to_default: requires phone_number (E.164). ' +
      'For trigger_webhook: requires webhook_url (HTTPS). ' +
      'For voicemail: optional max_duration_seconds (30-600). ' +
      'For voice_ai: optional agent_profile_id (UUID) to select specific language/voice profile.',
    example: {
      phone_number: '+15551234567',
      agent_profile_id: 'uuid-of-profile', // NEW
    },
    required: false,
  })
  @IsOptional()
  config?: {
    phone_number?: string;
    webhook_url?: string;
    max_duration_seconds?: number;
    agent_profile_id?: string; // NEW FIELD
  };

  // ... rest of class
}
```

**Do the same for `IvrDefaultActionDto`** (around line 174-197).

**Note**: No validation decorator needed yet - validation happens in service layer.

---

### Change 2: Validate agent_profile_id in validateAction()

**File**: `/var/www/lead360.app/api/src/modules/communication/services/ivr-configuration.service.ts`

Find the `validateActionConfig()` method (around line 1058-1151) and add validation for voice_ai action:

```typescript
private validateActionConfig(
  action: IvrActionType,
  config: any,
  position?: string,
): void {
  const errorPrefix = position ? `${position}: ` : '';

  switch (action) {
    // ... existing cases

    case 'voice_ai':
      // NEW: Validate agent_profile_id if provided
      if (config?.agent_profile_id !== undefined) {
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        if (
          typeof config.agent_profile_id !== 'string' ||
          !uuidRegex.test(config.agent_profile_id)
        ) {
          throw new BadRequestException(
            `${errorPrefix}voice_ai action: agent_profile_id must be a valid UUID`,
          );
        }
      }
      // No other config required for voice_ai
      break;

    // ... rest of cases
  }
}
```

---

### Change 3: Validate Profile Ownership in createOrUpdate()

**File**: `/var/www/lead360.app/api/src/modules/communication/services/ivr-configuration.service.ts`

Find the `createOrUpdate()` method (around line 100-200) and add profile ownership validation AFTER menu options validation:

```typescript
async createOrUpdate(tenantId: string, dto: CreateIvrConfigDto) {
  // ... existing validation code

  // NEW: Validate agent_profile_id references (after menu options validation)
  await this.validateAgentProfileReferences(tenantId, dto);

  // ... rest of method (upsert logic)
}

// NEW METHOD: Add this private method
private async validateAgentProfileReferences(
  tenantId: string,
  dto: CreateIvrConfigDto,
): Promise<void> {
  // Collect all agent_profile_id values from menu_options and default_action
  const profileIds: string[] = [];

  // Check menu_options
  this.collectProfileIds(dto.menu_options, profileIds);

  // Check default_action
  if (dto.default_action?.config?.agent_profile_id) {
    profileIds.push(dto.default_action.config.agent_profile_id);
  }

  // Remove duplicates
  const uniqueProfileIds = [...new Set(profileIds)];

  // Validate each profile belongs to tenant and is active
  for (const profileId of uniqueProfileIds) {
    const profile = await this.prisma.tenant_voice_agent_profile.findFirst({
      where: {
        id: profileId,
        tenant_id: tenantId,
        is_active: true,
      },
    });

    if (!profile) {
      throw new BadRequestException(
        `Voice agent profile ${profileId} not found or not active for this tenant`,
      );
    }
  }
}

// NEW METHOD: Recursive helper to collect profile IDs from menu tree
private collectProfileIds(menuOptions: any[], profileIds: string[]): void {
  if (!Array.isArray(menuOptions)) return;

  for (const option of menuOptions) {
    // Check this option's config
    if (option.action === 'voice_ai' && option.config?.agent_profile_id) {
      profileIds.push(option.config.agent_profile_id);
    }

    // Recursively check submenu
    if (option.submenu?.options) {
      this.collectProfileIds(option.submenu.options, profileIds);
    }
  }
}
```

**CRITICAL**: This validation ensures:
- Profile exists
- Profile belongs to THIS tenant (no cross-tenant access)
- Profile is active (inactive profiles cannot be selected in NEW configs)

---

### Change 4: Pass Profile ID in executeVoiceAiAction()

**File**: `/var/www/lead360.app/api/src/modules/communication/services/ivr-configuration.service.ts`

Find the `executeVoiceAiAction()` method (around line 502-588) and extract `agent_profile_id` from config:

```typescript
private async executeVoiceAiAction(
  tenantId: string,
  callSid: string,
  selectedOption: IvrMenuOptionDto | IvrDefaultActionDto,
  toNumber?: string,
): Promise<string> {
  // NEW: Extract agent_profile_id from config
  const agentProfileId = selectedOption.config?.agent_profile_id;

  // Check if tenant can use voice AI
  const canHandle = await this.voiceAiSipService.canHandleCall(tenantId);

  if (!canHandle.allowed) {
    // ... existing fallback logic
  }

  // Build SIP TwiML with optional agent profile ID
  return this.voiceAiSipService.buildSipTwiml(
    tenantId,
    callSid,
    toNumber,
    agentProfileId, // NEW PARAMETER
  );
}
```

**Note**: We'll update `buildSipTwiml()` signature in Sprint 6. For now, this will cause a TypeScript error - that's expected and will be fixed in the next sprint.

---

## ✅ Acceptance Criteria

### DTO Changes
- ✅ IvrMenuOptionDto.config accepts optional `agent_profile_id` (string)
- ✅ IvrDefaultActionDto.config accepts optional `agent_profile_id` (string)
- ✅ Swagger docs updated with examples

### Validation
- ✅ validateActionConfig() checks UUID format for agent_profile_id
- ✅ createOrUpdate() validates profile exists for tenant
- ✅ createOrUpdate() validates profile is active
- ✅ Validation fails (400) with foreign tenant's profile ID
- ✅ Validation fails (400) with inactive profile ID
- ✅ Backward compatible (no agent_profile_id works fine)

### Integration
- ✅ executeVoiceAiAction() extracts agent_profile_id from config
- ✅ Profile ID passed to buildSipTwiml() (will fix signature in Sprint 6)

### Testing
```bash
# Get auth token
TOKEN=$(curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' \
  | jq -r '.access_token')

# Create profile first
PROFILE=$(curl -X POST http://localhost:8000/api/v1/voice-ai/agent-profiles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Agent",
    "language_code": "en",
    "voice_id": "test-voice"
  }')

PROFILE_ID=$(echo $PROFILE | jq -r '.id')

# Create IVR config with agent_profile_id
curl -X POST http://localhost:8000/api/v1/communication/twilio/ivr \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ivr_enabled": true,
    "greeting_message": "Welcome!",
    "menu_options": [
      {
        "digit": "1",
        "action": "voice_ai",
        "label": "AI Agent",
        "config": {
          "agent_profile_id": "'"$PROFILE_ID"'"
        }
      }
    ],
    "default_action": {
      "action": "route_to_default",
      "config": {
        "phone_number": "+15551234567"
      }
    }
  }'

# Test validation - should fail (wrong tenant or inactive profile)
curl -X POST http://localhost:8000/api/v1/communication/twilio/ivr \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ivr_enabled": true,
    "greeting_message": "Test",
    "menu_options": [
      {
        "digit": "1",
        "action": "voice_ai",
        "label": "Test",
        "config": {
          "agent_profile_id": "invalid-uuid-123"
        }
      }
    ]
  }'
# Should return 400
```

---

## 📊 Sprint Completion Report

```markdown
## Sprint 5 Completion: IVR Integration

**Status**: ✅ Complete

### Changes Made
- ✅ create-ivr-config.dto.ts (added agent_profile_id to config type)
- ✅ ivr-configuration.service.ts (validation + profile ownership check)
- ✅ executeVoiceAiAction() extracts and passes profile ID

### Validation Implemented
- ✅ UUID format validation
- ✅ Profile ownership validation (tenant + active)
- ✅ Recursive menu tree validation

### Testing
- ✅ IVR saves with valid profile ID
- ✅ IVR rejects invalid UUID (400)
- ✅ IVR rejects foreign tenant profile (400)
- ✅ IVR rejects inactive profile (400)
- ✅ Backward compatible (no profile ID works)

**Known Issue**: TypeScript error in executeVoiceAiAction() - will be fixed in Sprint 6 when buildSipTwiml() signature is updated.

**Sprint Owner**: [Name]
**Date**: [Date]
```

🚀 **Connect IVR to agent profiles!**
