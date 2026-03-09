# Sprint 8: Internal Endpoint - Agent Profile Parameter

## 🎯 Sprint Owner Role

You are a **MASTERCLASS INTERNAL API SPECIALIST** that makes Google, Amazon, and Apple internal API engineers jealous.

You build internal APIs that are **secure**, **efficient**, and **backward compatible**. You **think deeply** about authentication, **breathe parameter validation**, and **never rush** through changes that affect external integrations. You **always verify** guard patterns and **never guess** query parameter types.

**100% quality or beyond**. Internal APIs are called by agent workers - mistakes here break live AI calls.

---

## 📋 Sprint Objective

Update internal context endpoint to accept agent profile ID:
1. Add optional `agent_profile_id` query parameter to internal context endpoint
2. Forward parameter to VoiceAiContextBuilderService
3. Maintain backward compatibility (parameter optional)
4. Test with agent worker simulation

**Dependencies**: Sprint 7 complete (context builder accepts agentProfileId)

---

## 📚 Required Reading

1. **Contract**: `/var/www/lead360.app/documentation/contracts/voice-multilangual-contract.md` - Section 10
2. **Internal Controller**: `/var/www/lead360.app/api/src/modules/voice-ai/controllers/internal/voice-ai-internal.controller.ts`
3. **Context Builder Service**: From Sprint 7

---

## 🔐 Test Environment

**Server**: `npm run start:dev`
**Auth**: VoiceAgentKeyGuard (special internal key, not JWT)

---

## 📐 Implementation

### Update Internal Context Endpoint

**File**: `/var/www/lead360.app/api/src/modules/voice-ai/controllers/internal/voice-ai-internal.controller.ts`

Find the context endpoint (likely `GET /context` or similar) and add query parameter:

```typescript
import { Controller, Get, Query, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { VoiceAgentKeyGuard } from '../../guards/voice-agent-key.guard';
import { VoiceAiContextBuilderService } from '../../services/voice-ai-context-builder.service';

@ApiTags('Voice AI - Internal (Agent Worker)')
@Controller('voice-ai/internal')
@UseGuards(VoiceAgentKeyGuard) // Special guard for agent worker
export class VoiceAiInternalController {
  constructor(
    private readonly contextBuilderService: VoiceAiContextBuilderService,
  ) {}

  @Get('context/:tenantId')
  @ApiOperation({
    summary: 'Get VoiceAI context for agent worker (internal)',
    description:
      'Called by Python agent worker to get tenant context. ' +
      'Requires X-Agent-Key header for authentication.',
  })
  @ApiQuery({
    name: 'call_sid',
    required: false,
    description: 'Twilio call SID',
    example: 'CA1234567890abcdef',
  })
  @ApiQuery({
    name: 'agent_profile_id',
    required: false,
    description:
      'Voice agent profile ID for language/voice selection. ' +
      'Extracted from X-Agent-Profile-Id SIP header by agent worker.',
    example: 'uuid-of-profile',
  })
  async getContext(
    @Param('tenantId') tenantId: string,
    @Query('call_sid') callSid?: string,
    @Query('agent_profile_id') agentProfileId?: string, // NEW PARAMETER
  ) {
    return this.contextBuilderService.buildContext(
      tenantId,
      callSid,
      agentProfileId, // NEW - forwarded to context builder
    );
  }
}
```

**Key Changes**:
- ✅ Added `agent_profile_id` query parameter (optional)
- ✅ Parameter forwarded to `buildContext()`
- ✅ Swagger documentation updated
- ✅ Backward compatible (parameter optional)

---

## ✅ Acceptance Criteria

### Endpoint Implementation
- ✅ Accepts optional `agent_profile_id` query parameter
- ✅ Parameter forwarded to context builder service
- ✅ Swagger docs updated
- ✅ Backward compatible (works without parameter)

### Testing

**Manual Test - Without Profile ID** (backward compatible):
```bash
# Get internal agent key from env or code
AGENT_KEY="your-internal-agent-key"

curl -X GET "http://localhost:8000/api/v1/voice-ai/internal/context/TENANT_ID?call_sid=CA123" \
  -H "X-Agent-Key: $AGENT_KEY"

# Should return context with existing fallback behavior
```

**Manual Test - With Profile ID**:
```bash
# First create a profile
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
    "voice_id": "spanish-voice-id"
  }' | jq -r '.id')

# Get tenant ID
TENANT_ID=$(curl -X GET http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN" \
  | jq -r '.tenant_id')

# Call internal endpoint with profile ID
curl -X GET "http://localhost:8000/api/v1/voice-ai/internal/context/$TENANT_ID?call_sid=CA123&agent_profile_id=$PROFILE_ID" \
  -H "X-Agent-Key: $AGENT_KEY" \
  | jq '.behavior.language, .providers.tts.voice_id, .active_agent_profile'

# Should return:
# "es"  (language from profile)
# "spanish-voice-id"  (voice from profile)
# { "id": "...", "title": "Spanish Agent", "language_code": "es" }
```

**Integration Test**:
```typescript
describe('VoiceAiInternalController - getContext', () => {
  it('should forward agent_profile_id to context builder', async () => {
    const contextBuilderSpy = jest
      .spyOn(contextBuilderService, 'buildContext')
      .mockResolvedValue({} as any);

    await controller.getContext('tenant-123', 'CA123', 'profile-456');

    expect(contextBuilderSpy).toHaveBeenCalledWith(
      'tenant-123',
      'CA123',
      'profile-456',
    );
  });

  it('should work without agent_profile_id (backward compatible)', async () => {
    const contextBuilderSpy = jest
      .spyOn(contextBuilderService, 'buildContext')
      .mockResolvedValue({} as any);

    await controller.getContext('tenant-123', 'CA123');

    expect(contextBuilderSpy).toHaveBeenCalledWith(
      'tenant-123',
      'CA123',
      undefined,
    );
  });
});
```

---

## 📊 Sprint Completion Report

```markdown
## Sprint 8 Completion: Internal Endpoint

**Status**: ✅ Complete

### Changes Made
- ✅ voice-ai-internal.controller.ts (added agent_profile_id query param)

### Endpoint Updated
- ✅ GET /voice-ai/internal/context/:tenantId?agent_profile_id=...
- ✅ Parameter forwarded to buildContext()
- ✅ Backward compatible (optional parameter)

### Testing
- ✅ Manual test without profile ID - WORKS
- ✅ Manual test with profile ID - WORKS
- ✅ Context returns correct language/voice from profile
- ✅ active_agent_profile populated in response

**Integration Complete**: SIP → Agent Worker → Internal API → Context Builder → Resolved Profile

**Sprint Owner**: [Name]
**Date**: [Date]
```

🚀 **Internal API ready for multi-language agent calls!**
