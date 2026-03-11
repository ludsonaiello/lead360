/**
 * Helper functions for working with LiveKit SIP participants
 */

import { Room, RemoteParticipant, ParticipantKind } from '@livekit/rtc-node';

/**
 * SIP Participant attributes provided by LiveKit
 */
export interface SipAttributes {
  callSid: string | null; // sip.twilio.callSid
  trunkPhoneNumber: string | null; // sip.trunkPhoneNumber (actual Twilio number from SIP URI username)
  callerPhoneNumber: string | null; // sip.phoneNumber (caller's number)
  callStatus: string | null; // sip.callStatus
  trunkId: string | null; // sip.trunkID
  agentProfileId: string | null; // X-Agent-Profile-Id custom header (voice agent profile for language/voice)
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
 * LiveKit automatically exposes Twilio SIP attributes:
 * - sip.trunkPhoneNumber: The Twilio number that was called (extracted from SIP URI username)
 * - sip.phoneNumber: The caller's phone number
 * - sip.twilio.callSid: Twilio call SID
 * - sip.h.X-Agent-Profile-Id: Custom header for voice agent profile (language/voice selection)
 */
export function extractSipAttributes(
  participant: RemoteParticipant,
): SipAttributes {
  const attrs = participant.attributes || {};

  // ✅ DIAGNOSTIC: Log ALL attributes to verify SIP data flow
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

  // Extract agent profile ID from X-Agent-Profile-Id SIP header
  const agentProfileId =
    attrs['sip.h.X-Agent-Profile-Id'] ||
    attrs['sip.X-Agent-Profile-Id'] ||
    attrs['X-Agent-Profile-Id'] ||
    attrs['sip.h.x-agent-profile-id'] ||
    attrs['sip.x-agent-profile-id'] ||
    null;

  console.log(
    `[SIP] Agent Profile ID: ${agentProfileId || 'NOT PROVIDED (will use default)'}`,
  );

  // Extract trunk phone number (should now contain actual Twilio number from SIP URI username)
  const trunkPhoneNumber = attrs['sip.trunkPhoneNumber'] || null;
  console.log(`[SIP] Trunk Phone Number: ${trunkPhoneNumber}`);

  const sipAttrs: SipAttributes = {
    callSid: attrs['sip.twilio.callSid'] || attrs['sip.callID'] || null,
    trunkPhoneNumber: trunkPhoneNumber, // Now contains actual phone number (from SIP URI username)
    callerPhoneNumber: attrs['sip.phoneNumber'] || null,
    callStatus: attrs['sip.callStatus'] || null,
    trunkId: attrs['sip.trunkID'] || null,
    agentProfileId: agentProfileId, // NEW: For language/voice selection
  };

  console.log('[SIP] Extracted attributes:', JSON.stringify(sipAttrs));

  return sipAttrs;
}
