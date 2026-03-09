# Sprint 17 & 18: Critical Corrections

## Sprint 17 CORRECTION: Disable Old Endpoints

**ORIGINAL (WRONG)**: "KEEP old endpoints with deprecation notice"
**CORRECTED**: **DISABLE old endpoints completely**

### Why This Matters
If old endpoints remain functional, tenants will continue creating profiles the OLD way → Architecture remains broken.

### Required Change in Sprint 17

**File**: `voice-agent-profiles.controller.ts`

**Replace old CRUD endpoints with 410 Gone**:

```typescript
// OLD ENDPOINT - MUST BE DISABLED
@Post()
@HttpCode(HttpStatus.GONE) // ← 410 Gone, not deprecated
@ApiOperation({ 
  deprecated: true, 
  summary: 'REMOVED - Use /agent-profile-overrides instead' 
})
async create(@Request() req, @Body() dto) {
  throw new GoneException(
    'This endpoint has been removed. ' +
    'The architecture has changed: system admin creates global profiles, ' +
    'tenants select and customize them. ' +
    'Use POST /api/v1/voice-ai/agent-profile-overrides instead. ' +
    'Documentation: https://api.lead360.app/api/docs'
  );
}

// Similarly for PATCH, DELETE (not GET - list is still useful for migration)
```

**Keep GET for backward compat during transition**:
```typescript
@Get()
@ApiOperation({ 
  summary: 'List overrides (formerly profiles)',
  description: 'This endpoint now returns tenant overrides. Use /available-profiles to see global options.'
})
async findAll(@Request() req) {
  // Redirects to listOverrides() internally
  return this.voiceAgentProfilesService.listOverrides(req.user.tenant_id, false);
}
```

---

## Sprint 18 CORRECTION: Add Prerequisite Checks

**CRITICAL**: Context builder must NOT run until Sprint 15/15B complete.

### Required Change

**File**: `voice-ai-context-builder.service.ts`

**Add at start of buildContext() method**:

```typescript
async buildContext(tenantId: string, callSid?: string, agentProfileId?: string) {
  // PREREQUISITE CHECK: Ensure migration complete
  const globalProfileCount = await this.prisma.voice_ai_agent_profile.count();
  
  if (globalProfileCount === 0) {
    throw new ServiceUnavailableException(
      'Voice AI system upgrade in progress. Migration incomplete. ' +
      'Please contact support if this persists.'
    );
  }

  // If agentProfileId provided, verify it's a GLOBAL profile (not override)
  if (agentProfileId) {
    const isGlobalProfile = await this.prisma.voice_ai_agent_profile.findUnique({
      where: { id: agentProfileId },
    });

    if (!isGlobalProfile) {
      // Legacy call using override ID - try to map to global
      const override = await this.prisma.tenant_voice_agent_profile_override.findUnique({
        where: { id: agentProfileId },
        select: { agent_profile_id: true },
      });

      if (override?.agent_profile_id) {
        agentProfileId = override.agent_profile_id; // Use global ID
      } else {
        // Invalid ID - continue with fallback
        agentProfileId = null;
      }
    }
  }

  // Continue with existing logic...
}
```

**This prevents crashes during phased migration**.

---

## Sprint 18 Additional: IVR Validation Update

**File**: `ivr-configuration.service.ts`

**Update validation** (around line 1237):

```typescript
// OLD (validates against tenant profiles):
const profile = await this.prisma.tenant_voice_agent_profile.findFirst({
  where: { id: profileId, tenant_id: tenantId },
});

// NEW (validates against GLOBAL profiles):
const globalProfile = await this.prisma.voice_ai_agent_profile.findUnique({
  where: { id: profileId },
});

if (!globalProfile || !globalProfile.is_active) {
  throw new BadRequestException(
    `Invalid voice agent profile: ${profileId}. ` +
    `Profile must be an active global profile. ` +
    `To see available profiles, use GET /api/v1/voice-ai/available-profiles`
  );
}
```

---

## Testing Checklist

### After Sprint 17:
- [ ] POST /agent-profiles returns 410 Gone ✅
- [ ] PATCH /agent-profiles/:id returns 410 Gone ✅
- [ ] DELETE /agent-profiles/:id returns 410 Gone ✅
- [ ] GET /agent-profiles still works (returns overrides) ✅
- [ ] New endpoints functional (/agent-profile-overrides) ✅

### After Sprint 18:
- [ ] Context builder checks for global profiles ✅
- [ ] Handles legacy IDs gracefully ✅
- [ ] IVR validation accepts only global IDs ✅
- [ ] Test call succeeds with global + override merge ✅

---

**Apply these corrections to Sprint 17 and 18 implementations**

