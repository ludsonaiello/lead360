/**
 * LiveKit Webhook Event Types — Sprint B14
 *
 * LiveKit sends JSON-encoded webhook events signed with HMAC-SHA256.
 * The signature is provided in the X-LiveKit-Signature header.
 *
 * Room metadata is a JSON string stored on the LiveKit room containing
 * the IVR routing context: { tenantId, callSid, fromNumber?, toNumber? }
 */

export const LIVEKIT_EVENTS = {
  ROOM_STARTED: 'room_started',
  ROOM_FINISHED: 'room_finished',
  PARTICIPANT_JOINED: 'participant_joined',
  PARTICIPANT_LEFT: 'participant_left',
} as const;

export interface LiveKitRoomMetadata {
  tenantId: string;
  callSid: string;
  fromNumber?: string;
  toNumber?: string;
}

export interface LiveKitWebhookEvent {
  /** The event type (e.g. 'room_started', 'room_finished', 'participant_left') */
  event: string;
  /** Room information — present for room_started, room_finished events */
  room?: {
    name: string;
    sid: string;
    creation_time: number;
    empty_timeout: number;
    departure_timeout: number;
    num_participants: number;
    /** JSON-encoded LiveKitRoomMetadata: { tenantId, callSid, fromNumber?, toNumber? } */
    metadata?: string;
  };
  /** Participant information — present for participant_joined, participant_left events */
  participant?: {
    sid: string;
    identity: string;
    name: string;
    joined_at: number;
    left_at?: number;
    metadata?: string;
  };
  /** Unique event ID assigned by LiveKit */
  id: string;
  /** Unix timestamp (seconds) of when the event was generated */
  created_at: number;
}
