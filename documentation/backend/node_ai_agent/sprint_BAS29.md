# Sprint VAB-01: Tenant Lookup by Phone Number Endpoint

**Module**: Voice AI - HTTP API Bridge  
**Sprint**: VAB-01  
**Depends on**: None (first sprint in series)  
**Estimated Effort**: Small (1-2 hours)

---

## Developer Mindset

```
YOU ARE A MASTERCLASS DEVELOPER.

You approach problems with CALM PRECISION.
You DO NOT guess. You DO NOT rush.
You REVIEW existing code patterns before writing new code.
You write PRODUCTION-READY code that follows existing conventions.
You VERIFY your work compiles and runs before marking complete.
You DO NOT forget to test. You DO NOT leave broken code.
Peace. Focus. Excellence.
```

---

## Objective

Create an internal API endpoint that looks up a tenant by their Twilio phone number. This is needed because the Voice AI agent (running in a separate process) receives the called Twilio number from LiveKit SIP participant attributes and needs to identify which tenant owns that number.

---

## Background

When a call comes in:
1. Twilio routes to LiveKit SIP
2. LiveKit creates a SIP participant with attributes including `sip.trunkPhoneNumber` (the Twilio number that was called)
3. The agent needs to look up: "Which tenant owns +19788787756?"
4. This endpoint answers that question

---

## Pre-Coding Checklist

- [ ] Read existing internal controller: Find `voice-ai-internal.controller.ts`
- [ ] Read existing internal service: Find `voice-ai-internal.service.ts`
- [ ] Understand the `@Public()` + `VoiceAgentKeyGuard` pattern used for internal endpoints
- [ ] Find where phone numbers are stored (likely `tenant_sms_config` or similar table)
- [ ] Review how existing endpoints return data

**DO NOT START CODING UNTIL ALL BOXES ARE CHECKED**

---

## Task 1: Create DTO Files

**File**: `api/src/modules/voice-ai/dto/internal/lookup-tenant.dto.ts`

Create DTOs for request and response:

```typescript
import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Request DTO for tenant lookup by phone number
 */
export class LookupTenantDto {
  @ApiProperty({
    description: 'Twilio phone number to look up (E.164 format)',
    example: '+19788787756',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\+1\d{10}$/, { message: 'Phone number must be E.164 format (+1XXXXXXXXXX)' })
  phone_number: string;
}

/**
 * Response DTO for tenant lookup
 * 
 * Returns tenant identification data needed by the agent.
 * Does NOT include sensitive data - agent will call /context for full details.
 */
export class LookupTenantResponseDto {
  @ApiProperty({ description: 'Whether a tenant was found for this number' })
  found: boolean;

  @ApiProperty({ description: 'Tenant UUID', required: false })
  tenant_id?: string;

  @ApiProperty({ description: 'Tenant business name', required: false })
  tenant_name?: string;

  @ApiProperty({ description: 'The phone number that was looked up', required: false })
  phone_number?: string;

  @ApiProperty({ description: 'Error message if lookup failed', required: false })
  error?: string;
}
```

---

## Task 2: Add Service Method

**File**: `api/src/modules/voice-ai/services/voice-ai-internal.service.ts`

Add method to the existing `VoiceAiInternalService` class:

```typescript
/**
 * Look up tenant by Twilio phone number — API for agent process isolation
 *
 * Used by the agent (running in a separate process) to identify which tenant
 * owns a given Twilio phone number. The agent receives this number from
 * LiveKit SIP participant attributes (sip.trunkPhoneNumber).
 *
 * Query order:
 * 1. Check tenant_sms_config.twilio_phone_number
 * 2. If not found, check any other phone allocation tables
 *
 * @param phoneNumber E.164 format phone number (+1XXXXXXXXXX)
 * @returns LookupTenantResponseDto with found status and tenant info
 */
async lookupTenantByPhoneNumber(phoneNumber: string): Promise<LookupTenantResponseDto> {
  this.logger.log(`Looking up tenant for phone number: ${phoneNumber}`);

  try {
    // Normalize phone number (remove any whitespace, ensure E.164)
    const normalizedPhone = phoneNumber.trim();

    // Query tenant_sms_config for matching phone number
    const smsConfig = await this.prisma.tenant_sms_config.findFirst({
      where: {
        twilio_phone_number: normalizedPhone,
        is_active: true,
      },
      include: {
        tenant: {
          select: {
            id: true,
            company_name: true,
          },
        },
      },
    });

    if (smsConfig && smsConfig.tenant) {
      this.logger.log(`Tenant found: ${smsConfig.tenant.company_name} (${smsConfig.tenant.id})`);
      return {
        found: true,
        tenant_id: smsConfig.tenant.id,
        tenant_name: smsConfig.tenant.company_name,
        phone_number: normalizedPhone,
      };
    }

    // Phone number not found in any tenant configuration
    this.logger.warn(`No tenant found for phone number: ${phoneNumber}`);
    return {
      found: false,
      phone_number: normalizedPhone,
    };
  } catch (error) {
    this.logger.error(`Error looking up tenant by phone: ${error.message}`, error.stack);
    return {
      found: false,
      error: 'Internal error during tenant lookup',
    };
  }
}
```

**IMPORTANT**: Review the actual database schema first. The table might be named differently. Check:
- `tenant_sms_config`
- `twilio_phone_configuration`
- `tenant_communications_settings`
- Or run: `SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%phone%' OR table_name LIKE '%twilio%';`

---

## Task 3: Add Controller Endpoint

**File**: `api/src/modules/voice-ai/controllers/internal/voice-ai-internal.controller.ts`

Add endpoint to the existing controller class:

```typescript
/**
 * POST /api/v1/internal/voice-ai/lookup-tenant
 *
 * Looks up a tenant by their Twilio phone number.
 * Used by the agent to identify which tenant a call belongs to.
 *
 * The agent receives the Twilio number from LiveKit SIP participant
 * attributes (sip.trunkPhoneNumber) and needs to map it to a tenant.
 *
 * Response:
 *   { found: true, tenant_id: "uuid", tenant_name: "Business Name", phone_number: "+1..." }
 *   { found: false, phone_number: "+1..." }
 *   { found: false, error: "..." }
 */
@Post('lookup-tenant')
@HttpCode(200)
@ApiOperation({
  summary: 'Look up tenant by Twilio phone number',
  description:
    'Called by the agent to identify which tenant owns a Twilio phone number. ' +
    'The agent receives this number from LiveKit SIP participant attributes.',
})
@ApiBody({ type: LookupTenantDto })
@ApiResponse({
  status: 200,
  description: 'Lookup result (found or not found)',
  type: LookupTenantResponseDto,
})
@ApiResponse({ status: 401, description: 'Missing or invalid X-Voice-Agent-Key' })
async lookupTenant(@Body() dto: LookupTenantDto): Promise<LookupTenantResponseDto> {
  return this.internalService.lookupTenantByPhoneNumber(dto.phone_number);
}
```

**Don't forget to add the import at the top of the file**:
```typescript
import { LookupTenantDto, LookupTenantResponseDto } from '../../dto/internal/lookup-tenant.dto';
```

---

## Task 4: Test the Endpoint

After implementing, test with curl:

```bash
# Get the Voice Agent Key from .env or database
# VOICE_AGENT_API_KEY=your-key-here

# Test with known Twilio number
curl -X POST http://localhost:3000/api/v1/internal/voice-ai/lookup-tenant \
  -H "X-Voice-Agent-Key: YOUR_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "+19788787756"}'

# Expected success response:
# {
#   "found": true,
#   "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
#   "tenant_name": "Honey Do 4 You",
#   "phone_number": "+19788787756"
# }

# Test with unknown number
curl -X POST http://localhost:3000/api/v1/internal/voice-ai/lookup-tenant \
  -H "X-Voice-Agent-Key: YOUR_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "+15551234567"}'

# Expected not found response:
# {
#   "found": false,
#   "phone_number": "+15551234567"
# }

# Test without auth header (should fail)
curl -X POST http://localhost:3000/api/v1/internal/voice-ai/lookup-tenant \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "+19788787756"}'

# Expected: 401 Unauthorized
```

---

## Acceptance Criteria

- [ ] DTO validates E.164 format (+1XXXXXXXXXX)
- [ ] Service queries correct table for phone → tenant mapping
- [ ] Returns `found: true` with tenant_id and tenant_name for known numbers
- [ ] Returns `found: false` (not 404) for unknown numbers
- [ ] Uses existing `@Public()` + `VoiceAgentKeyGuard` auth pattern
- [ ] No breaking changes to existing endpoints
- [ ] Endpoint responds in < 100ms

---

## Files Modified

| File | Action | Description |
|------|--------|-------------|
| `dto/internal/lookup-tenant.dto.ts` | CREATE | Request/response DTOs |
| `services/voice-ai-internal.service.ts` | MODIFY | Add lookupTenantByPhoneNumber method |
| `controllers/internal/voice-ai-internal.controller.ts` | MODIFY | Add POST /lookup-tenant endpoint |

---

## Rollback

If issues occur:
1. Remove the new endpoint from controller
2. Remove the new method from service
3. Delete the DTO file
4. Restart server

No database changes, no risk to other features.