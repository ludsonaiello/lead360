/**
 * Helper functions for working with LiveKit SIP participants
 */

import { Room, RemoteParticipant, ParticipantKind } from '@livekit/rtc-node';

/**
 * SIP Participant attributes provided by LiveKit
 */
export interface SipAttributes {
  callSid: string | null; // sip.twilio.callSid
  trunkPhoneNumber: string | null; // X-Called-Number custom header (actual Twilio number called)
  callerPhoneNumber: string | null; // sip.phoneNumber (caller's number)
  callStatus: string | null; // sip.callStatus
  trunkId: string | null; // sip.trunkID
}

/**
 * Wait for a SIP participant to join the room
 *
 * @param room LiveKit Room instance
 * @param timeoutMs Maximum time to wait (default 30s)
 * @returns SIP participant or null if timeout
 */
export async function waitForSipParticipant(
  room: Room,
  timeoutMs: number = 30000,
): Promise<RemoteParticipant | null> {
  const startTime = Date.now();

  console.log('[SIP] Waiting for SIP participant to join...');

  while (Date.now() - startTime < timeoutMs) {
    // Check existing participants
    for (const participant of room.remoteParticipants.values()) {
      if (participant.kind === ParticipantKind.SIP) {
        console.log(`[SIP] Found SIP participant: ${participant.identity}`);
        return participant;
      }
    }

    // Wait a bit before checking again
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.error('[SIP] Timeout waiting for SIP participant');
  return null;
}

/**
 * Extract SIP attributes from participant
 *
 * NOTE: sip.trunkPhoneNumber returns the trunk identifier ("voice-ai"), not the actual Twilio number.
 * We pass the actual Twilio number via query parameter in the SIP URI as X-Called-Number.
 * (Cannot use X-Twilio-* prefix - reserved by Twilio and silently dropped)
 * LiveKit exposes custom SIP headers/query params with specific attribute keys.
 */
export function extractSipAttributes(
  participant: RemoteParticipant,
): SipAttributes {
  const attrs = participant.attributes || {};

  // ✅ DIAGNOSTIC: Log ALL attributes to identify correct key for X-Called-Number
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

  // Try multiple possible keys for X-Called-Number header/query param
  // LiveKit may expose it with different prefixes depending on how it's passed
  // IMPORTANT: Using X-Called-Number (not X-Twilio-Number which is reserved by Twilio)
  const calledNumber =
    attrs['sip.h.X-Called-Number'] || // LiveKit header prefix pattern (.h.)
    attrs['sip.X-Called-Number'] || // Direct SIP attribute pattern
    attrs['X-Called-Number'] || // Query param pattern (no prefix)
    attrs['sip.h.x-called-number'] || // Lowercase variant
    attrs['sip.x-called-number'] || // Lowercase without .h.
    null;

  console.log(
    `[SIP] X-Called-Number lookup result: ${calledNumber || 'NOT FOUND'}`,
  );
  if (!calledNumber) {
    console.error(
      '[SIP] ⚠️  X-Called-Number NOT found in any expected attribute key!',
    );
    console.error(
      '[SIP] Will fallback to sip.trunkPhoneNumber (trunk identifier "voice-ai")',
    );
  }

  const sipAttrs: SipAttributes = {
    callSid: attrs['sip.twilio.callSid'] || attrs['sip.callID'] || null,
    // Use X-Called-Number if found, otherwise fallback to trunk identifier
    trunkPhoneNumber: calledNumber || attrs['sip.trunkPhoneNumber'] || null,
    callerPhoneNumber: attrs['sip.phoneNumber'] || null,
    callStatus: attrs['sip.callStatus'] || null,
    trunkId: attrs['sip.trunkID'] || null,
  };

  console.log('[SIP] Extracted attributes:', JSON.stringify(sipAttrs));

  return sipAttrs;
}
