# Sprint 6: SIP Service TwiML - Agent Profile Header

## 🎯 Sprint Owner Role

You are a **MASTERCLASS TELEPHONY INTEGRATION ENGINEER** that makes Google, Amazon, and Apple Voice/SIP engineers jealous.

You build SIP integrations that are **bulletproof** and **RFC-compliant**. You **think deeply** about call routing, **breathe TwiML/SIP protocols**, and **never rush** through changes that affect live calls. You **always verify** header formats and **never guess** TwiML syntax.

**100% quality or beyond**. SIP routing connects real customer calls - mistakes here cause dropped calls and lost business.

---

## 📋 Sprint Objective

Update VoiceAiSipService to include agent profile ID in SIP headers:
1. Add optional `agentProfileId` parameter to `buildSipTwiml()` method
2. Include `X-Agent-Profile-Id` SIP header when profile ID provided
3. Maintain backward compatibility (no profile ID → no header)
4. Update IVR service call to pass profile ID
5. Test TwiML generation

**Dependencies**: Sprint 5 complete (IVR passes profile ID)

---

## 📚 Required Reading

1. **Contract**: `/var/www/lead360.app/documentation/contracts/voice-multilangual-contract.md` - Section 6.5
2. **SIP Service**: `/var/www/lead360.app/api/src/modules/voice-ai/services/voice-ai-sip.service.ts`
3. **Twilio SIP Headers Docs**: https://www.twilio.com/docs/voice/twiml/sip#headers (understand `<SipHeader>` element)

---

## 🔐 Test Environment

**Database**: `mysql://lead360_user:978@F32c@127.0.0.1:3306/lead360`
**Tenant User**: `contact@honeydo4you.com` / `978@F32c`
**Server**: `npm run start:dev`

---

## 📐 Implementation

### Change 1: Update buildSipTwiml() Signature

**File**: `/var/www/lead360.app/api/src/modules/voice-ai/services/voice-ai-sip.service.ts`

Find the `buildSipTwiml()` method and update signature:

```typescript
/**
 * Builds TwiML to route call to LiveKit SIP trunk for AI agent handling
 * @param tenantId - Tenant UUID
 * @param callSid - Twilio call SID
 * @param toNumber - Original dialed number (optional)
 * @param agentProfileId - Voice agent profile ID for language/voice selection (optional) - NEW
 * @returns TwiML XML string
 */
async buildSipTwiml(
  tenantId: string,
  callSid: string,
  toNumber?: string,
  agentProfileId?: string, // NEW PARAMETER
): Promise<string> {
  const livekitSipTrunkUrl = this.configService.get<string>(
    'LIVEKIT_SIP_TRUNK_URL',
  );

  if (!livekitSipTrunkUrl) {
    throw new Error('LIVEKIT_SIP_TRUNK_URL not configured');
  }

  // Build SIP headers array
  const sipHeaders: string[] = [];

  // Always include Twilio number if provided
  if (toNumber) {
    sipHeaders.push(
      `<SipHeader name="X-Twilio-Number">${this.escapeXml(toNumber)}</SipHeader>`,
    );
  }

  // NEW: Include agent profile ID if provided
  if (agentProfileId) {
    sipHeaders.push(
      `<SipHeader name="X-Agent-Profile-Id">${this.escapeXml(agentProfileId)}</SipHeader>`,
    );
  }

  // Build TwiML
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Sip>${livekitSipTrunkUrl}${sipHeaders.join('')}</Sip>
  </Dial>
</Response>`;

  return twiml;
}

// NEW: Helper method to escape XML special characters in header values
private escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
```

**Expected TwiML Output** (with profile ID):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Sip>voice-ai@livekit-trunk.example.com<SipHeader name="X-Twilio-Number">+15551234567</SipHeader><SipHeader name="X-Agent-Profile-Id">a1b2c3d4-uuid-here</SipHeader></Sip>
  </Dial>
</Response>
```

**Expected TwiML Output** (without profile ID - backward compatible):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Sip>voice-ai@livekit-trunk.example.com<SipHeader name="X-Twilio-Number">+15551234567</SipHeader></Sip>
  </Dial>
</Response>
```

---

### Change 2: Update IVR Service Call (Fix TypeScript Error from Sprint 5)

**File**: `/var/www/lead360.app/api/src/modules/communication/services/ivr-configuration.service.ts`

The `executeVoiceAiAction()` method already passes `agentProfileId` in Sprint 5. This change fixes the TypeScript error. **No code change needed** - just verify it compiles now.

---

### Change 3: Add Unit Tests

**File**: `/var/www/lead360.app/api/src/modules/voice-ai/services/voice-ai-sip.service.spec.ts`

Add tests for new parameter:

```typescript
describe('buildSipTwiml', () => {
  it('should include X-Agent-Profile-Id header when agentProfileId provided', async () => {
    const tenantId = 'tenant-123';
    const callSid = 'CA123';
    const toNumber = '+15551234567';
    const agentProfileId = 'profile-uuid-123';

    const twiml = await service.buildSipTwiml(
      tenantId,
      callSid,
      toNumber,
      agentProfileId,
    );

    expect(twiml).toContain('<SipHeader name="X-Agent-Profile-Id">profile-uuid-123</SipHeader>');
    expect(twiml).toContain('<SipHeader name="X-Twilio-Number">+15551234567</SipHeader>');
  });

  it('should not include X-Agent-Profile-Id header when agentProfileId not provided', async () => {
    const tenantId = 'tenant-123';
    const callSid = 'CA123';
    const toNumber = '+15551234567';

    const twiml = await service.buildSipTwiml(tenantId, callSid, toNumber);

    expect(twiml).not.toContain('X-Agent-Profile-Id');
    expect(twiml).toContain('<SipHeader name="X-Twilio-Number">+15551234567</SipHeader>');
  });

  it('should escape XML special characters in profile ID', async () => {
    const agentProfileId = 'profile<>&"\'123'; // Malicious input

    const twiml = await service.buildSipTwiml(
      'tenant-123',
      'CA123',
      '+15551234567',
      agentProfileId,
    );

    expect(twiml).toContain('&lt;'); // < escaped
    expect(twiml).toContain('&gt;'); // > escaped
    expect(twiml).toContain('&amp;'); // & escaped
    expect(twiml).toContain('&quot;'); // " escaped
    expect(twiml).toContain('&apos;'); // ' escaped
  });
});
```

---

## ✅ Acceptance Criteria

### Signature Update
- ✅ buildSipTwiml() accepts optional `agentProfileId` parameter
- ✅ TypeScript compilation succeeds (no errors from Sprint 5)

### TwiML Generation
- ✅ X-Agent-Profile-Id header included when profile ID provided
- ✅ X-Agent-Profile-Id header NOT included when profile ID absent
- ✅ XML special characters escaped in header values
- ✅ Existing X-Twilio-Number header still works

### Testing
```bash
# Unit tests
cd /var/www/lead360.app/api
npm run test -- voice-ai-sip.service.spec.ts

# Integration test - create test file:
# /var/www/lead360.app/api/test-sip-twiml.ts
```

```typescript
import { VoiceAiSipService } from './src/modules/voice-ai/services/voice-ai-sip.service';
import { ConfigService } from '@nestjs/config';

const configService = new ConfigService({
  LIVEKIT_SIP_TRUNK_URL: 'voice-ai@livekit.example.com',
});

const service = new VoiceAiSipService(configService as any);

async function test() {
  console.log('Testing TwiML generation with agent profile...\n');

  const twiml1 = await service.buildSipTwiml(
    'tenant-123',
    'CA123',
    '+15551234567',
    'profile-uuid-abc',
  );
  console.log('WITH profile ID:');
  console.log(twiml1);
  console.log('\n---\n');

  const twiml2 = await service.buildSipTwiml(
    'tenant-123',
    'CA123',
    '+15551234567',
  );
  console.log('WITHOUT profile ID (backward compatible):');
  console.log(twiml2);
}

test().catch(console.error);
```

Run:
```bash
npx ts-node test-sip-twiml.ts
```

Expected: Two TwiML outputs, second without X-Agent-Profile-Id header.

---

## 📊 Sprint Completion Report

```markdown
## Sprint 6 Completion: SIP Service TwiML

**Status**: ✅ Complete

### Changes Made
- ✅ voice-ai-sip.service.ts (added agentProfileId param + header)
- ✅ escapeXml() helper method added
- ✅ Unit tests for new parameter

### TwiML Generation Verified
- ✅ X-Agent-Profile-Id header included when profile ID provided
- ✅ Header omitted when no profile ID (backward compatible)
- ✅ XML escaping works correctly

### Testing
- ✅ Unit tests passing
- ✅ Manual TwiML generation tested
- ✅ TypeScript compilation fixed (Sprint 5 error resolved)

**Next Steps**: Sprint 7 (context builder) will consume this header from agent worker.

**Sprint Owner**: [Name]
**Date**: [Date]
```

🚀 **Route calls with language/voice awareness!**
