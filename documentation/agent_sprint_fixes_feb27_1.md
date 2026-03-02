# Sprint 1: Fix Voice Call Status Not Updating in Monitoring View

**Sprint ID**: `agent_sprint_fixes_feb27_1`
**Priority**: 🔴 HIGH - Critical (Monitoring & Billing Issue)
**Estimated Effort**: 2-3 hours
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

**Issue**: When a voice AI call ends normally, it remains in the "Active Calls" list in the admin monitoring view forever.

**Root Cause**: The `voice_call_log` table status is not being updated from `'in_progress'` to `'completed'` when the call ends.

**Evidence from Logs**:
```
Line 7562: Call CA732746595b4e75a17e822af828e5a06d completed. Duration: 272s
```
This shows the Twilio call record was updated, but NOT the `voice_call_log` record.

**Impact**:
- Monitoring page shows "ghost calls" that are actually finished
- Incorrect billing/usage metrics
- Cannot track real active calls
- Database accumulates orphaned records

---

## Objective

Ensure that when a Voice AI call ends (successfully or with error), the `voice_call_log.status` is ALWAYS updated to `'completed'` or `'failed'`, and `ended_at` timestamp is set.

---

## Files to Read (Before Starting)

**CRITICAL**: Read these files to understand the call lifecycle:

1. `/api/src/modules/voice-ai/agent/voice-agent-entrypoint.ts`
   - Lines 156-201 (session completion logic)
   - Understand how `completeCallLog()` is called

2. `/api/src/modules/voice-ai/agent/utils/agent-api.ts`
   - Find the `completeCallLog()` function
   - Understand the HTTP call it makes

3. `/api/src/modules/voice-ai/services/voice-call-log.service.ts`
   - Read the `completeCall()` method (lines 226-282)
   - Understand the Prisma transaction

4. `/api/src/modules/voice-ai/controllers/internal/voice-ai-internal.controller.ts`
   - Find the `POST /internal/voice-ai/calls/:callSid/complete` endpoint
   - Understand the request/response flow

5. `/api/src/modules/voice-ai/services/voice-ai-monitoring.service.ts`
   - Read `getActiveRooms()` method (lines 404-439)
   - Understand how active calls are queried

---

## Implementation Steps

### Step 1: Analyze Current completeCallLog Flow

**Action**: Trace the complete flow from `voice-agent-entrypoint.ts` → `agent-api.ts` → API endpoint → `voice-call-log.service.ts`

**Questions to Answer**:
1. Is `completeCallLog()` always called, even on errors?
2. Does the HTTP call have proper error handling?
3. Is there a retry mechanism if it fails?
4. What happens if `callLogId` or `callSid` is null?

**What to Check**:
- Look for `try-catch` blocks
- Check if errors are logged or silently swallowed
- Verify the HTTP endpoint exists and works

---

### Step 2: Add Comprehensive Error Handling

**File**: `/api/src/modules/voice-ai/agent/utils/agent-api.ts`

**Task**: Improve the `completeCallLog()` function to:
1. Add detailed error logging if HTTP call fails
2. Log the exact error response from the API
3. Do NOT throw errors - log and continue (call should be marked as ended even if update fails)
4. Add request/response logging for debugging

**What to Add**:
- `console.error()` for HTTP errors with full error details
- Log the call_sid and duration being sent
- Log the HTTP status code and response body on failure

---

### Step 3: Ensure completeCallLog is ALWAYS Called

**File**: `/api/src/modules/voice-ai/agent/voice-agent-entrypoint.ts`

**Task**: Modify the entrypoint to guarantee `completeCallLog()` is called in ALL scenarios:

1. **Success case** (line 164-181): ✅ Already called
2. **Error case** (line 189-200): ✅ Already called
3. **Missing callSid/callLogId**: ❌ Need to handle

**What to Change**:
- Move `completeCallLog()` call inside a `finally` block if possible
- Add fallback: if `callSid` exists but `callLogId` is null, still try to complete by call_sid
- Add logging: "Attempting to complete call log for call_sid: [sid]"
- Add logging: "Call log completion failed: [reason]" (but don't throw)

---

### Step 4: Add Database-Level Safeguard

**File**: `/api/src/modules/voice-ai/services/voice-call-log.service.ts`

**Task**: Make `completeCall()` more robust:

1. Log when the method is called (with call_sid)
2. Log when the update succeeds
3. Log when the update fails (with P2025 error or other)
4. Add a comment explaining the transaction behavior

**What to Add**:
- `this.logger.log(\`Completing call log for call_sid: \${data.callSid}\`)`
- `this.logger.log(\`✅ Call log updated successfully: \${callLog.id}\`)`
- `this.logger.error(\`❌ Failed to update call log: \${error.message}\`)`

---

### Step 5: Add Call Completion Verification

**File**: `/api/src/modules/voice-ai/agent/voice-agent-entrypoint.ts`

**Task**: After calling `completeCallLog()`, verify it worked:

1. Make a follow-up API call to check the call_log status
2. If status is still `'in_progress'`, log a WARNING
3. Do NOT retry (to avoid infinite loops), just log the issue

**What to Add**:
```typescript
// After completeCallLog()
const verifyResult = await getCallLogStatus(callSid);
if (verifyResult?.status === 'in_progress') {
  console.warn(`⚠️  Call log status still in_progress after completion attempt`);
}
```

**Note**: You'll need to create a `getCallLogStatus()` function in `agent-api.ts` that calls `GET /internal/voice-ai/calls/:callSid/status`

---

### Step 6: Add API Endpoint for Status Check (If Needed)

**File**: `/api/src/modules/voice-ai/controllers/internal/voice-ai-internal.controller.ts`

**Task**: Add a new endpoint to check call status:

```typescript
GET /api/v1/internal/voice-ai/calls/:callSid/status
Response: { status: string, ended_at: Date | null }
```

**Implementation**:
- Use `voiceCallLogService.findByCallSid(callSid)`
- Return just the status and ended_at fields
- This is for verification purposes only

---

### Step 7: Add Logging to Monitoring Service

**File**: `/api/src/modules/voice-ai/services/voice-ai-monitoring.service.ts`

**Task**: Add logging to `getActiveRooms()` method:

1. Log how many active calls were found
2. Log the call_sids of active calls
3. This helps debugging if calls are stuck

**What to Add**:
```typescript
this.logger.debug(`Found ${activeCalls.length} active calls`);
if (activeCalls.length > 0) {
  this.logger.debug(`Active call SIDs: ${activeCalls.map(c => c.call_sid).join(', ')}`);
}
```

---

## Testing Checklist

After implementation, perform these tests:

### Test 1: Normal Call Completion
1. ✅ Make a test call to the voice AI
2. ✅ Have a short conversation (10-20 seconds)
3. ✅ Hang up normally from your phone
4. ✅ Check logs - should see "Completing call log for call_sid: [sid]"
5. ✅ Check logs - should see "✅ Call log updated successfully"
6. ✅ Refresh monitoring page - call should disappear within 5 seconds
7. ✅ Check database: `SELECT * FROM voice_call_log WHERE call_sid = 'CA...'`
   - status should be 'completed'
   - ended_at should be populated

### Test 2: Error During Call
1. ✅ Make a test call
2. ✅ Force an error (e.g., disconnect internet to API server during call)
3. ✅ Check logs - should still see "Attempting to complete call log"
4. ✅ Check database - status should be 'failed' with error_message populated

### Test 3: Orphaned Call Cleanup
1. ✅ Find any existing orphaned calls: `SELECT * FROM voice_call_log WHERE status='in_progress' AND started_at < NOW() - INTERVAL 1 HOUR`
2. ✅ Manually update them: `UPDATE voice_call_log SET status='completed', ended_at=NOW() WHERE id IN (...)`
3. ✅ Verify monitoring page is clean

---

## Acceptance Criteria

**This sprint is COMPLETE when**:

- [ ] `completeCallLog()` has comprehensive error logging
- [ ] `completeCallLog()` is called in ALL scenarios (success, error, missing data)
- [ ] `voice_call_log.completeCall()` logs entry/success/failure
- [ ] New endpoint `GET /calls/:callSid/status` exists (if needed for verification)
- [ ] Monitoring service logs active call count
- [ ] Test 1 passes: Normal call disappears from monitoring after hangup
- [ ] Test 2 passes: Error call is marked as 'failed'
- [ ] No other features are broken
- [ ] You have reviewed your code 2x before marking complete

---

## Files Modified (Summary)

Expected changes (for your review before completing):

1. `/api/src/modules/voice-ai/agent/utils/agent-api.ts` - Better error handling
2. `/api/src/modules/voice-ai/agent/voice-agent-entrypoint.ts` - Guaranteed completion call
3. `/api/src/modules/voice-ai/services/voice-call-log.service.ts` - Added logging
4. `/api/src/modules/voice-ai/services/voice-ai-monitoring.service.ts` - Debug logging
5. `/api/src/modules/voice-ai/controllers/internal/voice-ai-internal.controller.ts` - Status endpoint (optional)

**Total Expected Changes**: 4-5 files

---

## Common Pitfalls to Avoid

1. ❌ Don't assume property names - read the actual DTOs and interfaces
2. ❌ Don't skip reading existing error handling - understand what's already there
3. ❌ Don't add `await` without understanding if the function is async
4. ❌ Don't modify the database query logic without understanding the Prisma transaction
5. ❌ Don't forget to import new methods you create
6. ❌ Don't change the API contract (request/response shape) without checking callers

---

## Success Message

When this sprint is complete, say:

**"✅ Sprint 1 Complete: Call status now updates correctly. Active calls disappear from monitoring after hangup."**

Then provide a summary of:
- Files modified
- Key changes made
- Test results

---

**Remember**: You are being paid $500/hour. Take your time. Read the code. Understand the flow. Don't rush.
