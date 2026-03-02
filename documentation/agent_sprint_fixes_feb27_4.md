# Sprint 4: Add Lead Context to First Interaction

**Sprint ID**: `agent_sprint_fixes_feb27_4`
**Priority**: 🟡 MEDIUM (Personalization & UX)
**Estimated Effort**: 3-4 hours
**Dependencies**: None

---

## Developer Guidelines ⚠️

**You are a masterclass developer that makes Google, Amazon, and Apple developers jealous.**

**CRITICAL RULES**:
1. ✅ **ALWAYS read the codebase** - Do NOT rely on documentation (may be outdated)
2. ✅ **Understand the context** - Read related files to understand data flow
3. ✅ **Do NOT guess** - Never assume property names, variable names, class names, or function signatures
4. ✅ **Read before modifying** - Use the Read tool to view files before making changes
5. ✅ **Breathe and analyze** - Think through the impact of each change
6. ✅ **Protect existing features** - Do not break dependencies or production-ready code
7. ✅ **Review your work** - Double-check every change before marking complete
8. ❌ **Single mistake = fired** - Take this seriously

**If uncertain about ANYTHING**:
- Read more files
- Search for similar patterns in the codebase
- Ask the human for clarification

---

## Problem Statement

**Issue**: When a known caller calls, the agent asks for their name and information even though we have it in the database.

**Current Behavior**:
```
[John Doe calls from +1-555-123-4567]
Agent: "Thank you for calling! Who am I speaking with?"
User: "My name is John"
Agent: "What's your last name?"
[Agent doesn't know this is a repeat caller]
```

**Desired Behavior**:
```
[John Doe calls from +1-555-123-4567]
[System looks up lead by phone + tenant_id]
[Lead found: John Doe, previous call on 2024-01-15]
Agent: "Hi John! Thanks for calling back. How can I help you today?"
```

**Business Impact**:
- Better customer experience (personalized greeting)
- Saves time (no need to re-collect information)
- Builds trust (caller knows we remember them)
- Increases conversion rates

---

## Objective

Load lead data by phone number BEFORE the first LLM interaction and include it in the system prompt.

**CRITICAL SECURITY REQUIREMENT**:
- Lead lookup MUST filter by BOTH `phone_number` AND `tenant_id`
- This prevents cross-tenant data leakage
- Query: `WHERE phone_number = ? AND tenant_id = ?`

---

## Files to Read (Before Starting)

1. `/api/src/modules/voice-ai/agent/voice-agent-entrypoint.ts`
   - Lines 126-158: Context loading before session start
   - Understand the flow from tenant lookup to session start

2. `/api/src/modules/voice-ai/agent/utils/agent-api.ts`
   - Study existing HTTP API functions
   - Understand the pattern for making internal API calls

3. `/api/src/modules/voice-ai/services/voice-ai-context-builder.service.ts`
   - Read the `buildContext()` method
   - Understand the VoiceAiContext structure

4. `/api/src/modules/voice-ai/interfaces/voice-ai-context.interface.ts`
   - See the current context structure
   - Plan where to add lead data

5. `/api/src/modules/leads/services/lead.service.ts`
   - Find the `findByPhone()` or similar method
   - Understand how leads are queried
   - **VERIFY**: It filters by tenant_id

6. `/api/src/modules/leads/controllers/lead.controller.ts`
   - Check if there's a "find by phone" endpoint
   - If not, you'll need to create one

---

## Implementation Steps

### Step 1: Create Internal API Endpoint for Lead Lookup

**File**: `/api/src/modules/voice-ai/controllers/internal/voice-ai-internal.controller.ts`

**Task**: Add a new endpoint for lead lookup by phone.

**Endpoint Spec**:
```typescript
POST /api/v1/internal/voice-ai/leads/find-by-phone
Request: {
  tenant_id: string,
  phone_number: string
}
Response: {
  found: boolean,
  lead: {
    id: string,
    first_name: string,
    last_name: string,
    full_name: string,
    email: string | null,
    phone_number: string,
    status: string,
    last_contact_date: Date | null,
    total_contacts: number,
    notes: string | null
  } | null
}
```

**What to Do**:
1. Add a `@Post('leads/find-by-phone')` endpoint
2. Call `leadService.findByPhone(tenant_id, phone_number)`
3. Return formatted response
4. Add try-catch for errors
5. Log the lookup attempt

**CRITICAL**:
- The service method MUST filter by both phone AND tenant_id
- Never expose leads from other tenants

---

### Step 2: Add findLeadByPhone to Agent API Util

**File**: `/api/src/modules/voice-ai/agent/utils/agent-api.ts`

**Task**: Create a function to call the new endpoint.

**Function Signature**:
```typescript
export async function findLeadByPhone(
  tenantId: string,
  phoneNumber: string
): Promise<ApiResponse<{ found: boolean; lead: any | null }>>
```

**What to Implement**:
1. Follow the pattern of existing functions (lookupTenant, checkAccess, etc.)
2. Make POST request to `/internal/voice-ai/leads/find-by-phone`
3. Include tenant_id and phone_number in body
4. Handle errors gracefully (return { found: false } on error)
5. Log the request and response

**Error Handling**:
- If lead service throws error, return `{ success: true, data: { found: false, lead: null } }`
- Don't let lead lookup failure crash the call
- Log the error for debugging

---

### Step 3: Call findLeadByPhone in Entrypoint

**File**: `/api/src/modules/voice-ai/agent/voice-agent-entrypoint.ts`

**Task**: Look up lead BEFORE starting the session.

**Where to Add** (after Step 6: Load full context, before Step 8: Run agent session):

```typescript
// Step 6.5: Look up lead by phone number
console.log('[VoiceAgent] 🔍 Looking up lead by phone...');
const leadResult = await findLeadByPhone(tenantId, sipAttrs.callerPhoneNumber || '');

let leadContext: any = null;
if (leadResult.success && leadResult.data?.found) {
  leadContext = leadResult.data.lead;
  console.log(`[VoiceAgent] ✅ Known caller detected: ${leadContext.full_name}`);
} else {
  console.log('[VoiceAgent] ℹ️  New caller (no existing lead found)');
}
```

**What to Do**:
1. Call `findLeadByPhone()` after context is loaded
2. Store result in a variable
3. Log whether lead was found
4. Pass lead to session (see Step 4)

---

### Step 4: Add Lead to VoiceAiContext

**File**: `/api/src/modules/voice-ai/interfaces/voice-ai-context.interface.ts`

**Task**: Extend the context interface to include lead data.

**What to Add**:
```typescript
export interface VoiceAiContext {
  // ... existing fields ...

  lead?: {
    id: string;
    first_name: string;
    last_name: string;
    full_name: string;
    email: string | null;
    phone_number: string;
    status: string;
    last_contact_date: Date | null;
    total_contacts: number;
    notes: string | null;
  } | null;
}
```

**Where to Add**:
- After the `tenant` field
- Make it optional (?)
- Set to null if no lead found

---

### Step 5: Pass Lead Context to Session

**File**: `/api/src/modules/voice-ai/agent/voice-agent-entrypoint.ts`

**Task**: Include lead data in the context object.

**Current Code** (line 252):
```typescript
const session = new VoiceAgentSession(
  context as any,
  tools,
  ctx.room as any,
  livekitConfig,
  voiceLogger,
);
```

**What to Change**:
1. Before creating session, add lead to context:
```typescript
if (leadContext) {
  context.lead = leadContext;
}
```
2. Pass the updated context to the session

**Note**: The context is typed as `VoiceAiContext`, so adding the lead field should work if you updated the interface in Step 4.

---

### Step 6: Update System Prompt with Lead Info

**File**: `/api/src/modules/voice-ai/agent/voice-agent.session.ts`

**Task**: Include lead information in the system prompt when available.

**Where to Modify** (line 134-136):
```typescript
// Initialize conversation with system prompt
this.conversationHistory = [
  { role: 'system', content: this.context.behavior.system_prompt },
];
```

**What to Change**:
Build a dynamic system prompt that includes lead info:

```typescript
let systemPrompt = this.context.behavior.system_prompt;

// Add lead context if available
if (this.context.lead) {
  const lead = this.context.lead;
  systemPrompt += `\n\n=== CALLER INFORMATION ===
You are speaking with: ${lead.full_name}
Phone: ${lead.phone_number}
Email: ${lead.email || 'Not provided'}
Status: ${lead.status}
Previous Contacts: ${lead.total_contacts || 0}
Last Contact: ${lead.last_contact_date ? new Date(lead.last_contact_date).toLocaleDateString() : 'First time caller'}

IMPORTANT:
- This is a KNOWN caller, not a new lead
- Greet them by name: "Hi ${lead.first_name}!"
- Do NOT ask for information you already have
- Reference their previous interaction if relevant
- Ask how you can help them today
`;

  if (lead.notes) {
    systemPrompt += `\nPrevious Notes: ${lead.notes}`;
  }
}

this.conversationHistory = [
  { role: 'system', content: systemPrompt },
];
```

**What to Do**:
1. Check if `this.context.lead` exists
2. If yes, append lead info to system prompt
3. Include name, email, status, previous contact info
4. Instruct LLM to greet by name and not re-ask for info

---

### Step 7: Add Lead Service Method (If Needed)

**File**: `/api/src/modules/leads/services/lead.service.ts`

**Task**: Create or verify `findByPhone()` method exists.

**What to Check**:
1. Search for a method that finds leads by phone number
2. **VERIFY**: It filters by `tenant_id` (CRITICAL for security)
3. If it doesn't exist, create it

**Method Signature**:
```typescript
async findByPhone(
  tenantId: string,
  phoneNumber: string
): Promise<Lead | null>
```

**Implementation Requirements**:
```typescript
return await this.prisma.lead.findFirst({
  where: {
    tenant_id: tenantId,  // CRITICAL: Tenant isolation
    phone_number: phoneNumber,
  },
  select: {
    id: true,
    first_name: true,
    last_name: true,
    email: true,
    phone_number: true,
    status: true,
    last_contact_date: true,
    notes: true,
    // Calculate total_contacts from related records
  },
});
```

**CRITICAL**:
- MUST include `tenant_id: tenantId` in where clause
- This prevents cross-tenant data leakage
- Test this carefully

---

### Step 8: Add Logging

**File**: Multiple files

**Task**: Add comprehensive logging for debugging.

**What to Log**:
1. When lead lookup starts
2. Whether lead was found or not
3. Lead name if found
4. Any errors during lookup
5. When lead context is added to system prompt

**Example**:
```typescript
this.logger.log(`🔍 Looking up lead for phone: ${phoneNumber}`);
if (lead) {
  this.logger.log(`✅ Known caller: ${lead.full_name} (${lead.id})`);
  this.voiceLogger?.logSessionEvent('known_caller_detected', {
    lead_id: lead.id,
    lead_name: lead.full_name,
    total_contacts: lead.total_contacts,
  });
} else {
  this.logger.log('ℹ️  New caller (no existing lead)');
}
```

---

## Testing Checklist

After implementation, perform these tests:

### Test 1: Known Caller (Lead Exists)
1. ✅ Create a test lead in the database with phone number +1-555-TEST-001
2. ✅ Make a call from that number
3. ✅ Check logs - should see "Known caller detected: [Name]"
4. ✅ Agent should greet: "Hi [FirstName]!"
5. ✅ Agent should NOT ask for name/phone/email
6. ✅ Verify lead_id is in correct tenant (check tenant_id match)

### Test 2: New Caller (No Lead)
1. ✅ Call from a phone number with no existing lead
2. ✅ Check logs - should see "New caller (no existing lead)"
3. ✅ Agent should ask for name and information (normal flow)
4. ✅ System should NOT crash

### Test 3: Tenant Isolation
1. ✅ Create lead for Tenant A with phone +1-555-TEST-002
2. ✅ Call the Voice AI for Tenant B from +1-555-TEST-002
3. ✅ Agent should NOT recognize the caller (different tenant)
4. ✅ Lead from Tenant A should NOT be exposed to Tenant B
5. ✅ This is CRITICAL for security

### Test 4: Lead Lookup Failure
1. ✅ Temporarily break the lead service (simulate error)
2. ✅ Make a test call
3. ✅ Call should continue normally (not crash)
4. ✅ Agent should treat caller as new lead
5. ✅ Error should be logged but not exposed to caller

---

## Acceptance Criteria

**This sprint is COMPLETE when**:

- [ ] Internal API endpoint `POST /internal/voice-ai/leads/find-by-phone` exists
- [ ] `findLeadByPhone()` function exists in agent-api.ts
- [ ] Lead lookup is called in entrypoint BEFORE session starts
- [ ] VoiceAiContext interface includes lead field
- [ ] System prompt includes lead info when available
- [ ] Lead service method filters by tenant_id AND phone_number
- [ ] Comprehensive logging is added
- [ ] Test 1 passes: Known caller is recognized and greeted by name
- [ ] Test 2 passes: New caller flow works normally
- [ ] Test 3 passes: Tenant isolation is enforced (CRITICAL)
- [ ] Test 4 passes: Lead lookup failure doesn't crash call
- [ ] You have reviewed your code 2x before marking complete

---

## Files Modified (Summary)

Expected changes (for your review before completing):

1. `/api/src/modules/voice-ai/controllers/internal/voice-ai-internal.controller.ts` - New endpoint
2. `/api/src/modules/voice-ai/agent/utils/agent-api.ts` - findLeadByPhone function
3. `/api/src/modules/voice-ai/agent/voice-agent-entrypoint.ts` - Call lead lookup
4. `/api/src/modules/voice-ai/interfaces/voice-ai-context.interface.ts` - Add lead field
5. `/api/src/modules/voice-ai/agent/voice-agent.session.ts` - Update system prompt
6. `/api/src/modules/leads/services/lead.service.ts` - findByPhone method (if needed)

**Total Expected Changes**: 5-6 files

---

## Common Pitfalls to Avoid

1. ❌ **CRITICAL**: Don't forget tenant_id filter in lead query (security breach)
2. ❌ Don't crash the call if lead lookup fails
3. ❌ Don't assume lead data structure - read the Prisma schema
4. ❌ Don't skip the tenant isolation test (Test 3)
5. ❌ Don't expose lead data across tenants
6. ❌ Don't forget to handle null/undefined cases
7. ❌ Don't make the system prompt too long (token limits)

---

## Success Message

When this sprint is complete, say:

**"✅ Sprint 4 Complete: Known callers are now recognized and greeted by name. Tenant isolation verified."**

Then provide:
- Files modified
- Test results for all 4 tests
- Example of a known caller greeting from logs

---

**Remember**: You are being paid $500/hour. Take your time. Read the code. Understand the flow. Don't rush.

**SECURITY IS CRITICAL**: Triple-check the tenant_id filtering. A mistake here exposes all leads.
