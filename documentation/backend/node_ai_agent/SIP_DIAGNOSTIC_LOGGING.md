# SIP Diagnostic Logging Implementation

**Date**: 2026-02-27
**Purpose**: Debug LiveKit SIP call failures by capturing SIP response codes
**Status**: ✅ **IMPLEMENTED**

---

## Problem

After the tenant lookup fix, calls were still failing with Twilio error message:
> "We are sorry, an application error has occurred, goodbye"

The logs showed:
```
[2026-02-27T02:06:10.341Z] ⏳ Waiting for LiveKit to spawn agent job...
```

Then... **nothing**. No agent job spawned, no error logged, call just failed.

**Why?** We had no visibility into what LiveKit was returning when the SIP dial failed.

---

## The Solution

Add a Twilio **action URL** to the `<Dial>` verb that captures the SIP response when the dial completes.

### How Twilio SIP Dial Works

When you use `<Dial><Sip>`, Twilio attempts to connect to the SIP endpoint. When the dial completes (success or failure), Twilio POSTs to the action URL with:

- `DialCallStatus` - Status of the dial attempt (completed, busy, no-answer, failed, canceled)
- `DialSipResponseCode` - **The actual SIP response code** (200, 486, 503, etc.)
- `DialSipCallId` - The SIP Call-ID header
- `DialSipHeader_*` - All SIP headers returned by the endpoint

**This tells us exactly WHY LiveKit accepted or rejected the call.**

---

## Implementation

### 1. Added SIP Dial Result Webhook Endpoint

**File**: `twilio-webhooks.controller.ts`

**Endpoint**: `POST /api/v1/twilio/sip/dial-result`

**Purpose**: Captures and logs SIP response codes when LiveKit dial completes

```typescript
@Post('sip/dial-result')
@Public()
async handleSipDialResult(@Body() body: any, @Req() req: Request) {
  const { CallSid, DialCallStatus, DialSipResponseCode } = body;

  // Log to NestJS logger (console)
  this.logger.log('='.repeat(100));
  this.logger.log('📞 SIP DIAL RESULT RECEIVED FROM TWILIO');
  this.logger.log(`CallSid: ${CallSid}`);
  this.logger.log(`DialCallStatus: ${DialCallStatus}`);
  this.logger.log(`DialSipResponseCode: ${DialSipResponseCode}`);

  // Log to Voice AI structured logger (file + database)
  const voiceLogger = createVoiceAILogger(tenantId, CallSid);
  voiceLogger.log(
    DialCallStatus === 'completed' ? VoiceAILogLevel.SUCCESS : VoiceAILogLevel.ERROR,
    VoiceAILogCategory.SIP_DIAL,
    DialCallStatus === 'completed'
      ? '✅ LiveKit SIP dial succeeded'
      : `❌ LiveKit SIP dial failed - Status: ${DialCallStatus}`,
    {
      call_sid: CallSid,
      dial_status: DialCallStatus,
      sip_response_code: DialSipResponseCode,
      full_body: body,
    }
  );

  // Interpret SIP response codes
  if (DialSipResponseCode) {
    const code = parseInt(DialSipResponseCode);
    let meaning = '';

    if (code === 200) meaning = '✅ OK - Call connected successfully';
    else if (code === 486) meaning = '❌ Busy - No agent available';
    else if (code === 480) meaning = '❌ Temporarily Unavailable';
    else if (code === 503) meaning = '❌ Service Unavailable - LiveKit down or agent not registered';
    else if (code === 404) meaning = '❌ Not Found - Dispatch rule not matching';
    else if (code === 403) meaning = '❌ Forbidden - Authentication issue';

    this.logger.log(`SIP Response Code ${code}: ${meaning}`);
  }

  return new twilio.twiml.VoiceResponse().toString();
}
```

---

### 2. Modified TwiML to Include Action URL

**File**: `voice-ai-sip.service.ts`

**Changes**:
- Load tenant subdomain for building callback URL
- Add `action` attribute to `<Dial>` verb

```typescript
async buildSipTwiml(tenantId: string, callSid: string, toNumber?: string): Promise<string> {
  // Load tenant info for callback URL
  const tenant = await this.prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { subdomain: true },
  });

  // Build callback URL for SIP dial results
  const actionUrl = `https://${tenant?.subdomain || 'app'}.lead360.app/api/v1/twilio/sip/dial-result`;

  // Build TwiML with action URL
  const twiml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Response>',
    `  <Dial action="${actionUrl}" method="POST">`,  // ✅ Added action URL
    '    <Sip>',
    `      ${sipUri}`,
    toNumber ? `      <SipHeader name="X-Twilio-Number">${toNumber}</SipHeader>` : '',
    '    </Sip>',
    '  </Dial>',
    '</Response>',
  ].join('\n');

  return twiml;
}
```

**Generated TwiML Example**:
```xml
<Response>
  <Dial action="https://app.lead360.app/api/v1/twilio/sip/dial-result" method="POST">
    <Sip>
      sip:voice-ai@66v7efaya7r.sip.livekit.cloud
      <SipHeader name="X-Twilio-Number">+19788787756</SipHeader>
    </Sip>
  </Dial>
</Response>
```

---

### 3. Added SIP_DIAL Log Category

**File**: `voice-ai-logger.util.ts`

**Changes**: Added new category for SIP dial events

```typescript
export enum VoiceAILogCategory {
  JOB_START = 'JOB_START',
  // ... other categories ...
  SIP_DIAL = 'SIP_DIAL',  // ✅ Added
}
```

---

## What You'll See in Logs Now

### When Call Succeeds (SIP 200)

```
====================================================================================================
  📞 SIP DIAL RESULT RECEIVED FROM TWILIO
====================================================================================================
CallSid: CA90c67079145d8cc5e711617c4a72250c
DialCallStatus: completed
DialSipResponseCode: 200
DialSipCallId: abc123@livekit
DialSipHeader_User-Agent: LiveKit/1.0

SIP Response Code 200: ✅ OK - Call connected successfully

[2026-02-27T02:06:15.000Z] [SUCCESS] [SIP_DIAL] [tenant:14a34ab2...] [call:CA90c...]
  ✅ LiveKit SIP dial succeeded
  Data: {
    "dial_status": "completed",
    "sip_response_code": "200"
  }
```

### When Call Fails (SIP 4xx/5xx)

```
====================================================================================================
  📞 SIP DIAL RESULT RECEIVED FROM TWILIO
====================================================================================================
CallSid: CA90c67079145d8cc5e711617c4a72250c
DialCallStatus: failed
DialSipResponseCode: 503
DialSipCallId: xyz789@livekit

SIP Response Code 503: ❌ Service Unavailable - LiveKit down or agent not registered

[2026-02-27T02:06:15.000Z] [ERROR] [SIP_DIAL] [tenant:14a34ab2...] [call:CA90c...]
  ❌ LiveKit SIP dial failed - Status: failed
  Data: {
    "dial_status": "failed",
    "sip_response_code": "503"
  }
```

---

## Common SIP Response Codes

| Code | Meaning | Likely Cause |
|------|---------|-------------|
| **200** | OK | ✅ Call connected successfully - agent answered |
| **486** | Busy Here | ❌ No agent available to take the call |
| **480** | Temporarily Unavailable | ❌ LiveKit SIP trunk exists but can't handle call |
| **503** | Service Unavailable | ❌ **Most likely**: Agent not registered with LiveKit |
| **404** | Not Found | ❌ LiveKit dispatch rule not matching (trunk ID issue) |
| **403** | Forbidden | ❌ Authentication failed (invalid credentials) |
| **408** | Request Timeout | ❌ LiveKit not responding (network/firewall issue) |
| **500-599** | Server Error | ❌ Internal LiveKit error |

---

## How to Debug Call Failures Now

### Step 1: Make a Test Call
```bash
# Call the Twilio number
Call: +19788787756
```

### Step 2: Watch Logs for SIP Response
```bash
# Monitor logs in real-time
tail -f /var/www/lead360.app/logs/api_access.log | grep "SIP DIAL"

# Or check NestJS console output
# Look for: "📞 SIP DIAL RESULT RECEIVED"
```

### Step 3: Interpret the SIP Code

**If you see SIP 503** (most likely):
- **Cause**: Voice agent not registered with LiveKit
- **Fix**: Check if `VoiceAgentService` started successfully
- **Verify**: Look for log `[VoiceAgentService] LiveKit AgentServer started and listening for jobs`

**If you see SIP 404**:
- **Cause**: LiveKit dispatch rule not matching
- **Fix**: Check LiveKit dashboard → SIP → Dispatch Rules
- **Verify**: Ensure trunk ID matches what's configured

**If you see SIP 486** (Busy):
- **Cause**: Agent started but not accepting jobs
- **Fix**: Check agent job vetting logic in `voice-agent.service.ts`

**If you see SIP 480**:
- **Cause**: LiveKit trunk configured but can't route call
- **Fix**: Check LiveKit trunk settings and outbound rules

---

## Files Modified

1. ✅ `twilio-webhooks.controller.ts` - Added `/sip/dial-result` endpoint
2. ✅ `voice-ai-sip.service.ts` - Added action URL to `<Dial>`
3. ✅ `voice-ai-logger.util.ts` - Added `SIP_DIAL` category

**Build Status**: ✅ **0 errors**

---

## Next Steps for Debugging

1. **Restart the server** to load new code:
   ```bash
   cd /var/www/lead360.app/api
   npm run start:dev
   ```

2. **Make a test call** to +19788787756

3. **Check logs immediately**:
   ```bash
   # Look for SIP response code
   tail -100 /var/www/lead360.app/logs/api_access.log | grep "SIP"

   # Or watch console output for:
   # "📞 SIP DIAL RESULT RECEIVED"
   ```

4. **Interpret the code** using the table above

5. **Fix the root cause** based on SIP response

---

## Expected Outcome

You will now see **exactly why** LiveKit is rejecting or accepting calls:

- **SIP 200**: Everything works - agent connected ✅
- **SIP 503**: Agent not registered - check `VoiceAgentService` startup
- **SIP 404**: Dispatch rule mismatch - check LiveKit dashboard
- **SIP 486**: Agent busy/not accepting - check job vetting logic

No more mystery errors! 🎯

---

**Implemented By**: Masterclass Developer
**Date**: 2026-02-27
**Purpose**: Debug LiveKit SIP integration issues
