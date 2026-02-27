# Sprint VAB-02: Enhance Context with Tenant Business Details

**Module**: Voice AI - HTTP API Bridge  
**Sprint**: VAB-02  
**Depends on**: None (can run parallel to VAB-01)  
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

Enhance the existing `/api/v1/internal/voice-ai/tenant/:tenantId/context` endpoint to include additional tenant business information that the agent needs:
- Primary business address (street, city, state, zip)
- Business email
- Any other tenant fields useful for conversation context

The agent uses this context to personalize conversations (e.g., "We're located in Fitchburg, Massachusetts").

---

## Background

The existing `VoiceAiContext` interface already includes:
- `tenant.company_name`
- `tenant.phone`
- `tenant.timezone`
- `tenant.business_description`

We need to ADD:
- `tenant.primary_address` (street, city, state, zip)
- `tenant.email` (if available)

---

## Pre-Coding Checklist

- [ ] Read existing interface: `voice-ai-context.interface.ts`
- [ ] Read existing context builder: `voice-ai-context-builder.service.ts`
- [ ] Check tenant table schema for available address fields
- [ ] Understand what fields are already being returned
- [ ] Test current endpoint to see actual response

**DO NOT START CODING UNTIL ALL BOXES ARE CHECKED**

---

## Task 1: Review Current Schema

First, check what tenant fields exist:

```sql
-- Run this to see tenant table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tenant'
ORDER BY ordinal_position;
```

Common fields to look for:
- `primary_address`, `address_line1`, `street_address`
- `city`
- `state`
- `zip_code`, `postal_code`
- `email`, `primary_email`, `contact_email`

---

## Task 2: Update VoiceAiContext Interface

**File**: `api/src/modules/voice-ai/interfaces/voice-ai-context.interface.ts`

Update the `tenant` section of the interface:

```typescript
export interface VoiceAiContext {
  call_sid: string | null;
  tenant: {
    id: string;
    company_name: string;
    phone: string | null;
    timezone: string;
    language: string | null;
    business_description: string | null;
    // ADD THESE FIELDS:
    email: string | null;
    primary_address: {
      street: string | null;
      city: string | null;
      state: string | null;
      zip: string | null;
    } | null;
  };
  // ... rest of interface unchanged
}
```

---

## Task 3: Update Context Builder Service

**File**: `api/src/modules/voice-ai/services/voice-ai-context-builder.service.ts`

Find the section that builds the `tenant` object (around line 200+) and add the new fields:

```typescript
// In the buildContext method, find where tenant object is constructed
// Current code looks like:
tenant: {
  id: tenant.id,
  company_name: tenant.company_name,
  phone: tenant.primary_contact_phone ?? null,
  timezone: tenant.timezone,
  language: tenant.default_language ?? null,
  business_description: tenant.business_description ?? null,
},

// UPDATE TO:
tenant: {
  id: tenant.id,
  company_name: tenant.company_name,
  phone: tenant.primary_contact_phone ?? null,
  timezone: tenant.timezone,
  language: tenant.default_language ?? null,
  business_description: tenant.business_description ?? null,
  // ADD THESE:
  email: tenant.primary_contact_email ?? null,
  primary_address: tenant.city ? {
    street: tenant.address_line1 ?? null,
    city: tenant.city ?? null,
    state: tenant.state ?? null,
    zip: tenant.zip_code ?? null,
  } : null,
},
```

**IMPORTANT**: The exact field names depend on your tenant table schema. Review the actual column names first!

Possible variations:
- `address_line1` vs `street_address` vs `address`
- `zip_code` vs `postal_code` vs `zip`
- `primary_contact_email` vs `email` vs `contact_email`

---

## Task 4: Update Prisma Query (if needed)

If the tenant query doesn't already select these fields, update it:

```typescript
// Find the prisma query that loads tenant data
// Make sure it includes all the fields we need

const tenant = await this.prisma.tenant.findUniqueOrThrow({
  where: { id: tenantId },
  select: {
    id: true,
    company_name: true,
    primary_contact_phone: true,
    primary_contact_email: true,  // ADD if missing
    timezone: true,
    default_language: true,
    business_description: true,
    // ADD these if they exist in schema:
    address_line1: true,
    city: true,
    state: true,
    zip_code: true,
  },
});
```

---

## Task 5: Test the Enhanced Endpoint

```bash
# Test the context endpoint
curl http://localhost:3000/api/v1/internal/voice-ai/tenant/14a34ab2-6f6f-4e41-9bea-c444a304557e/context \
  -H "X-Voice-Agent-Key: YOUR_KEY_HERE" | jq '.tenant'

# Expected response should now include:
# {
#   "id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
#   "company_name": "Honey Do 4 You",
#   "phone": "+19788787756",
#   "timezone": "America/New_York",
#   "language": "en",
#   "business_description": "Home services - handyman, painting...",
#   "email": "contact@honeydo4you.com",
#   "primary_address": {
#     "street": "123 Main St",
#     "city": "Fitchburg",
#     "state": "MA",
#     "zip": "01420"
#   }
# }
```

---

## Task 6: Verify Full Context Response

Ensure the complete context still works:

```bash
curl http://localhost:3000/api/v1/internal/voice-ai/tenant/14a34ab2-6f6f-4e41-9bea-c444a304557e/context \
  -H "X-Voice-Agent-Key: YOUR_KEY_HERE" | jq .

# Verify these sections are present:
# - tenant (with new fields)
# - quota
# - behavior
# - providers (with decrypted keys)
# - services
# - service_areas
# - business_hours
# - industries
# - transfer_numbers
```

---

## Acceptance Criteria

- [ ] Interface updated with `email` and `primary_address` fields
- [ ] Context builder returns the new fields
- [ ] `primary_address` is `null` if no address data exists (not empty object)
- [ ] Existing fields unchanged and working
- [ ] No TypeScript compilation errors
- [ ] Endpoint responds correctly

---

## Files Modified

| File | Action | Description |
|------|--------|-------------|
| `interfaces/voice-ai-context.interface.ts` | MODIFY | Add email and primary_address to tenant |
| `services/voice-ai-context-builder.service.ts` | MODIFY | Include new fields in context building |

---

## Edge Cases to Handle

1. **Tenant has no address**: Return `primary_address: null`
2. **Partial address**: Return what exists, null for missing fields
3. **No email**: Return `email: null`

---

## Rollback

If issues occur:
1. Revert interface changes
2. Revert context builder changes
3. Restart server

Adding new optional fields is backward-compatible - existing consumers will simply ignore them.