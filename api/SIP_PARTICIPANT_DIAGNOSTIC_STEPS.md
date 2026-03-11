# SIP Participant Diagnostic Verification Steps

## Current Status

The TwiML SIP fix is complete and all unit tests pass. The called phone number is now passed to LiveKit as a query parameter in the SIP URI:

```xml
<Sip>
  sip:voice-ai@livekit.example.com?X-Called-Number=%2B19788787756
  <SipHeader name="X-Agent-Profile-Id">uuid-here</SipHeader>
</Sip>
```

## Next Steps Required

The `sip-participant.ts` file already has diagnostic logging and speculative attribute key lookup code in place. However, **we need to verify which attribute key LiveKit actually uses** to expose URI query parameters.

### Step 1: Deploy Current Changes

Deploy the updated `voice-ai-sip.service.ts` to production (or staging).

### Step 2: Make a Test Call

1. Configure an IVR with a `voice_ai` action
2. Make a test call to a Twilio number
3. Press the digit that triggers the voice_ai action
4. The call will route to LiveKit and spawn an agent

### Step 3: Check Agent Logs

The agent will print a diagnostic dump of **ALL** LiveKit participant attributes:

```
====================================================================
  🔍 DIAGNOSTIC: ALL SIP PARTICIPANT ATTRIBUTES
====================================================================
{
  "sip.twilio.callSid": "CA1234567890abcdef",
  "sip.trunkPhoneNumber": "voice-ai",
  "sip.phoneNumber": "+15558881234",
  "sip.callStatus": "in-progress",
  "sip.trunkID": "TKxxxxx",
  // THE KEY YOU'RE LOOKING FOR WILL APPEAR HERE:
  "sip.X-Called-Number": "+19788787756",  // ← OR
  "X-Called-Number": "+19788787756",      // ← OR
  "sip.h.X-Called-Number": "+19788787756" // ← OR some other variant
}
====================================================================
```

**Look for the key that contains the value** `+19788787756` (the actual Twilio phone number, NOT "voice-ai").

### Step 4: Update sip-participant.ts

Once you've identified the correct attribute key from the diagnostic output:

**File**: `/var/www/lead360.app/api/src/modules/voice-ai/agent/utils/sip-participant.ts`

**Current code** (lines 79-85):
```typescript
const calledNumber =
  attrs['sip.h.X-Called-Number'] || // LiveKit header prefix pattern (.h.)
  attrs['sip.X-Called-Number'] || // Direct SIP attribute pattern
  attrs['X-Called-Number'] || // Query param pattern (no prefix)
  attrs['sip.h.x-called-number'] || // Lowercase variant
  attrs['sip.x-called-number'] || // Lowercase without .h.
  null;
```

**Update to** (example - adjust based on actual key found):
```typescript
// LiveKit exposes SIP URI query parameters with this attribute key:
const calledNumber = attrs['X-Called-Number'] || null;
```

**Remove speculative keys** - keep only the one that works.

### Step 5: Remove Diagnostic Logging (Optional)

Once the correct key is confirmed and working, you can **optionally** remove the diagnostic logging block (lines 63-74) to reduce log noise:

```typescript
// REMOVE this block after verification:
console.log(
  '====================================================================',
);
console.log('  🔍 DIAGNOSTIC: ALL SIP PARTICIPANT ATTRIBUTES');
console.log(
  '====================================================================',
);
console.log(JSON.stringify(attrs, null, 2));
console.log(
  '====================================================================',
);
```

**Keep the error logging** (lines 87-97) - this is useful for production debugging if the attribute is missing.

### Step 6: Verify End-to-End

After updating `sip-participant.ts`:

1. Make another test call
2. Check agent logs - you should see:
   ```
   [SIP] X-Called-Number lookup result: +19788787756
   [SIP] Extracted attributes: {"callSid":"CA...","trunkPhoneNumber":"+19788787756",...}
   ```
3. Verify tenant is resolved successfully (no E.164 validation error)
4. Verify agent session starts and caller hears greeting

## Expected Outcome

After these changes:

✅ `sip.trunkPhoneNumber` returns the **actual Twilio phone number** (e.g., `+19788787756`)
✅ `lookupTenant()` is called with a valid E.164 number
✅ Tenant is resolved successfully
✅ Context API receives correct `agent_profile_id` when configured
✅ Agent session starts - caller hears the greeting

## Files Modified

### Already Modified (Deployed)
- `api/src/modules/voice-ai/services/voice-ai-sip.service.ts` - Adds query param to SIP URI
- `api/src/modules/voice-ai/services/voice-ai-sip.service.spec.ts` - Updated tests

### Pending Modification (After Diagnostic)
- `api/src/modules/voice-ai/agent/utils/sip-participant.ts` - Update attribute key lookup after test call confirms correct key

## Troubleshooting

### If X-Called-Number is NOT in the diagnostic output:

**Problem**: LiveKit may not be passing query parameters through to participant attributes.

**Solutions**:
1. Check LiveKit SIP trunk configuration
2. Verify the SIP URI in Twilio debugger shows the query parameter
3. Check LiveKit documentation for URI query parameter handling
4. Consider alternative transport mechanism (though query params should work)

### If Tenant Lookup Still Fails:

**Problem**: The attribute value might not be in E.164 format.

**Solutions**:
1. Check if LiveKit is URL-decoding the value (should be `+19788787756`, not `%2B19788787756`)
2. Add URL decoding in `extractSipAttributes()` if needed:
   ```typescript
   const calledNumber = attrs['X-Called-Number']
     ? decodeURIComponent(attrs['X-Called-Number'])
     : null;
   ```

## Contact

If you encounter issues during diagnostic verification, document:
- The full diagnostic output (all attribute keys and values)
- Any error messages from `lookupTenant()`
- Twilio debugger output for the call

This will help troubleshoot any unexpected LiveKit behavior.
